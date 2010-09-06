# partially based on code from velruse

import urlparse
import json
import httplib2
import oauth2 as oauth

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from linkdrop.lib.oauth.base import OAuth1, get_oauth_config

domain = 'twitter.com'

class responder(OAuth1):
    """Handle Twitter OAuth login/authentication"""
    domain = 'twitter.com'

    def __init__(self):
        OAuth1.__init__(self, domain)
        self.request_token_url = 'https://twitter.com/oauth/request_token'
        self.access_token_url = 'https://twitter.com/oauth/access_token'
        self.authorization_url = 'https://twitter.com/oauth/authenticate'

    def _get_credentials(self, access_token):
        # XXX should call twitter.api.VerifyCredentials to get the user object
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

class api():
    def __init__(self, account):
        self.oauth_token = account.oauth_token
        self.oauth_token_secret = account.oauth_token_secret
        self.config = get_oauth_config(domain)

    def rawcall(self, url, body):
        raise Exception("NOT IMPLEMENTED")

    def sendmessage(self, message, options={}):
        from twitter.oauth import OAuth
        from twitter.api import Twitter, TwitterHTTPError
        auth = OAuth(token=self.oauth_token,
                     token_secret=self.oauth_token_secret,
                     consumer_key=self.config['consumer_key'],
                     consumer_secret=self.config['consumer_secret'])
        result = error = None
        try:
            api = Twitter(auth=auth)
            result = api.statuses.update(status=message)
            result[domain] = result['id']
        except TwitterHTTPError, exc:
            details = json.load(exc.e)
            if 'error' in details:
                msg = details['error']
            else:
                msg = str(details)
            error = {'provider': domain,
                     'reason': msg,
            }
        return result, error
