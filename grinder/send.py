# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Raindrop.
#
# The Initial Developer of the Original Code is
# Mozilla Messaging, Inc..
# Portions created by the Initial Developer are Copyright (C) 2009
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#

# The Grinder 3.4
# HTTP script originally recorded by TCPProxy, but then hacked...

from net.grinder.script import Test
from net.grinder.script.Grinder import grinder
from net.grinder.plugin.http import HTTPPluginControl, HTTPRequest
from HTTPClient import NVPair
from HTTPClient import Cookie, CookieModule, CookiePolicyHandler

connectionDefaults = HTTPPluginControl.getConnectionDefaults()

# Decode gzipped responses
connectionDefaults.useContentEncoding = 1
# in ms
connectionDefaults.setTimeout(60000)

httpUtilities = HTTPPluginControl.getHTTPUtilities()

log = grinder.logger.output

# Properties read from the grinder .properties file.
# After how many 'send' requests should we perform oauth?  This is to
# simulate cookie expiry or session timeouts.
sends_per_oauth = grinder.getProperties().getInt("linkdrop.sends_per_oauth", 0)

# The URL of the server we want to hit.
linkdrop_host = grinder.getProperties().getProperty("linkdrop.host", 'http://127.0.0.1:5000')

# Service we want to test
linkdrop_service = grinder.getProperties().getProperty("linkdrop.service", 'twitter.com')

# Static URL we want to hit
linkdrop_static_url = grinder.getProperties().getProperty("linkdrop.static_url", '/share/')

# How often we want to hit the static page per send
linkdrop_static_per_send = grinder.getProperties().getInt("linkdrop.static_per_send", 0)

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

def authService():
    threadContext = HTTPPluginControl.getThreadHTTPClientContext()
    CookieModule.discardAllCookies(threadContext)
    # Call authorize requesting we land back on /account/get - after
    # a couple of redirects for auth, we should wind up with the data from
    # account/get - which should now include our account info.
    result = request1.POST(linkdrop_host + '/api/account/authorize',
      (
        NVPair('domain', linkdrop_service),
        NVPair('end_point_success', '/api/account/get'),
        NVPair('end_point_auth_failure', '/current/send/auth.html#oauth_failure'), ),
      ( NVPair('Content-Type', 'application/x-www-form-urlencoded'), ))
    assert result.getStatusCode()==200, result
    data = json_loads(result.getText())
    assert data, 'account/get failed to return data'
    userid = data[0]['accounts'][0]['userid']
    for cookie in CookieModule.listAllCookies(threadContext):
        if cookie.name == "linkdrop":
            linkdrop_cookie = cookie
    assert linkdrop_cookie
    return userid, linkdrop_cookie

authService = Test(3, "auth %s" % linkdrop_service).wrap(authService)

def send(userid, domain=linkdrop_service, message="take that!"):
    """POST send."""
    assert userid, 'userid id set'
    result = request1.POST(linkdrop_host + '/api/send',
      ( NVPair('domain', domain),
        NVPair('userid', userid),
        # NOTE: no 'link' as we don't want to hit bitly in these tests
        # (and if we ever decide we do, we must not use the bitly production
        # userid and key!)
        # NVPair('link', "http://www.google.com/%s" % grinder.getRunNumber() ),
        NVPair('message', message), ),
      ( NVPair('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8'), ))
    assert result.getStatusCode()==200, result
    assert '"error": null' in result.getText(), result.getText()
    return result

send = Test(4, "Send message").wrap(send)

def getStatic(url="/share/"):
    result = request1.GET(linkdrop_host + url)
    assert result.getStatusCode()==200, result
    return result

getStatic = Test(5, "Static request").wrap(getStatic)

# The test itself.
class TestRunner:
    """A TestRunner instance is created for each worker thread."""
    def __init__(self):
        self.linkdrop_cookie = None
        self.userid = None

    def doit(self):
        if linkdrop_static_per_send:
            for i in range(0,linkdrop_static_per_send):
                getStatic(linkdrop_static_url)
            
        if (sends_per_oauth and grinder.getRunNumber() % sends_per_oauth==0):
            self.linkdrop_cookie = None
            self.userid = None

        if self.userid is None:
            self.userid, self.linkdrop_cookie = authService()
        
        # cookies are reset by the grinder each test run - re-inject the
        # linkdrop session cookie.
        threadContext = HTTPPluginControl.getThreadHTTPClientContext()
        CookieModule.addCookie(self.linkdrop_cookie, threadContext)
        send(self.userid)

    # wrap the work in a grinder 'Test' - the unit where stats are collected.
    doit = Test(1, "send with oauth").wrap(doit)

    def __call__(self):
        """This method is called for every run performed by the worker thread."""
        TestRunner.doit(self)
