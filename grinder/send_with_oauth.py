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

# The URL of the server we want to hit.
url0 = 'http://127.0.0.1:5000'

# *sob* - failed to get json packages working.  Using 're' is an option,
# although it requires you install jython2.5 (which still doesn't have
# json builtin) - so to avoid all that complication, hack 'eval' into
# working for us...
_json_ns = {'null': None}
def json_loads(val):
    return eval(val, _json_ns)
    
# Set up a cookie handler to accept all cookies
class MyCookiePolicyHandler(CookiePolicyHandler):
    def acceptCookie(self, cookie, request, response):
        return 1

    def sendCookie(self, cookie, request):
        return 1

CookieModule.setCookiePolicyHandler(MyCookiePolicyHandler())
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

class TestRunner:
  """A TestRunner instance is created for each worker thread."""
  def __init__(self):
      self.csrf = None

  # A method for each recorded page.
  def fetchAccounts(self):
    threadContext = HTTPPluginControl.getThreadHTTPClientContext()
    CookieModule.discardAllCookies(threadContext)
    result = request1.GET(url0 + '/api/account/get')
    for cookie in CookieModule.listAllCookies(threadContext):
        if cookie.name == "csrf":
            self.csrf = cookie.value
            break
    return result

  def authTwitter(self):
    # Call authorize requesting we land back on /account/get - after
    # a couple of redirects for auth, we should wind up with the data from
    # account/get - which should now include our account info.
    result = request1.POST(url0 + '/api/account/authorize',
      ( NVPair('csrftoken', self.csrf),
        NVPair('domain', 'twitter.com'),
        NVPair('end_point_success', '/api/account/get'),
        NVPair('end_point_auth_failure', '/send/auth.html#oauth_failure'), ),
      ( NVPair('Content-Type', 'application/x-www-form-urlencoded'), ))

    data = json_loads(result.getText())
    assert data, 'account/get failed to return data'
    userid = data[0]['accounts'][0]['userid']
    return userid

  def send(self, userid):
    """POST send (requests 1201-1202)."""
    result = request1.POST(url0 + '/api/send',
      ( NVPair('domain', 'twitter.com'),
        NVPair('userid', userid),
        NVPair('csrftoken', self.csrf),
        NVPair('message', 'take that!'), ),
      ( NVPair('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8'), ))

    return result

  def doit(self):
    self.fetchAccounts()
    userid = self.authTwitter()
    self.send(userid)

  # wrap the work in a grinder 'Test' - the unit where stats are collected.
  doit = Test(1, "send with oauth").wrap(doit)

  def __call__(self):
    """This method is called for every run performed by the worker thread."""
    self.doit()
