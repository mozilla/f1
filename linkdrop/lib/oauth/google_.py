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

"""Google Responder

A Google responder that authenticates against Google using OpenID, or optionally
can use OpenId+OAuth hybrid protocol to request access to Google Apps using OAuth2.

"""
import urlparse
import re
from openid.extensions import ax, pape
from openid.consumer import consumer
from openid import oidutil

from openid.consumer.discover import DiscoveryFailure
from openid.message import Message, OPENID_NS, OPENID2_NS, OPENID1_NS, \
     IDENTIFIER_SELECT, no_default, BARE_NS

import oauth2 as oauth
#from oauth2.clients.smtp import SMTP
import smtplib
import base64
import gdata.contacts

from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from email.header import Header
from email.utils import parseaddr

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from paste.deploy.converters import asbool
from linkdrop.lib.base import render
from linkdrop.lib.helpers import safeHTML, literal

from linkdrop.lib.oauth.oid_extensions import OAuthRequest
from linkdrop.lib.oauth.oid_extensions import UIRequest
from linkdrop.lib.oauth.openidconsumer import ax_attributes, alternate_ax_attributes, attributes
from linkdrop.lib.oauth.openidconsumer import OpenIDResponder
from linkdrop.lib.oauth.base import get_oauth_config, OAuthKeysException

GOOGLE_OAUTH = 'https://www.google.com/accounts/OAuthGetAccessToken'

domain = 'google.com'

class GoogleConsumer(consumer.GenericConsumer):
    # a HACK to allow us to user google domains for federated login.
    # this doesn't do the proper discovery and validation, but since we
    # are forcing this to go through well known endpoints it is fine.
    def _discoverAndVerify(self, claimed_id, to_match_endpoints):
        oidutil.log('Performing discovery on %s' % (claimed_id,))
        if not claimed_id.startswith('https://www.google.com/accounts/'):
            # want to get a service endpoint for the domain, but keep the
            # original claimed_id so tests during verify pass
            g_claimed_id = "https://www.google.com/accounts/o8/user-xrds?uri="+claimed_id
            _, services = self._discover(g_claimed_id)
            services[0].claimed_id = claimed_id
        else:
            _, services = self._discover(claimed_id)
        if not services:
            raise DiscoveryFailure('No OpenID information found at %s' %
                                   (claimed_id,), None)
        return self._verifyDiscoveredServices(claimed_id, services,
                                              to_match_endpoints)

    def complete(self, message, endpoint, return_to):
        """Process the OpenID message, using the specified endpoint
        and return_to URL as context. This method will handle any
        OpenID message that is sent to the return_to URL.
        """
        mode = message.getArg(OPENID_NS, 'mode', '<No mode set>')
        claimed_id = message.getArg(OPENID2_NS, 'claimed_id')
        if not claimed_id.startswith('https://www.google.com/accounts/'):
            # we want to be sure we have the correct endpoint with the
            # google domain claimed_id hacked in
            claimed_id = "https://www.google.com/accounts/o8/user-xrds?uri="+claimed_id
            _, services = self._discover(claimed_id)
            endpoint = services[0]
        modeMethod = getattr(self, '_complete_' + mode,
                             self._completeInvalid)

        return modeMethod(message, endpoint, return_to)

class responder(OpenIDResponder):
    def __init__(self, consumer=None, oauth_key=None, oauth_secret=None, request_attributes=None, *args,
                 **kwargs):
        """Handle Google Auth

        This also handles making an OAuth request during the OpenID
        authentication.

        """

        OpenIDResponder.__init__(self, domain)
        self.consumer_key = str(self.config.get('consumer_key'))
        self.consumer_secret = str(self.config.get('consumer_secret'))
        self.provider = request.POST.get('domain', domain) # support for google apps domains
        self.consumer_class = GoogleConsumer

    def _lookup_identifier(self, identifier):
        """Return the Google OpenID directed endpoint"""
        if identifier:
            return "https://www.google.com/accounts/o8/site-xrds?hd=%s" % (identifier)
        return "https://www.google.com/accounts/o8/id"

    def _update_authrequest(self, authrequest):
        """Update the authrequest with Attribute Exchange and optionally OAuth

        To optionally request OAuth, the request POST must include an ``oauth_scope``
        parameter that indicates what Google Apps should have access requested.

        """
        request_attributes = request.POST.get('ax_attributes', ax_attributes.keys())
        ax_request = ax.FetchRequest()
        for attr in request_attributes:
            ax_request.add(ax.AttrInfo(attributes[attr], required=True))
        authrequest.addExtension(ax_request)

        # Add PAPE request information. Setting max_auth_age to zero will force a login.
        requested_policies = []
        policy_prefix = 'policy_'
        for k, v in request.POST.iteritems():
            if k.startswith(policy_prefix):
                policy_attr = k[len(policy_prefix):]
                requested_policies.append(getattr(pape, policy_attr))

        pape_request = pape.Request(requested_policies,
                                    max_auth_age=request.POST.get('pape_max_auth_age',None))
        authrequest.addExtension(pape_request)

        oauth_request = OAuthRequest(consumer=self.consumer_key, scope=self.scope or 'http://www.google.com/m8/feeds/')
        authrequest.addExtension(oauth_request)

        if 'popup_mode' in request.POST:
            kw_args = {'mode': request.POST['popup_mode']}
            if 'popup_icon' in request.POST:
                kw_args['icon'] = request.POST['popup_icon']
            ui_request = UIRequest(**kw_args)
            authrequest.addExtension(ui_request)
        return None

    def _update_verify(self, consumer):
        pass

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

        # google OpenID for domains result is:
        #{'profile': {
        #    'displayName': u'Shane Caraveo',
        #    'name': {'givenName': u'Shane', 'formatted': u'Shane Caraveo', 'familyName': u'Caraveo'},
        #    'providerName': 'OpenID',
        #    'identifier': u'http://g.caraveo.com/openid?id=103543354513986529024',
        #    'emails': [u'mixedpuppy@g.caraveo.com']}}

        profile = result_data['profile']
        provider = domain
        if profile.get('providerName').lower() == 'openid':
            provider = 'googleapps.com'
        userid = profile.get('verifiedEmail','')
        emails = profile.get('emails')
        profile['emails'] = []
        if userid:
            profile['emails'] = [{ 'value': userid, 'primary': False }]
        if emails:
            # fix the emails list
            for e in emails:
                profile['emails'].append({ 'value': e, 'primary': False })
        profile['emails'][0]['primary'] = True
        account = {'domain': provider,
                   'userid': profile['emails'][0]['value'],
                   'username': profile.get('preferredUsername','') }
        profile['accounts'] = [account]
        return result_data

# XXX right now, python-oauth2 does not raise the exception if there is an error,
# this is copied from oauth2.clients.smtp and fixed
class SMTP(smtplib.SMTP):
    """SMTP wrapper for smtplib.SMTP that implements XOAUTH."""

    def authenticate(self, url, consumer, token):
        if consumer is not None and not isinstance(consumer, oauth.Consumer):
            raise ValueError("Invalid consumer.")

        if token is not None and not isinstance(token, oauth.Token):
            raise ValueError("Invalid token.")

        xoauth_string = oauth.build_xoauth_string(url, consumer, token)
        code, resp = self.docmd('AUTH', 'XOAUTH %s' % base64.b64encode(xoauth_string))
        if code >= 500:
            raise smtplib.SMTPResponseException(code, resp)
        return code, resp


class api():
    def __init__(self, account):
        self.host = "smtp.gmail.com"
        self.port = 587
        self.config = get_oauth_config(domain)
        self.account = account
        try:
            self.oauth_token = oauth.Token(key=str(account.get('oauth_token')), secret=str(account.get('oauth_token_secret')))
        except ValueError, e:
            # missing oauth tokens, raise our own exception
            raise OAuthKeysException(str(e))
        self.consumer_key = str(self.config.get('consumer_key'))
        self.consumer_secret = str(self.config.get('consumer_secret'))
        self.consumer = oauth.Consumer(key=self.consumer_key, secret=self.consumer_secret)

    def sendmessage(self, message, options={}):
        result = error = None

        profile = self.account.get('profile', {})
        from_email = from_ = profile['emails'][0]['value']
        fullname = profile.get('displayName', None)
        if fullname:
            from_email = '"%s" <%s>' % (Header(fullname, 'utf-8').encode(), Header(from_, 'utf-8').encode(),)

        url = "https://mail.google.com/mail/b/%s/smtp/" % from_
        to_ = options.get('to', None)
        if not to_ or not '@' in to_:
            return None, {
                "provider": self.host,
                "message": "recipient address is invalid",
                "status": 0
            }
        to_ = parseaddr(to_)
        if to_[0]:
            to_ = '"%s" <%s>' % (Header(to_[0], 'utf-8').encode(), Header(to_[1], 'utf-8').encode())
        else:
            to_ = Header(to_[1], 'utf-8').encode()

        server = SMTP(self.host, self.port)
        # in the app:main set debug = true to enable
        if asbool(config.get('debug', False)):
            server.set_debuglevel(True)

        subject = options.get('subject', config.get('share_subject', 'A web link has been shared with you'))
        title = options.get('title', options.get('link', options.get('shorturl', '')))
        description = options.get('description', '')[:280]

        msg = MIMEMultipart('alternative')
        msg.set_charset('utf-8')
        msg.add_header('Subject', Header(subject, 'utf-8').encode())
        msg.add_header('From', from_email)
        msg.add_header('To', to_)

        c.safeHTML = safeHTML
        c.options = options

        # insert the url if it is not already in the message
        c.longurl = options.get('link')
        c.shorturl = options.get('shorturl')


        # reset to unwrapped for html email, they will be escaped
        c.from_name = fullname
        c.subject = subject
        c.from_header = from_
        c.to_header = to_
        c.title = title
        c.description = description
        c.message = message

        c.thumbnail = (options.get('picture_base64', "") != "")

        if c.thumbnail:
            part2 = MIMEMultipart('related')

            html = MIMEText(render('/html_email.mako').encode('utf-8'), 'html')
            html.set_charset('utf-8')

            # FIXME: we decode the base64 data just so MIMEImage can re-encode it as base64
            image = MIMEImage(base64.b64decode(options.get('picture_base64')), 'png')
            image.add_header('Content-Id', '<thumbnail>')
            image.add_header('Content-Disposition', 'inline; filename=thumbnail.png')

            part2.attach(html)
            part2.attach(image)
        else:
            part2 = MIMEText(render('/html_email.mako').encode('utf-8'), 'html')
            part2.set_charset('utf-8')


        # get the title, or the long url or the short url or nothing
        # wrap these in literal for text email
        c.from_name = literal(fullname)
        c.subject = literal(subject)
        c.from_header = literal(from_)
        c.to_header = literal(to_)
        c.title = literal(title)
        c.description = literal(description)
        c.message = literal(message)

        part1 = MIMEText(render('/text_email.mako').encode('utf-8'), 'plain')
        part1.set_charset('utf-8')

        msg.attach(part1)
        msg.attach(part2)

        try:
            try:
                try:
                    server.starttls()
                except smtplib.SMTPException:
                    logger.info("smtp server does not support TLS")
                try:
                    server.ehlo_or_helo_if_needed()
                    server.authenticate(url, self.consumer, self.oauth_token)
                    server.sendmail(from_, to_, msg.as_string())
                except smtplib.SMTPRecipientsRefused, exc:
                    for to_, err in exc.recipients.items():
                        error = {"provider": self.host,
                                 "message": err[1],
                                 "status": err[0]
                                }
                        break
                except smtplib.SMTPException, exc:
                    error = {"provider": self.host,
                             "message": "%s: %s" % (exc.smtp_code, exc.smtp_error),
                             "status": exc.smtp_code
                            }
                except UnicodeEncodeError, exc:
                    raise
                except ValueError, exc:
                    error = {"provider": self.host,
                             "message": "%s: %s" % (exc.smtp_code, exc.smtp_error),
                             "status": exc.smtp_code
                            }
            finally:
                server.quit()
        except smtplib.SMTPResponseException, exc:
            error={"provider": self.host,
                   "message": "%s: %s" % (exc.smtp_code, exc.smtp_error),
                   "status": exc.smtp_code
                   }
        if error is None:
            result = {"status": "message sent"}
        return result, error

    def getgroup_id(self, group):
        url = 'https://www.google.com/m8/feeds/groups/default/full?v=2'
        method = 'GET'
        client = oauth.Client(self.consumer, self.oauth_token)
        resp, content = client.request(url, method)
        feed = gdata.contacts.GroupsFeedFromString(content)
        for entry in feed.entry:
            this_group = entry.content.text
            if this_group.startswith('System Group: '):
                this_group = this_group[14:]
            if group == this_group:
                return entry.id.text

    def getcontacts(self, start=0, page=25, group=None):
        contacts = []
        profile = self.account.get('profile', {})
        accounts = profile.get('accounts', [{}])
        userdomain = 'default'

        # google domains can have two contacts lists, the users and the domains
        # shared contacts.
        # shared contacts are only available in paid-for google domain accounts
        # and do not show the users full contacts list.  I also did not find
        # docs on how to detect whether shared contacts is available or not,
        # so we will bypass this and simply use the users contacts list.
        #if accounts[0].get('domain') == 'googleapps.com':
        #    # set the domain so we get the shared contacts
        #    userdomain = accounts[0].get('userid').split('@')[-1]

        url = 'http://www.google.com/m8/feeds/contacts/%s/full?v=1&orderby=lastmodified&sortorder=descending&max-results=%d' % (userdomain, page,)

        method = 'GET'
        if start > 0:
            url = url + "&start-index=%d" % (start,)
        if group:
            gid = self.getgroup_id(group)
            if not gid:
                error={"provider": domain,
                       "message": "Group '%s' not available" % group,
                       }
                return None, error
            url = url + "&group=%s" % (gid,)

        # itemsPerPage, startIndex, totalResults
        client = oauth.Client(self.consumer, self.oauth_token)
        resp, content = client.request(url, method)

        if int(resp.status) != 200:
            error={"provider": domain,
                   "message": content,
                   "status": int(resp.status)
                   }
            return None, error

        feed = gdata.contacts.ContactsFeedFromString(content)
        for entry in feed.entry:
            #print entry.group_membership_info
            if entry.email:
                p = {
                    'displayName': entry.title.text,
                    'emails': []
                }
                for email in entry.email:
                    p['emails'].append({'value': email.address, 'primary': email.primary})
                    if not p['displayName']:
                        p['displayName'] = email.address
                contacts.append(p)
        result = {
            'entry': contacts,
            'itemsPerPage': feed.items_per_page.text,
            'startIndex':   feed.start_index.text,
            'totalResults': feed.total_results.text,
        }
        return result, None
