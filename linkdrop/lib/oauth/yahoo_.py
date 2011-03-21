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
import json
import copy
from rfc822 import AddressList
import logging

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from paste.deploy.converters import asbool

from linkdrop.lib.base import render
from linkdrop.lib.helpers import safeHTML, literal

from linkdrop.lib.oauth.oid_extensions import OAuthRequest
from linkdrop.lib.oauth.oid_extensions import UIRequest
from linkdrop.lib.oauth.openidconsumer import ax_attributes, alternate_ax_attributes, attributes
from linkdrop.lib.oauth.openidconsumer import OpenIDResponder
from linkdrop.lib.oauth.base import get_oauth_config, OAuthKeysException, ServiceUnavailableException
from linkdrop.lib.protocap import HttpRequestor

YAHOO_OAUTH = 'https://api.login.yahoo.com/oauth/v2/get_token'

domain = 'yahoo.com'
log = logging.getLogger(domain)

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
        profile['xoauth_yahoo_guid'] = result_data['xoauth_yahoo_guid']
        return result_data


class api():
    endpoints = {
        "mail":"http://mail.yahooapis.com/ws/mail/v1.1/jsonrpc",
        "contacts":"http://social.yahooapis.com/v1/user/%s/contacts"
    }

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

    def _maybe_throw_response_exception(self, resp, content):
        # maybe throw one of our internal response exceptions based on the
        # service response.
        status = int(resp.status)
        if status == 404:
            # this is some bizarre temporary error - see the
            # send-404-not-on-accelerator response capture for an example...
            raise ServiceUnavailableException(debug_message=content)
        if status >= 500:
            raise ServiceUnavailableException(debug_message=content)

    def jsonrpc(self, url, method, args, options={}):
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        if options.get('HumanVerification'):
            headers['X-HumanVerification-ImageUrl'] = options.get('HumanVerificationImage')
            headers['X-HumanVerification-Answer'] = options.get('HumanVerification')
        # simple jsonrpc call
        postdata = json.dumps({"method": method, 'params': args, 'id':'jsonrpc'})
        postdata = postdata.encode("utf-8")

        oauth_request = oauth.Request.from_consumer_and_token(self.consumer,
                                                              token=self.oauth_token,
                                                              http_method='POST',
                                                              http_url=url)
        oauth_request.sign_request(self.sigmethod, self.consumer, self.oauth_token)
        headers.update(oauth_request.to_header())

        client = HttpRequestor()
        resp, content = client.request(url, 'POST', headers=headers, body=postdata)
        self._maybe_throw_response_exception(resp, content)
        try:
            response = json.loads(content)
        except ValueError:
            client.save_capture("non-json yahoo response")
            raise
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
            client.save_capture("yahoo error")
            error = copy.copy(response['error'])
            error.update({ 'provider': domain, 'status': int(resp['status']) })
        else:
            client.save_capture("unexpected response")
            error = {'provider': domain,
                     'message': "unexpected yahoo response: %r"% (response,),
                     'status': int(resp['status']) 
            }
            log.error("unexpected yahoo response: %r", response)

        return result, error

    def restcall(self, url, method="GET", body=None):
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

        oauth_request = oauth.Request.from_consumer_and_token(self.consumer,
                                                              token=self.oauth_token,
                                                              http_method=method,
                                                              http_url=url)
        oauth_request.sign_request(self.sigmethod, self.consumer, self.oauth_token)
        headers.update(oauth_request.to_header())

        client = HttpRequestor()
        resp, content = client.request(url, method, headers=headers, body=body)
        self._maybe_throw_response_exception(resp, content)
        try:
            data = content and json.loads(content) or resp
        except ValueError:
            client.save_capture("non json restcall response")
            raise

        result = error = None
        status = int(resp['status'])
        if status < 200 or status >= 300:
            client.save_capture("failed restcall response")
            error = data
            error['status'] = status
        else:
            result = data

        return result, error

    def sendmessage(self, message, options={}):
        result = error = None

        profile = self.account.get('profile', {})
        from_email = from_ = profile.get('verifiedEmail')
        fullname = profile.get('displayName', None)

        address_list = AddressList(options.get('to', ''))
        if len(address_list)==0:
            return None, {
                "provider": domain,
                "message": "recipient address must be specified",
                "status": 0
            }
        to_ = []
        for addr in address_list:
            if not addr[1] or not '@' in addr[1]:
                return None, {
                    "provider": domain,
                    "message": "recipient address '%s' is invalid" % (addr[1],),
                    "status": 0
                }
            # expect normal email address formats, parse them
            to_.append({'name': addr[0], 'email': addr[1]})

        assert to_ # we caught all cases where it could now be empty.

        subject = options.get('subject', config.get('share_subject', 'A web link has been shared with you'))
        title = options.get('title', options.get('link', options.get('shorturl', '')))
        description = options.get('description', '')[:280]
        
        c.safeHTML = safeHTML
        c.options = options

        # insert the url if it is not already in the message
        c.longurl = options.get('link')
        c.shorturl = options.get('shorturl')


        # reset to unwrapped for html email, they will be escaped
        c.from_name = fullname
        c.subject = subject
        c.from_header = from_
        c.title = title
        c.description = description
        c.message = message
        c.thumbnail = False

        html_message = render('/html_email.mako').encode('utf-8')

        # get the title, or the long url or the short url or nothing
        # wrap these in literal for text email
        c.from_name = literal(fullname)
        c.subject = literal(subject)
        c.from_header = literal(from_)
        c.title = literal(title)
        c.description = literal(description)
        c.message = literal(message)

        text_message = render('/text_email.mako').encode('utf-8')

        params = [{
                "message":
                    {"subject":subject,
                     "from":{"name": fullname, "email":from_},
                     "to":to_,
                     "simplebody":{
                        "text": text_message,
                        "html": html_message
                     }
                    },
                 "savecopy":1
                }]

        return self.jsonrpc(self.endpoints['mail'], 'SendMessage', params, options)

    def getcontacts(self, start=0, page=25, group=None):
        profile = self.account.get('profile', {})
        guid = profile.get('xoauth_yahoo_guid')

        result, error = self.restcall(self.endpoints['contacts'] % (guid,))
        if error:
            return result, error
        ycontacts = result.get('contacts')
        people = ycontacts.get('contact', [])
        contacts = []

        # convert yahoo contacts to poco
        for person in people:
            poco = {}
            for f in person.get('fields', []):
                field = f.get('type')
                value = f.get('value')
                if field == 'name':
                    if  value.get('middleName'):
                        poco['displayName'] = "%s %s %s" % (value.get('givenName'), value.get('middleName'), value.get('familyName'),)
                    else:
                        poco['displayName'] = "%s %s" % (value.get('givenName'), value.get('familyName'),)
                elif field == 'email':
                    poco.setdefault('emails',[]).append({ 'value': value, 'primary': False })
                elif field == 'nickname':
                    poco['nickname'] = value

            contacts.append(poco)
            
        connectedto = {
            'entry': contacts,
            'itemsPerPage': ycontacts.get('count', 0),
            'startIndex':   ycontacts.get('start', 0),
            'totalResults': ycontacts.get('total', 0),
        }

        return connectedto, None
