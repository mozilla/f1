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
#   Rob Miller (rmiller@mozilla.com)
#

import json

from linkoauth.errors import (OAuthKeysException, ServiceUnavailableException,
                              DomainNotRegisteredError)

from linkdrop.controllers import get_services
from linkdrop.lib.base import BaseController
from linkdrop.lib.helpers import json_exception_response, api_response
from linkdrop.lib.helpers import api_entry, api_arg, get_passthrough_headers
from linkdrop.lib import constants
from linkdrop.lib.metrics import metrics


class ContactsController(BaseController):
    """
Contacts
========

A proxy for retrieving contacts from a service.

"""
    __api_controller__ = True  # for docs

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
        response={'type': 'object', 'doc': 'Portable Contacts Collection'})
    def get(self, request):
        domain = str(request.sync_info['domain'])
        page_data = request.POST.get('pageData', None)
        account_data = request.POST.get('account', None)

        acct = None
        if account_data:
            acct = json.loads(account_data)
        if not acct:
            metrics.track(request, 'contacts-noaccount', domain=domain)
            error = {'provider': domain,
                     'message': ("not logged in or no user account "
                                 "for that domain"),
                     'status': 401,
            }
            return {'result': None, 'error': error}

        headers = get_passthrough_headers(request)
        page_data = page_data and json.loads(page_data) or {}
        try:
            services = get_services(self.app_config)
            result, error = services.getcontacts(domain, acct, page_data,
                                                 headers)
        except DomainNotRegisteredError:
            error = {
                'message': "'domain' is invalid",
                'code': constants.INVALID_PARAMS,
            }
            return {'result': None, 'error': error}

        except OAuthKeysException, e:
            # more than likely we're missing oauth tokens for some reason.
            error = {'provider': domain,
                     'message': ("not logged in or no user account "
                                 "for that domain"),
                     'status': 401,
            }
            result = None
            metrics.track(request, 'contacts-oauth-keys-missing',
                          domain=domain)
        except ServiceUnavailableException, e:
            error = {'provider': domain,
                     'message': ("The service is temporarily unavailable "
                                 "- please try again later."),
                     'status': 503,
            }
            if e.debug_message:
                error['debug_message'] = e.debug_message
            result = None
            metrics.track(request, 'contacts-service-unavailable',
                          domain=domain)
        return {'result': result, 'error': error}
