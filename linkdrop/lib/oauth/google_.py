"""Google Responder

A Google responder that authenticates against Google using OpenID, or optionally
can use OpenId+OAuth hybrid protocol to request access to Google Apps using OAuth2.

"""
import urlparse

from openid.extensions import ax
import oauth2 as oauth

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect

from linkdrop.lib.oauth.oid_extensions import OAuthRequest
from linkdrop.lib.oauth.oid_extensions import UIRequest
from linkdrop.lib.oauth.openidconsumer import ax_attributes, alternate_ax_attributes, attributes
from linkdrop.lib.oauth.openidconsumer import OpenIDResponder

GOOGLE_OAUTH = 'https://www.google.com/accounts/OAuthGetAccessToken'

domain = 'google.com'

class responder(OpenIDResponder):
    def __init__(self, consumer=None, oauth_key=None, oauth_secret=None, request_attributes=None, *args,
                 **kwargs):
        """Handle Google Auth
        
        This also handles making an OAuth request during the OpenID
        authentication.
        
        """
        OpenIDResponder.__init__(self, domain)
        self.consumer_key = self.config.get('consumer_key')
        self.consumer_secret = self.config.get('consumer_secret')

    def _lookup_identifier(self, identifier):
        """Return the Google OpenID directed endpoint"""
        return "https://www.google.com/accounts/o8/id"
    
    def _update_authrequest(self, authrequest):
        """Update the authrequest with Attribute Exchange and optionally OAuth
        
        To optionally request OAuth, the request POST must include an ``oauth_scope``
        parameter that indicates what Google Apps should have access requested.
        
        """
        request_attributes = request.POST.get('ax_attributes',
                                           ['country', 'email', 'first_name', 'last_name', 'language'])
        ax_request = ax.FetchRequest()
        for attr in request_attributes:
            ax_request.add(ax.AttrInfo(attributes[attr], required=True))
        authrequest.addExtension(ax_request)
        
        oauth_request = OAuthRequest(consumer=self.consumer_key, scope=request.POST.get('scope', 'http://www.google.com/m8/feeds/'))
        authrequest.addExtension(oauth_request)
        
        if 'popup_mode' in request.POST:
            kw_args = {'mode': request.POST['popup_mode']}
            if 'popup_icon' in request.POST:
                kw_args['icon'] = request.POST['popup_icon']
            ui_request = UIRequest(**kw_args)
            authrequest.addExtension(ui_request)
        return None
    
    def _get_access_token(self, request_token):
        """Retrieve the access token if OAuth hybrid was used"""
        consumer = oauth.Consumer(self.consumer_key, self.consumer_secret)
        token = oauth.Token(key=request_token, secret='')
        client = oauth.Client(consumer, token)
        resp, content = client.request(GOOGLE_OAUTH, "POST")
        if resp['status'] != '200':
            return None

        return dict(urlparse.parse_qsl(content))

    def _get_credentials(self, result_data):
        
        #{'profile': {'preferredUsername': u'mixedpuppy',
        #     'displayName': u'Shane Caraveo',
        #     'name':
        #        {'givenName': u'Shane',
        #         'formatted': u'Shane Caraveo',
        #         'familyName': u'Caraveo'},
        #        'providerName': 'Google',
        #        'verifiedEmail': u'mixedpuppy@gmail.com',
        #        'identifier': 'https://www.google.com/accounts/o8/id?id=AItOawnEHbJcEY5EtwX7vf81_x2P4KUjha35VyQ'}}
        profile = result_data['profile']
        userid = profile['verifiedEmail']
        username = profile['preferredUsername']
        profile['emails'] = [{ 'value': userid, 'primary': True }]
        account = {'domain': domain,
                   'userid': userid,
                   'username': username }
        profile['accounts'] = [account]
        return result_data
