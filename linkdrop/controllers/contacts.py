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
import urllib, cgi, json, sys
from urlparse import urlparse

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from pylons.decorators import jsonify
from pylons.decorators.util import get_pylons

from linkdrop.lib.base import BaseController, render
from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg
from linkdrop.lib.oauth import get_provider
from linkdrop.lib.oauth.base import OAuthKeysException
from linkdrop.lib import constants
from linkdrop.lib.metrics import metrics

log = logging.getLogger(__name__)

class ContactsController(BaseController):
    """
Contacts
========

A proxy for retrieving contacts from a service.

"""
    __api_controller__ = True # for docs


    @api_response
    @json_exception_response
    @api_entry(
        doc="""
contacts
--------

Get contacts from a service.
""",
        urlargs=[
            api_arg('domain', 'string', True, None, None, """
The domain of the service to get contacts from (e.g. google.com)
"""),
        ],
        queryargs=[
            # name, type, required, default, allowed, doc
            api_arg('username', 'string', False, None, None, """
The user name used by the service. The username or userid is required if more
than one account is setup for the service.
"""),
            api_arg('userid', 'string', False, None, None, """
The user id used by the service. The username or userid is required if more
than one account is setup for the service.
"""),
            api_arg('startindex', 'integer', False, 0, None, """
Start index used for paging results.
"""),
            api_arg('maxresults', 'integer', False, 25, None, """
Max results to be returned per request, used with startindex for paging.
"""),
            api_arg('group', 'string', False, 'Contacts', None, """
Name of the group to return.
"""),
        ],
        response={'type': 'object', 'doc': 'Portable Contacts Collection'}
    )
    def get(self, domain):
        username = request.POST.get('username')
        userid = request.POST.get('userid')
        group = request.POST.get('group', None)
        startIndex = int(request.POST.get('startindex','0'))
        maxResults = int(request.POST.get('maxresults','25'))
        keys = session.get('account_keys', '').split(',')
        account_data = request.POST.get('account', None)
        if not keys:
            error = {'provider': domain,
                     'message': "no user session exists, auth required",
                     'status': 401
            }
            metrics.track(request, 'contacts-unauthed', domain=domain)
            return {'result': None, 'error': error}
        provider = get_provider(domain)

        # even if we have a session key, we must have an account for that
        # user for the specified domain.
        if account_data is not None:
            acct = json.loads(account_data)
        else:
            # support for old accounts in the session store
            acct = None
            for k in keys:
                a = session.get(k)
                if a and a.get('domain') == domain and (not username or a.get('username')==username and not userid or a.get('userid')==userid):
                    acct = a
                    break
        if not acct:
            metrics.track(request, 'contacts-noaccount', domain=domain)
            error = {'provider': domain,
                     'message': "not logged in or no user account for that domain",
                     'status': 401
            }
            return {'result': None, 'error': error}

        try:
            result, error = provider.api(acct).getcontacts(startIndex, maxResults, group)
        except OAuthKeysException, e:
            # more than likely we're missing oauth tokens for some reason.
            error = {'provider': domain,
                     'message': "not logged in or no user account for that domain",
                     'status': 401
            }
            result = None
            metrics.track(request, 'contacts-oauth-keys-missing', domain=domain)
        return {'result': result, 'error': error}
