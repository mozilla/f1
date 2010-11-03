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

import urlparse

from openid.extensions import ax
import oauth2 as oauth
import httplib2
import json
import copy

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from paste.deploy.converters import asbool

from linkdrop.lib.oauth.oid_extensions import OAuthRequest
from linkdrop.lib.oauth.oid_extensions import UIRequest
from linkdrop.lib.oauth.openidconsumer import ax_attributes, alternate_ax_attributes, attributes
from linkdrop.lib.oauth.openidconsumer import OpenIDResponder
from linkdrop.lib.oauth.base import get_oauth_config

YAHOO_OAUTH = 'https://api.login.yahoo.com/oauth/v2/get_token'

domain = 'yahoo.com'

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
        if not asbool(self.config.get('verified')):
            self.return_to_query['domain_unverified']=1
        # yahoo openid only works in stateless mode, do not use the openid_store
        self.openid_store = None
    
    def _lookup_identifier(self, identifier):
        """Return the Yahoo OpenID directed endpoint"""
        return 'https://me.yahoo.com/'
    
    def _update_authrequest(self, authrequest):
        # Add on the Attribute Exchange for those that support that            
        request_attributes = request.POST.get('ax_attributes', ax_attributes.keys())
        ax_request = ax.FetchRequest()
        for attr in request_attributes:
            ax_request.add(ax.AttrInfo(attributes[attr], required=False, count=1))
        authrequest.addExtension(ax_request)
        
        # Add OAuth request?
        oauth_request = OAuthRequest(consumer=self.consumer_key)
        authrequest.addExtension(oauth_request)
        return None

    def _get_access_token(self, request_token):
        consumer = oauth.Consumer(self.consumer_key, self.consumer_secret)
        token = oauth.Token(key=request_token, secret='')
        client = oauth.Client(consumer, token)
        resp, content = client.request(YAHOO_OAUTH, "POST")
        if resp['status'] != '200':
            return None
        return dict(urlparse.parse_qsl(content))


    def _get_credentials(self, result_data):
        profile = result_data['profile']
        userid = profile['verifiedEmail']
        username = profile['preferredUsername']
        profile['emails'] = [{ 'value': userid, 'primary': True }]
        account = {'domain': domain,
                   'userid': userid,
                   'username': username }
        profile['accounts'] = [account]
        return result_data


class api():
    endpoints = {
        "mail":"http://mail.yahooapis.com/ws/mail/v1.1/jsonrpc"
    }

    def __init__(self, account):
        self.config = get_oauth_config(domain)
        self.account = account
        self.oauth_token = oauth.Token(key=account.get('oauth_token'), secret=account.get('oauth_token_secret'))
        self.consumer_key = self.config.get('consumer_key')
        self.consumer_secret = self.config.get('consumer_secret')
        self.consumer = oauth.Consumer(key=self.consumer_key, secret=self.consumer_secret)
        self.sigmethod = oauth.SignatureMethod_HMAC_SHA1()
         
    def rawcall(self, url, method, args):
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        # simple jsonrpc call
        postdata = json.dumps({"method": method, 'params': args, 'id':'jsonrpc'})
        postdata = postdata.encode("utf-8")

        oauth_request = oauth.Request.from_consumer_and_token(self.consumer,
                                                              token=self.oauth_token,
                                                              http_method='POST',
                                                              http_url=url)
        oauth_request.sign_request(self.sigmethod, self.consumer, self.oauth_token)
        headers.update(oauth_request.to_header())

        resp, content = httplib2.Http().request(url, 'POST', headers=headers, body=postdata)
        response = json.loads(content)
        result = error = None
        if 'id' in response:
            # this is a good thing
            error = response['error']
            if error:
                error = copy.copy(error)
                error.update({
                    'provider': domain,
                    'status': int(resp['status']),
                })
            return response['result'], error
        elif 'error' in response:
            error = copy.copy(error)
            error.update({ 'provider': domain, 'status': int(resp['status']) })
        else:
            error = {'provider': domain,
                     'message': "unexpected yahoo response: %r"% (response,),
                     'status': int(resp['status']) 
            }
            log.error("unexpected yahoo response: %r", response)

        return result, error

    def sendmessage(self, message, options={}):
        result = error = None
        from_ = self.account.get('profile',{}).get('verifiedEmail')
        to_ = options['to']
        subject = options.get('subject')

        params = [{
                "message":
                    {"subject":subject,
                     "from":{"email":from_},
                     "to":[{"email":to_}],
                     "body":{"data": message,
                             "type":"text",
                             "subtype":"plain",
                             "charset":"us-ascii"
                             }
                    },
                 "savecopy":1
                }]

        return self.rawcall(self.endpoints['mail'], 'SendMessage', params)


