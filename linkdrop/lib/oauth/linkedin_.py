
import urlparse
import json
import httplib2
import oauth2 as oauth
import logging

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from paste.deploy.converters import asbool
from linkdrop.lib.oauth.base import OAuth1, get_oauth_config

domain = 'linkedin.com'
log = logging.getLogger(domain)

def extract_li_data(user):
    poco = {
        'displayName': "%s %s" % (user.get('firstName'), user.get('lastName'),),
    }
    if user.get('publicProfileUrl', False):
        poco['urls'] = [ { "primary" : False, "value" : user['publicProfileUrl'] }]
    if user.get('pictureUrl', False):
        poco['photos'] = [ { 'type': u'profile', "value" : user['pictureUrl'] }]

    account = {'domain': domain,
               'userid': user.get("id"),
               'username': "" }
    poco['accounts'] = [account]

    return poco

class responder(OAuth1):
    """Handle LinkedId OAuth login/authentication"""
    domain = 'linkedin.com'

    def __init__(self):
        OAuth1.__init__(self, domain)

    def _get_credentials(self, access_token):
        fields = 'id,first-name,last-name,picture-url,public-profile-url'
        profile_url = "http://api.linkedin.com/v1/people/~:(%s)" % (fields,)

        consumer = oauth.Consumer(self.consumer_key, self.consumer_secret)
        token = oauth.Token(access_token['oauth_token'], access_token['oauth_token_secret'])
        client = oauth.Client(consumer, token)

        oauth_request = oauth.Request.from_consumer_and_token(self.consumer, token=token, http_url=profile_url)
        oauth_request.sign_request(self.sigmethod, self.consumer, token)
        headers = oauth_request.to_header()
        headers['x-li-format'] = 'json'
        resp, content = httplib2.Http.request(client, profile_url, method='GET', headers=headers)

        if resp['status'] != '200':
             raise Exception("Error status: %r", resp['status'])

        li_profile = json.loads(content)
        profile = extract_li_data(li_profile)
        result_data = {'profile': profile,
                       'oauth_token': access_token['oauth_token'], 
                       'oauth_token_secret': access_token['oauth_token_secret']}
        return result_data


class api():
    def __init__(self, account):
        self.config = get_oauth_config(domain)
        self.account = account
        self.oauth_token = oauth.Token(key=account.get('oauth_token'), secret=account.get('oauth_token_secret'))
        self.consumer_key = self.config.get('consumer_key')
        self.consumer_secret = self.config.get('consumer_secret')
        self.consumer = oauth.Consumer(key=self.consumer_key, secret=self.consumer_secret)
        self.sigmethod = oauth.SignatureMethod_HMAC_SHA1()

