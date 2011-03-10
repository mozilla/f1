
import urlparse
import json
import httplib2
import oauth2 as oauth
import logging
from rfc822 import AddressList

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from paste.deploy.converters import asbool
from linkdrop.lib.oauth.base import OAuth1, get_oauth_config, OAuthKeysException

from linkdrop.lib.base import render
from linkdrop.lib.helpers import safeHTML, literal

domain = 'linkedin.com'
log = logging.getLogger(domain)


def extract_li_data(user):
    poco = {
        'displayName': "%s %s" % (user.get('firstName'), user.get('lastName'),),
    }
    if user.get('publicProfileUrl', False):
        poco['urls'] = [ { 'type': u'profile', "primary" : False, "value" : user['publicProfileUrl'] }]
    if user.get('siteStandardProfileRequest', False):
        poco['urls'] = [ { 'type': u'profile', "primary" : True, "value" : user['siteStandardProfileRequest']['url'] }]
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
        fields = 'id,first-name,last-name,picture-url,public-profile-url,site-standard-profile-request'
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
        try:
            self.oauth_token = oauth.Token(key=account.get('oauth_token'), secret=account.get('oauth_token_secret'))
        except ValueError, e:
            # missing oauth tokens, raise our own exception
            raise OAuthKeysException(str(e))
        self.consumer_key = self.config.get('consumer_key')
        self.consumer_secret = self.config.get('consumer_secret')
        self.consumer = oauth.Consumer(key=self.consumer_key, secret=self.consumer_secret)
        self.sigmethod = oauth.SignatureMethod_HMAC_SHA1()

    def rawcall(self, url, body=None, method="GET"):
        client = oauth.Client(self.consumer, self.oauth_token)

        oauth_request = oauth.Request.from_consumer_and_token(self.consumer, token=self.oauth_token, http_url=url, http_method=method)
        oauth_request.sign_request(self.sigmethod, self.consumer, self.oauth_token)
        headers = oauth_request.to_header()
        headers['x-li-format'] = 'json'
        
        body = json.dumps(body)
        headers['Content-type'] = 'application/json'
        headers['Content-Length'] = str(len(body))
        
        resp, content = httplib2.Http.request(client, url, method=method, headers=headers, body=body)

        data = content and json.loads(content) or resp

        result = error = None
        status = int(resp['status'])
        if status < 200 or status >= 300:
            error = data
        else:
            result = data

        return result, error

    def sendmessage(self, message, options={}):
        direct = options.get('to', 'anyone')
        if direct in ('anyone', 'connections-only'):
            url = "http://api.linkedin.com/v1/people/~/shares"
            body = {
                "comment": message,
                "content": {
                    "title": options.get('subject', ''),
                    "submitted-url": options.get('link', ''),
                    "submitted-image-url": options.get('picture', ''),
                    "description": options.get('description', ''),
                },
                "visibility": {
                    "code": direct
                }
            }
        else:
            # we have to do a direct message, different api
            url = "http://api.linkedin.com/v1/people/~/mailbox"

            profile = self.account.get('profile', {})
            from_email = from_ = profile.get('verifiedEmail')
            fullname = profile.get('displayName', None)

            to_addrs = AddressList(options['to'])
            subject = options.get('subject', config.get('share_subject', 'A web link has been shared with you'))
            title = options.get('title', options.get('link', options.get('shorturl', '')))
            description = options.get('description', '')[:280]

            to_ = []
            for a in to_addrs.addresslist:
                to_.append({'person': {'_path': '/people/'+a[1] }})

            c.safeHTML = safeHTML
            c.options = options
            
            # insert the url if it is not already in the message
            c.longurl = options.get('link')
            c.shorturl = options.get('shorturl')
            
            # get the title, or the long url or the short url or nothing
            # wrap these in literal for text email
            c.from_name = literal(fullname)
            c.subject = literal(subject)
            c.from_header = literal(from_)
            c.to_header = literal(to_)
            c.title = literal(title)
            c.description = literal(description)
            c.message = literal(message)
    
            text_message = render('/text_email.mako').encode('utf-8')
            
            body = { 
                'recipients': {'values': to_},
                'subject': subject,
                'body': text_message
            }
        return self.rawcall(url, body, method="POST")

    def getcontacts(self, start=0, page=25, group=None):
        contacts = []
        url = 'http://api.linkedin.com/v1/people/~/connections?count=%d' % (page,)
        method = 'GET'
        if start > 0:
            url = url + "&start=%d" % (start,)

        result, error = self.rawcall(url, method="GET")
        if error:
            return result, error

        # poco-ize the results
        entries = result.get('values', [])
        contacts = []
        for entry in entries:
            contacts.append(extract_li_data(entry))
            
        connectedto = {
            'entry': contacts,
            'itemsPerPage': result.get('_count', result.get('_total', 0)),
            'startIndex':   result.get('_start', 0),
            'totalResults': result.get('_total'),
        }

        return connectedto, error

