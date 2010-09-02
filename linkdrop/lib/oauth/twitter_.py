# based on code from velruse

import urlparse
import json
import httplib2
import oauth2 as oauth

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from linkdrop.lib.oauth.base import OAuth1

class TwitterResponder(OAuth1):
    """Handle Twitter OAuth login/authentication"""
    domain = 'twitter.com'

    def __init__(self):
        OAuth1.__init__(self, self.domain)
        self.request_token_url = 'https://twitter.com/oauth/request_token'
        self.access_token_url = 'https://twitter.com/oauth/access_token'
        self.authorization_url = 'https://twitter.com/oauth/authenticate'

    def get_credentials(self, access_token):
        # Setup the normalized poco contact object
        username = access_token['screen_name']
        userid = access_token['user_id']

        profile = {}
        profile['providerName'] = 'Twitter'
        profile['displayName'] = username
        profile['identifier'] = 'http://twitter.com/?id=%s' % userid

        account = {'domain': 'twitter.com',
                   'userid': userid,
                   'username': username }
        profile['accounts'] = [account]

        result_data = {'profile': profile,
                       'oauth_token': access_token['oauth_token'], 
                       'oauth_token_secret': access_token['oauth_token_secret']}
    
        return result_data
