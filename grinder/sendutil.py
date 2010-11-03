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

def getCSRF():
    threadContext = HTTPPluginControl.getThreadHTTPClientContext()
    CookieModule.discardAllCookies(threadContext)
    result = request1.GET(url0 + '/api/account/get')
    assert result.getStatusCode()==200, result
    csrf = linkdrop = None
    for cookie in CookieModule.listAllCookies(threadContext):
        if cookie.name == "linkdrop":
            linkdrop = cookie
        if cookie.name == "csrf":
            csrf = cookie.value
    assert csrf and linkdrop
    return csrf, linkdrop

def authTwitter(csrf):
    # Call authorize requesting we land back on /account/get - after
    # a couple of redirects for auth, we should wind up with the data from
    # account/get - which should now include our account info.
    result = request1.POST(url0 + '/api/account/authorize',
      ( NVPair('csrftoken', csrf),
        NVPair('domain', 'twitter.com'),
        NVPair('end_point_success', '/api/account/get'),
        NVPair('end_point_auth_failure', '/send/auth.html#oauth_failure'), ),
      ( NVPair('Content-Type', 'application/x-www-form-urlencoded'), ))
    assert result.getStatusCode()==200, result
    data = json_loads(result.getText())
    assert data, 'account/get failed to return data'
    userid = data[0]['accounts'][0]['userid']
    return userid

def send(userid, csrf, domain="twitter.com", message="take that!"):
    """POST send."""
    result = request1.POST(url0 + '/api/send',
      ( NVPair('domain', domain),
        NVPair('userid', userid),
        NVPair('csrftoken', csrf),
        NVPair('message', message), ),
      ( NVPair('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8'), ))
    assert result.getStatusCode()==200, result
    assert '"error": null' in result.getText(), result.getText()
    return result
