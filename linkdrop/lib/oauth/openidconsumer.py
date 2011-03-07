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

import logging
import re

from openid.consumer import consumer
from openid.extensions import ax, sreg, pape
from openid.store import memstore, filestore, sqlstore
from openid import oidutil

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect

from linkdrop.lib.oauth.base import get_oauth_config, AccessException

log = logging.getLogger("oauth.openid")

# overwrite the openid logger so we can manage what log level is used
# currently openid however does not define a log level, so everything
# goes to debug.  if we set our log level in the ini file, we'll get
# openid logging
def openid_logger(message, level=logging.DEBUG):
    log.debug(message)

oidutil.log = openid_logger

__all__ = ['OpenIDResponder']


# Setup our attribute objects that we'll be requesting
ax_attributes = dict(
    nickname = 'http://axschema.org/namePerson/friendly',
    email    =  'http://axschema.org/contact/email',
    full_name = 'http://axschema.org/namePerson',
    birthday = 'http://axschema.org/birthDate',
    gender = 'http://axschema.org/person/gender',
    postal_code = 'http://axschema.org/contact/postalCode/home',
    country = 'http://axschema.org/contact/country/home',
    timezone = 'http://axschema.org/pref/timezone',
    language = 'http://axschema.org/pref/language',
    name_prefix = 'http://axschema.org/namePerson/prefix',
    first_name = 'http://axschema.org/namePerson/first',
    last_name = 'http://axschema.org/namePerson/last',
    middle_name = 'http://axschema.org/namePerson/middle',
    name_suffix = 'http://axschema.org/namePerson/suffix',
    web = 'http://axschema.org/contact/web/default',
)

#Change names later to make things a little bit clearer
alternate_ax_attributes = dict(
    nickname = 'http://schema.openid.net/namePerson/friendly',
    email = 'http://schema.openid.net/contact/email',
    full_name = 'http://schema.openid.net/namePerson',
    birthday = 'http://schema.openid.net/birthDate',
    gender = 'http://schema.openid.net/person/gender',
    postal_code = 'http://schema.openid.net/contact/postalCode/home',
    country = 'http://schema.openid.net/contact/country/home',
    timezone = 'http://schema.openid.net/pref/timezone',
    language = 'http://schema.openid.net/pref/language',
    name_prefix = 'http://schema.openid.net/namePerson/prefix',
    first_name = 'http://schema.openid.net/namePerson/first',
    last_name = 'http://schema.openid.net/namePerson/last',
    middle_name = 'http://schema.openid.net/namePerson/middle',
    name_suffix = 'http://schema.openid.net/namePerson/suffix',
    web = 'http://schema.openid.net/contact/web/default',
)

# Translation dict for AX attrib names to sreg equiv
trans_dict = dict(
    full_name = 'fullname',
    birthday = 'dob',
    postal_code = 'postcode',
)

attributes = ax_attributes


class AttribAccess(object):
    """Uniform attribute accessor for Simple Reg and Attribute Exchange values"""
    def __init__(self, sreg_resp, ax_resp):
        self.sreg_resp = sreg_resp or {}
        self.ax_resp = ax_resp or ax.AXKeyValueMessage()

    def get(self, key, ax_only=False):
        """Get a value from either Simple Reg or AX"""
        # First attempt to fetch it from AX
        v = self.ax_resp.getSingle(attributes[key])
        if v:
            return v
        if ax_only:
            return None
        
        # Translate the key if needed
        if key in trans_dict:
            key = trans_dict[key]
        
        # Don't attempt to fetch keys that aren't valid sreg fields
        if key not in sreg.data_fields:
            return None
        
        return self.sreg_resp.get(key)


def extract_openid_data(identifier, sreg_resp, ax_resp):
    """Extract the OpenID Data from Simple Reg and AX data
    
    This normalizes the data to the appropriate format.
    
    """
    attribs = AttribAccess(sreg_resp, ax_resp)
    
    ud = {'identifier': identifier}
    if 'google.com' in identifier:
        ud['providerName'] = 'Google'
    elif 'yahoo.com' in identifier:
        ud['providerName'] = 'Yahoo'
    else:
        ud['providerName'] = 'OpenID'
    
    # Sort out the display name and preferred username
    if ud['providerName'] == 'Google':
        # Extract the first bit as the username since Google doesn't return
        # any usable nickname info
        email = attribs.get('email')
        if email:
            ud['preferredUsername'] = re.match('(^.*?)@', email).groups()[0]
    else:
        ud['preferredUsername'] = attribs.get('nickname')
    
    # We trust that Google and Yahoo both verify their email addresses
    if ud['providerName'] in ['Google', 'Yahoo']:
        ud['verifiedEmail'] = attribs.get('email', ax_only=True)
    else:
        ud['emails'] = [attribs.get('email')]
    
    # Parse through the name parts, assign the properly if present
    name = {}
    name_keys = ['name_prefix', 'first_name', 'middle_name', 'last_name', 'name_suffix']
    pcard_map = {'first_name': 'givenName', 'middle_name': 'middleName', 'last_name': 'familyName',
                 'name_prefix': 'honorificPrefix', 'name_suffix': 'honorificSuffix'}
    full_name_vals = []
    for part in name_keys:
        val = attribs.get(part)
        if val:
            full_name_vals.append(val)
            name[pcard_map[part]] = val
    full_name = ' '.join(full_name_vals).strip()
    if not full_name:
        full_name = attribs.get('full_name')

    name['formatted'] = full_name
    ud['name'] = name
    
    ud['displayName'] = full_name or ud.get('preferredUsername')
    
    urls = attribs.get('web')
    if urls:
        ud['urls'] = [urls]
    
    for k in ['gender', 'birthday']:
        ud[k] = attribs.get(k)
    
    # Now strip out empty values
    for k, v in ud.items():
        if not v or (isinstance(v, list) and not v[0]):
            del ud[k]
    
    return ud


class OpenIDResponder():
    """OpenID Consumer for handling OpenID authentication
    """

    def __init__(self, provider):
        self.provider = provider
        self.consumer_class = None
        self.log_debug = logging.DEBUG >= log.getEffectiveLevel()

        self.config = get_oauth_config(provider)

        self.endpoint_regex = self.config.get('endpoint_regex')

        # application config items, dont use self.config
        store = config.get('openid_store', 'mem')
        if store==u"file":
            store_file_path = config.get('openid_store_path', None)
            self.openid_store = filestore.FileOpenIDStore(store_file_path)
        elif store==u"mem":
            self.openid_store = memstore.MemoryStore()
        elif store==u"sql":
            # TODO: This does not work as we need a connection, not a string
            self.openid_store = sqlstore.SQLStore(sql_connstring, sql_associations_table, sql_connstring)
        self.scope = self.config.get('scope', None)
        self.return_to_query = {}

    def _lookup_identifier(self, identifier):
        """Extension point for inherited classes that want to change or set
        a default identifier"""
        return identifier
    
    def _update_authrequest(self, authrequest):
        """Update the authrequest with the default extensions and attributes
        we ask for
        
        This method doesn't need to return anything, since the extensions
        should be added to the authrequest object itself.
        
        """
        # Add on the Attribute Exchange for those that support that            
        ax_request = ax.FetchRequest()
        for attrib in attributes.values():
            ax_request.add(ax.AttrInfo(attrib))
        authrequest.addExtension(ax_request)
        
        # Form the Simple Reg request
        sreg_request = sreg.SRegRequest(
            optional=['nickname', 'email', 'fullname', 'dob', 'gender', 'postcode',
                      'country', 'language', 'timezone'],
        )
        authrequest.addExtension(sreg_request)
        return None
    
    def _get_access_token(self, request_token):
        """Called to exchange a request token for the access token
        
        This method doesn't by default return anything, other OpenID+Oauth
        consumers should override it to do the appropriate lookup for the
        access token, and return the access token.
        
        """
        return None

    def request_access(self):
        log_debug = self.log_debug
        if log_debug:
            log.debug('Handling OpenID login')
        
        # Load default parameters that all Auth Responders take
        session['end_point_success'] = request.POST.get('end_point_success', self.config.get('oauth_success'))
        fail_uri = session['end_point_auth_failure'] = request.POST.get('end_point_auth_failure', self.config.get('oauth_failure'))
        openid_url = request.POST.get('openid_identifier')
        
        # Let inherited consumers alter the openid identifier if desired
        openid_url = self._lookup_identifier(openid_url)
        
        if not openid_url or (self.endpoint_regex and not re.match(self.endpoint_regex, end_point)):
            return redirect(fail_uri)
        
        openid_session = {}
        oidconsumer = consumer.Consumer(openid_session, self.openid_store, self.consumer_class)
                
        try:
            authrequest = oidconsumer.begin(openid_url)
        except consumer.DiscoveryFailure, exc:
            log.error("openid discovery failure: %s", exc)
            return redirect(fail_uri)
        
        if authrequest is None:
            return redirect(fail_uri)

        # Update the authrequest
        self._update_authrequest(authrequest)

        return_to = url(controller='account', action="verify", provider=self.provider,
                           qualified=True, **self.return_to_query)

        # Ensure our session is saved for the id to persist
        session['openid_session'] = openid_session
        session.save()

        redirect_url = authrequest.redirectURL(realm=request.application_url, 
                                               return_to=return_to, 
                                               immediate=False)
        
        # OpenID 2.0 lets Providers request POST instead of redirect, this
        # checks for such a request.
        if authrequest.shouldSendRedirect():
            redirect_url = authrequest.redirectURL(realm=request.application_url, 
                                                   return_to=return_to, 
                                                   immediate=False)
            return redirect(redirect_url)
        else:
            return authrequest.htmlMarkup(realm=request.application_url, return_to=return_to, 
                                          immediate=False)
    
    def verify(self):
        """Handle incoming redirect from OpenID Provider"""
        log_debug = self.log_debug
        if log_debug:
            log.debug('Handling processing of response from server')
        
        openid_session = session.get('openid_session', None)
        if openid_session is None:
            log.error("no openid_session is available, is memcached running?")
            raise AccessException("openid session missing")
        
        # Setup the consumer and parse the information coming back
        oidconsumer = consumer.Consumer(openid_session, self.openid_store, self.consumer_class)
        return_to = url(controller='account', action="verify", provider=self.provider,
                           qualified=True)
        info = oidconsumer.complete(request.params, return_to)
        
        if info.status == consumer.FAILURE:
            msg = "OpenID authentication/authorization failure"
            if hasattr(info, 'message'):
                msg = "%s: %s" % (msg, info.message)
            log.info("%s: %s", self.provider, msg)
            raise AccessException(msg)
        elif info.status == consumer.CANCEL:
            msg = "User denied application access to their account"
            log.info("%s: %s", self.provider, msg)
            raise AccessException(msg)
        elif info.status == consumer.SUCCESS:
            openid_identity = info.identity_url
            if info.endpoint.canonicalID:
                # If it's an i-name, use the canonicalID as its secure even if
                # the old one is compromised
                openid_identity = info.endpoint.canonicalID
            
            user_data = extract_openid_data(identifier=openid_identity, 
                                            sreg_resp=sreg.SRegResponse.fromSuccessResponse(info),
                                            ax_resp=ax.FetchResponse.fromSuccessResponse(info))
            result_data = {'profile': user_data}
            # Did we get any OAuth info?
            access_token = None
            oauth = info.extensionResponse('http://specs.openid.net/extensions/oauth/1.0', False)
            if oauth and 'request_token' in oauth:
                access_token = self._get_access_token(oauth['request_token'])
                if access_token:
                    result_data.update(access_token)
                    
            return self._get_credentials(result_data)
        else:
            raise Exception("Unknown OpenID Failure")

    def _get_credentials(self, access_token):
        return access_token
