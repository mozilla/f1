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
import datetime
import json
import urllib
import sys
import httplib2
import copy
from urlparse import urlparse
from paste.deploy.converters import asbool

from pylons import config, request, response, session
from pylons.controllers.util import abort, redirect
from pylons.decorators.util import get_pylons

from linkdrop.lib.base import BaseController
from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg
from linkdrop.lib.oauth import get_provider
from linkdrop.lib import constants
from linkdrop.lib.metrics import metrics
from linkdrop.lib.shortener import shorten_link

log = logging.getLogger(__name__)


class SendController(BaseController):
    """
Send
====

The 'send' namespace is used to send updates to our supported services.

"""
    __api_controller__ = True # for docs

    @api_response
    @json_exception_response
    @api_entry(
        doc="""
send
----

Share a link through F1.
""",
        queryargs=[
            # name, type, required, default, allowed, doc
            api_arg('domain', 'string', True, None, None, """
Domain of service to share to (google.com for gmail, facebook.com, twitter.com)
"""),
            api_arg('message', 'string', True, None, None, """
Message entered by user
"""),
            api_arg('username', 'string', False, None, None, """
Optional username, required if more than one account is configured for a domain.
"""),
            api_arg('userid', 'string', False, None, None, """
Optional userid, required if more than one account is configured for a domain.
"""),
            api_arg('link', 'string', False, None, None, """
URL to share
"""),
            api_arg('shorturl', 'string', False, None, None, """
Shortened version of URL to share
"""),
            api_arg('shorten', 'boolean', False, None, None, """
Force a shortening of the URL provided
"""),
            api_arg('to', 'string', False, None, None, """
Individual or group to share with, not supported by all services.
"""),
            api_arg('subject', 'string', False, None, None, """
Subject line for emails, not supported by all services.
"""),
            api_arg('picture', 'string', False, None, None, """
URL to publicly available thumbnail, not supported by all services.
"""),
            api_arg('picture_base64', 'string', False, None, None, """
Base 64 encoded PNG version of the picture used for attaching to emails.
"""),
            api_arg('description', 'string', False, None, None, """
Site provided description of the shared item, not supported by all services.
"""),
            api_arg('name', 'string', False, None, None, """
"""),
        ],
        response={'type': 'list', 'doc': 'raw data list'}
    )
    def send(self):
        result = {}
        error = None
        # If we don't have a key in our session we bail early with a
        # 401
        domain = request.POST.get('domain')
        message = request.POST.get('message', '')
        username = request.POST.get('username')
        longurl = request.POST.get('link')
        shorten = asbool(request.POST.get('shorten', 0))
        shorturl = request.POST.get('shorturl')
        userid = request.POST.get('userid')
        to = request.POST.get('to')
        account_data = request.POST.get('account', None)
        if not domain:
            error = {
                'message': "'domain' is not optional",
                'code': constants.INVALID_PARAMS
            }
            return {'result': result, 'error': error}
        keys = session.get('account_keys', '').split(',')
        if not keys:
            error = {'provider': domain,
                     'message': "no user session exists, auth required",
                     'status': 401
            }
            metrics.track(request, 'send-unauthed', domain=domain)
            return {'result': result, 'error': error}

        provider = get_provider(domain)
        # even if we have a session key, we must have an account for that
        # user for the specified domain.
        if account_data:
            acct = json.loads(account_data)
        else:
            # support for old account data in session store
            acct = None
            for k in keys:
                a = session.get(k)
                if a and a.get('domain') == domain and (a.get('username')==username or a.get('userid')==userid):
                    acct = a
                    break
        if not acct:
            error = {'provider': domain,
                     'message': "not logged in or no user account for that domain",
                     'status': 401
            }
            return {'result': result, 'error': error}

        args = copy.copy(request.POST)
        if shorten and not shorturl and longurl:
            link_timer = metrics.start_timer(request, long_url=longurl)
            u = urlparse(longurl)
            if not u.scheme:
                longurl = 'http://' + longurl
            shorturl = shorten_link(longurl)
            link_timer.track('link-shorten', short_url=shorturl)
            args['shorturl'] = shorturl

        timer = metrics.start_timer(request, domain=domain, message_len=len(message),
                                    long_url=longurl, short_url=shorturl)
        # send the item.
        try:
            result, error = provider.api(acct).sendmessage(message, args)
        except ValueError, e:
            # XXX - I doubt we really want a full exception logged here?
            log.exception('error providing item to %s: %s', domain, e)
            # XXX we need to handle this better, but if for some reason the
            # oauth values are bad we will get a ValueError raised
            error = {'provider': domain,
                     'message': "not logged in or no user account for that domain",
                     'status': 401
            }
            timer.track('send-error', error=error)
            return {'result': result, 'error': error}

        if error:
            timer.track('send-error', error=error)
            assert not result
            log.error("send failure: %r %r %r", username, userid, error)
        else:
            # create a new record in the history table.
            assert result
            result['shorturl'] = shorturl
            result['from'] = userid
            result['to'] = to
            timer.track('send-success')
        # no redirects requests, just return the response.
        return {'result': result, 'error': error}
