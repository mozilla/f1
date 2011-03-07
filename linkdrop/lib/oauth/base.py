# based on code from velruse

import urlparse
try:
    from urlparse import parse_qs
except ImportError:
    from cgi import parse_qs
import json
import httplib2
import oauth2 as oauth
import logging

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from paste.deploy.converters import asbool

log = logging.getLogger("oauth.base")

class OAuthKeysException(Exception):
    pass

class AccessException(Exception):
    pass

def get_oauth_config(provider):
    key = 'oauth.'+provider+'.'
    keylen = len(key)
    d = {}
    for k,v in config.items():
        if k.startswith(key):
            d[k[keylen:]] = v
    return d

class OAuth1():
    def __init__(self, provider):
        self.provider = provider
        self.config = get_oauth_config(provider)
        self.request_token_url = self.config.get('request')
        self.access_token_url = self.config.get('access')
        self.authorization_url = self.config.get('authorize')
        self.version = int(self.config.get('version', '1'))
        self.scope = self.config.get('scope', None)
        assert self.version == 1
        self.consumer_key = self.config.get('consumer_key')
        self.consumer_secret = self.config.get('consumer_secret')
        self.consumer = oauth.Consumer(self.consumer_key, self.consumer_secret)
        self.sigmethod = oauth.SignatureMethod_HMAC_SHA1()

    def request_access(self):
        session['end_point_success'] = request.POST.get('end_point_success', self.config.get('oauth_success'))
        session['end_point_auth_failure'] = request.POST.get('end_point_auth_failure', self.config.get('oauth_failure'))
        force_login = request.POST.get('force_login') and True

        # Create the consumer and client, make the request
        client = oauth.Client(self.consumer)
        params = {'oauth_callback': url(controller='account',
                                        action="verify",
                                        provider=self.provider,
                                        qualified=True)}
        if self.scope:
            params[ 'scope' ] = self.scope
        
        # We go through some shennanigans here to specify a callback url
        oauth_request = oauth.Request.from_consumer_and_token(self.consumer,
            http_url=self.request_token_url, parameters=params)
        oauth_request.sign_request(self.sigmethod, self.consumer, None)
        resp, content = httplib2.Http.request(client, self.request_token_url, method='GET',
            headers=oauth_request.to_header())
            
        if resp['status'] != '200':
            raise AccessException("Error status: %r", resp['status'])
        
        request_token = oauth.Token.from_string(content)
        
        session['token'] = content
        session.save()
        
        # force_login is twitter specific
        if self.provider == 'twitter.com' and asbool(request.POST.get('force_login')):
            http_url=self.authorization_url+'?force_login=true'
        else:
            http_url=self.authorization_url

        # Send the user to the oauth provider to authorize us
        oauth_request = oauth.Request.from_token_and_callback(token=request_token, http_url=http_url)
        return redirect(oauth_request.to_url())

    def verify(self):
        request_token = oauth.Token.from_string(session['token'])
        verifier = request.GET.get('oauth_verifier')
        if not verifier:
            redirect(session.get('end_point_auth_failure',self.config.get('oauth_failure')))

        request_token.set_verifier(verifier)
        client = oauth.Client(self.consumer, request_token)
        resp, content = client.request(self.access_token_url, "POST")
        if resp['status'] != '200':
            redirect(session.get('end_point_auth_failure',self.config.get('oauth_failure')))

        access_token = dict(urlparse.parse_qsl(content))
        return self._get_credentials(access_token)

    def _get_credentials(self, access_token):
        return access_token

class OAuth2():
    def __init__(self, provider):
        self.provider = provider
        self.config = get_oauth_config(provider)
        self.access_token_url = self.config.get('access')
        self.authorization_url = self.config.get('authorize')
        self.version = int(self.config.get('version', '2'))
        assert self.version == 2
        self.app_id = self.config.get('app_id')
        self.app_secret = self.config.get('app_secret')
        self.scope = self.config.get('scope', None)

    def request_access(self):
        session['end_point_success'] = request.POST.get('end_point_success', self.config.get('oauth_success'))
        session['end_point_auth_failure'] = request.POST.get('end_point_auth_failure', self.config.get('oauth_failure'))
        session.save()

        return_to = url(controller='account', action="verify", provider=self.provider,
                           qualified=True)

        loc = url(self.authorization_url, client_id=self.app_id, scope=self.scope,
                       redirect_uri=return_to)
        return redirect(loc)

    def verify(self):
        code = request.GET.get('code')
        if not code:
            error = request.params.get('error', '')
            reason = request.params.get('error_reason', '')
            desc = request.params.get('error_description', 'No oauth code received')
            err = "%s - %s - %s" % (error, reason, desc)
            log.info("%s: %s", self.provider, err)
            raise AccessException(err)
        
        return_to = url(controller='account', action="verify", provider=self.provider,
                           qualified=True)

        access_url = url(self.access_token_url, client_id=self.app_id,
                client_secret=self.app_secret, code=code,
                redirect_uri=return_to)
        
        client = httplib2.Http()
        resp, content = client.request(access_url)
        if resp['status'] != '200':
            raise Exception("Error status: %s" % (resp['status'],))

        access_token = parse_qs(content)['access_token'][0]
        return self._get_credentials(access_token)

    def _get_credentials(self, access_token):
        return access_token
