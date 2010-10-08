# The Grinder 3.4
# HTTP script originally recorded by TCPProxy, but then hacked...

from net.grinder.script import Test
from net.grinder.script.Grinder import grinder
from net.grinder.plugin.http import HTTPPluginControl, HTTPRequest
from HTTPClient import NVPair
from HTTPClient import Cookie, CookieModule, CookiePolicyHandler

connectionDefaults = HTTPPluginControl.getConnectionDefaults()
httpUtilities = HTTPPluginControl.getHTTPUtilities()

log = grinder.logger.output

# Properties read from the grinder .properties file.
# After how many 'send' requests should we perform oauth?  This is to
# simulate cookie expiry or session timeouts.
sends_per_oauth = grinder.getProperties().getInt("linkdrop.sends_per_oauth", 0)

# The URL of the server we want to hit.
linkdrop_host = grinder.getProperties().getProperty("linkdrop.host", 'http://127.0.0.1:5000')

linkdrop_service = grinder.getProperties().getProperty("linkdrop.service", 'twitter.com')

# *sob* - failed to get json packages working.  Using 're' is an option,
# although it requires you install jython2.5 (which still doesn't have
# json builtin) - so to avoid all that complication, hack 'eval' into
# working for us...
_json_ns = {'null': None}
def json_loads(val):
    return eval(val, _json_ns)

CookieModule.setCookiePolicyHandler(None)
from net.grinder.plugin.http import HTTPPluginControl
HTTPPluginControl.getConnectionDefaults().followRedirects = 1

# To use a proxy server, uncomment the next line and set the host and port.
# connectionDefaults.setProxyServer("localhost", 8001)

# These definitions at the top level of the file are evaluated once,
# when the worker process is started.
connectionDefaults.defaultHeaders = \
  [ NVPair('Accept-Language', 'en-us,en;q=0.5'),
    NVPair('Accept-Charset', 'ISO-8859-1,utf-8;q=0.7,*;q=0.7'),
    NVPair('Accept-Encoding', 'gzip, deflate'),
    NVPair('User-Agent', 'Mozilla/5.0 (Windows NT 6.0; WOW64; rv:2.0b6) Gecko/20100101 Firefox/4.0b6'), ]

request1 = HTTPRequest()

# Here are the "helper functions" used by the actual test.
def getCSRF():
    threadContext = HTTPPluginControl.getThreadHTTPClientContext()
    CookieModule.discardAllCookies(threadContext)
    result = request1.GET(linkdrop_host + '/api/account/get')
    assert result.getStatusCode()==200, result
    csrf = linkdrop = None
    for cookie in CookieModule.listAllCookies(threadContext):
        if cookie.name == "linkdrop":
            linkdrop = cookie
        if cookie.name == "csrf":
            csrf = cookie.value
    assert csrf and linkdrop
    return csrf, linkdrop

getCSRF = Test(2, "get CSRF").wrap(getCSRF)

def authTwitter(csrf):
    # Call authorize requesting we land back on /account/get - after
    # a couple of redirects for auth, we should wind up with the data from
    # account/get - which should now include our account info.
    result = request1.POST(linkdrop_host + '/api/account/authorize',
      ( NVPair('csrftoken', csrf),
        NVPair('domain', linkdrop_service),
        NVPair('end_point_success', '/api/account/get'),
        NVPair('end_point_auth_failure', '/send/auth.html#oauth_failure'), ),
      ( NVPair('Content-Type', 'application/x-www-form-urlencoded'), ))
    assert result.getStatusCode()==200, result
    data = json_loads(result.getText())
    assert data, 'account/get failed to return data'
    userid = data[0]['accounts'][0]['userid']
    return userid

authTwitter = Test(3, "auth %s" % linkdrop_service).wrap(authTwitter)

def send(userid, csrf, domain=linkdrop_service, message="take that!"):
    """POST send."""
    result = request1.POST(linkdrop_host + '/api/send',
      ( NVPair('domain', domain),
        NVPair('userid', userid),
        NVPair('csrftoken', csrf),
        NVPair('message', message), ),
      ( NVPair('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8'), ))
    assert result.getStatusCode()==200, result
    assert '"error": null' in result.getText(), result.getText()
    return result

send = Test(4, "Send message").wrap(send)

# The test itself.
class TestRunner:
    """A TestRunner instance is created for each worker thread."""
    def __init__(self):
        self.csrf = None
        self.linkdrop_cookie = None

    def doit(self):
        if self.csrf is None or \
           (sends_per_oauth and grinder.getRunNumber() % sends_per_oauth==0):
            self.csrf, self.linkdrop_cookie = getCSRF()
            self.userid = authTwitter(self.csrf)
        # cookies are reset by the grinder each test run - re-inject the
        # linkdrop session cookie.
        threadContext = HTTPPluginControl.getThreadHTTPClientContext()
        CookieModule.addCookie(self.linkdrop_cookie, threadContext)
        send(self.userid, self.csrf)

    # wrap the work in a grinder 'Test' - the unit where stats are collected.
    doit = Test(1, "send with oauth").wrap(doit)

    def __call__(self):
        """This method is called for every run performed by the worker thread."""
        TestRunner.doit(self)




