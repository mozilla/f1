from pylons import url
from pylons.util import call_wsgi_application
from webob import Request, Response
import json

from openid.consumer.consumer import Consumer, SUCCESS, FAILURE, DiscoveryFailure
from openid.extensions import ax, pape, sreg
from openid.store import memstore, filestore, sqlstore
from openid import extension
import urllib, urlparse, sys

import oauth2 as oauth
from webob.exc import status_map
import random
import logging

log = logging.getLogger(__name__)

# openid prefers to use pycurl if available, but that package has a limited
# certificate store and fails to validate the google openid url.
# See http://www.cozmanova.com/node/8 for a way to manually install the
# needed certificates, but for now we just tell openid to prefer urllib2.
# (XXX - presumably this means *no* certificate validation is done, which
# probably isn't a good thing...)
try:
    import pycurl
except ImportError:
    pass
else:
    log.warn("pycurl is installed which means openid authentication will use"
             " ssl certificate validation (good!) but by default the correct"
             " CA certificates are *not* installed meaning the validation"
             " fails (bad!).  Thus, raindrop is arranging to not use pycurl"
             " so will not perform certificate validation (bad!)  This should"
             " be resolved and %r updated accordingly.", __file__)
    from openid.fetchers import Urllib2Fetcher, setDefaultFetcher
    setDefaultFetcher(Urllib2Fetcher())

authentication_token_key = "_authentication_token"

def redirect(url, code=302):
    """Raises a redirect exception to the specified URL

    Optionally, a code variable may be passed with the status code of
    the redirect, ie::

        redirect(url(controller='home', action='index'), code=303)

    """
    exc = status_map[code]
    return exc(location=url)


def abort(status_code=None, detail="", headers=None, comment=None):
    """Aborts the request immediately by returning an HTTP exception
    
    In the event that the status_code is a 300 series error, the detail
    attribute will be used as the Location header should one not be
    specified in the headers attribute.
    
    """
    return status_map[status_code](detail=detail, headers=headers, 
                                  comment=comment)

class OpenIDOAuthRequest(extension.Extension):
    """OAuth extension"""
    ns_uri = 'http://specs.openid.net/extensions/oauth/1.0'
    ns_alias = 'oauth'
    
    def __init__(self, consumer, scope=None):
        super(OpenIDOAuthRequest, self).__init__()
        self._args = {'consumer': consumer}
        if scope:
            self._args['scope'] = scope
    
    def getExtensionArgs(self):
        return self._args


class OpenIDMiddleware(object):
    
    def __init__(self, app, config):
        self.app = app
        self.config = config
        store = config.get('openid_store', 'mem')
        if store==u"file":
            store_file_path = config.get('openid_store_path', None)
            self.openid_store = filestore.FileOpenIDStore(store_file_path)
        elif store==u"mem":
            self.openid_store = memstore.MemoryStore()
        elif store==u"sql":
            # TODO: This does not work as we need a connection, not a string
            self.openid_store = sqlstore.SQLStore(sql_connstring, sql_associations_table, sql_connstring)
        self.environ_config = config['pylons.environ_config']
        self._session_key = self.environ_config.get('session', 'beaker.session')
        self.root_path = config.get('openid.root')
        self.login_path = config.get('openid.login')

    def __call__(self, environ, start_response):
        # lookup the user and set user information into the environment
        request = Request(environ)
        session = environ[self._session_key]
        openid_session = session.get('openid.session')
        auth_token = session.get(authentication_token_key)
        environ['CSRF_TOKEN'] = auth_token
        path_info = environ['PATH_INFO']
        rcvd_auth_token = environ.get('HTTP_X_RAINDROP_TOKEN') or request.params.get('rd-token')
        #print "openid session: ", openid_session
        #print "   PATH_INFO:             ",path_info
        #print "   session auth token:    ",auth_token
        #print "   HTTP_X_RAINDROP_TOKEN: ",rcvd_auth_token

        # if /signin or /signout handle it ourselves
        if path_info == '/signin':
            return self.signin(request, environ, start_response)
        elif path_info == '/verified':
            return self.verified(request, environ, start_response)
        elif path_info == '/signout':
            return self.signout(request, environ, start_response)
        elif not openid_session:
            # Force skip the StatusCodeRedirect middleware; it was stripping
            #   the WWW-Authenticate header from the 401 response
            session.clear()
            session.save()
            environ['pylons.status_code_redirect'] = True
            return abort(401, 'You are not authenticated')(environ, start_response)
        elif not auth_token or not rcvd_auth_token == auth_token:
            # CSRF attack?  We have a session without the auth token, or the
            # token sent to us in the api call does not match, either the
            # token is fake or from an old expired session
            session.clear()
            session.save()
            environ['pylons.status_code_redirect'] = True
            return abort(401, 'You are not authenticated')(environ, start_response)

        # pass on to the next level
        status, headers, app_iter, exc_info = call_wsgi_application(
            self.app, environ, catch_exc_info=True)
        start_response(status, headers, exc_info)
        return app_iter

    def signin(self, request, environ, start_response):
        return_to = request.params.get('return_to', None)
        session = environ[self._session_key]
        openid_session = session.get('openid.session')
        if openid_session:
            session.clear()
        openid_session = {}
            #return redirect(return_to or self.root_path)
        consumer = Consumer(openid_session, self.openid_store)
        openid = request.params.get('openid', None)
        if openid is None:
            session.save()
            log.info('redirecting to %r for login', self.login_path)
            return redirect(self.login_path)(environ, start_response)
        try:
            authrequest = consumer.begin(openid)
        except DiscoveryFailure, e:
            session.save()
            log.info('redirecting to %r due to openid discovery failure: %s', self.login_path, e)
            return redirect(self.login_path)(environ, start_response)

        sreg_optional = [a.strip() for a in request.params.get('sreg_optional',"").split(',') if a]
        sreg_required = [a.strip() for a in request.params.get('sreg_required',"").split(',') if a]

        if sreg_optional or sreg_required:
            sreg_request = sreg.SRegRequest(optional=sreg_optional,
                                            required=sreg_required)
            authrequest.addExtension(sreg_request)

        ax_optional = [a.strip() for a in request.params.get('ax_optional',"").split(',') if a]
        ax_required = [a.strip() for a in request.params.get('ax_required',"").split(',') if a]

        if ax_optional or ax_required:
            # Add Attribute Exchange request information.
            ax_request = ax.FetchRequest()
            for axu in ax_optional:
                ax_request.add(ax.AttrInfo(axu, required=False, count=1))
            for axu in ax_required:
                ax_request.add(ax.AttrInfo(axu, required=True, count=1))
            authrequest.addExtension(ax_request)

        # Add PAPE request information. We'll ask for
        # phishing-resistant auth and display any policies we get in
        # the response.  Setting max_auth_age to zero will force a login.
        requested_policies = []
        policy_prefix = 'policy_'
        for k, v in request.params.iteritems():
            if k.startswith(policy_prefix):
                policy_attr = k[len(policy_prefix):]
                requested_policies.append(getattr(pape, policy_attr))

        pape_request = pape.Request(requested_policies,
                                    max_auth_age=request.params.get('pape_max_auth_age',None))
        authrequest.addExtension(pape_request)

        # XXX openid+oauth failes because google requires a valid DNS, which
        # means we cannot openid+oauth for desktop apps
        #if 'oauth_scope' in request.params:
        #    oauth_request = OpenIDOAuthRequest(consumer=request.application_url, scope=request.params['oauth_scope'])
        #    authrequest.addExtension(oauth_request)

        #if 'popup_mode' in request.params:
        #    kw_args = {'mode': request.params['popup_mode']}
        #    if 'popup_icon' in request.params:
        #        kw_args['icon'] = request.params['popup_icon']
        #    ui_request = UIRequest(**kw_args)
        #    authrequest.addExtension(ui_request)
        url = environ['routes.url']
        next_url = url('/verified', qualified=True)
        if return_to:
            next_url = next_url+"?origin=%s" %(urllib.quote(return_to), )
            
        redirecturl = authrequest.redirectURL(request.application_url,
            return_to=next_url,
            immediate=False
        )
        session['openid_session'] = openid_session
        session.save()

        #print >> sys.stderr, redirecturl
        # OpenID 2.0 lets Providers request POST instead of redirect, this
        # checks for such a request.
        if authrequest.shouldSendRedirect():
            redirecturl = authrequest.redirectURL(request.application_url,
                return_to=next_url,
                immediate=False
            )
            return redirect(redirect_url)(environ, start_response)

        else:
            html = authrequest.htmlMarkup(realm=request.application_url, return_to=next_url, 
                                          immediate=False)
            return Response(body=html)(environ, start_response)

    def verified(self, request, environ, start_response):
        return_to = request.params.get('origin', None)
        url = environ['routes.url']
        session = environ[self._session_key]
        openid_session = session.get('openid.session', {})
        if openid_session:
            return redirect(return_to or self.root_path)(environ, start_response)
        consumer = Consumer(openid_session, self.openid_store)
        info = consumer.complete(request.params,(url('/verified', qualified=True)))
        if info.status == SUCCESS:
            identity = {} # our poco object
            identity_url = info.identity_url
            if info.endpoint.canonicalID:
                # If it's an i-name, use the canonicalID as its secure even if
                # the old one is compromised
                identity_url = info.endpoint.canonicalID
            identity['urls'] = [ { 'type': 'identity', 'value': identity_url } ]
            identity['source'] = identity_url
            nickname = fullname = email = first = last = None

            # Get a Simple Registration response object if response
            # information was included in the OpenID response.
            sreg_response = sreg.SRegResponse.fromSuccessResponse(info)
            if sreg_response:
                items = sreg_response.data
                fullname = items.get('fullname', None)
                nickname = items.get('nickname', None)
                email = items.get('email', None)

            ax_response = ax.FetchResponse.fromSuccessResponse(info)
            if ax_response:
                items = ax_response.data
                first = items.get('http://axschema.org/namePerson/first', None)
                if first: first = first[0]
                last = items.get('http://axschema.org/namePerson/last', None)
                if last: last = last[0]
                email = items.get('http://axschema.org/contact/email', None)
                if email: email = email[0]

            # Get a PAPE response object if response information was
            # included in the OpenID response.
            pape_response = pape.Response.fromSuccessResponse(info)

            if not pape_response.auth_policies:
                pape_response = None
            identity['pape_data'] = pape_response

            #oauth = info.extensionResponse('http://specs.openid.net/extensions/oauth/1.0', False)
            #if oauth and 'request_token' in oauth:
            #    access_token = self._get_access_token(oauth['request_token'], request.application_url)
            #    if access_token:
            #        identity['credentials'] = access_token

            if first and last:
                identity['displayName'] = "%s %s" % (first, last)
            elif fullname:
                identity['displayName'] = fullname
            if nickname:
                identity['nickname'] = nickname
            if first or last:
                identity['name'] = {}
                if first:
                    identity['name']['givenName'] = first
                if last:
                    identity['name']['familyName'] = last
            if email:
                identity['emails'] = [{ 'value': email }]
            #print >> sys.stderr, identity
            
            session.clear()
            session['openid.identity'] = json.dumps(identity)
            session['openid.session'] = info.identity_url
            token = str(random.getrandbits(128))
            session[authentication_token_key] = token
            session.save()
            
            redirect_url = return_to or self.login_path
            newurl = redirect_url.split('#')
            if '?' in newurl:
                redirect_url = newurl[0]+'&rd-token='+token
            else:
                redirect_url = newurl[0]+'?rd-token='+token
            if len(newurl) > 1:
                redirect_url += '#'+newurl[1]

            #import sys; print >> sys.stderr, repr(session)
            #import sys; print >> sys.stderr, repr(identity)
            return redirect(redirect_url)(environ, start_response)
        else:
            session.clear()
            session.save()
            return redirect(self.login_path)(environ, start_response)

    def signout(self, request, environ, start_response):
        if self._session_key in environ:
            session = environ[self._session_key]
            session.clear()
            session.save()
        return redirect(self.root_path)(environ, start_response)

    #def _get_access_token(self, request_token, consumer_key):
    #    """Retrieve the access token if OAuth hybrid was used"""
    #    GOOGLE_OAUTH = 'https://www.google.com/accounts/OAuthGetAccessToken'
    #    consumer = oauth.Consumer(key=consumer_key, secret=OAUTH_CONFIG_GMAIL['consumer_secret'])
    #    token = oauth.Token(key=request_token, secret='')
    #    client = oauth.Client(consumer, token)
    #    resp, content = client.request(GOOGLE_OAUTH, "POST")
    #    if resp['status'] != '200':
    #        return None
    #    
    #    access_token = dict(urlparse.parse_qsl(content))
    #    
    #    return {'oauthAccessToken': access_token['oauth_token'],
    #            'oauthAccessTokenSecret': access_token['oauth_token_secret']}

