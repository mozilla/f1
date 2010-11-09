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

from linkdrop.model.meta import Session
from linkdrop.model import History, Link
from linkdrop.model.types import UTCDateTime
from sqlalchemy.orm.exc import NoResultFound, MultipleResultsFound

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
    def send(self):
        result = {}
        error = None
        # If we don't have a key in our session we bail early with a
        # 401
        print request.headers
        domain = request.POST.get('domain')
        message = request.POST.get('message', '')
        username = request.POST.get('username')
        longurl = request.POST.get('link')
        shorten = asbool(request.POST.get('shorten', 0))
        shorturl = request.POST.get('shorturl')
        userid = request.POST.get('userid')
        to = request.POST.get('to')
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
            return {'result': result, 'error': error}

        provider = get_provider(domain)
        # even if we have a session key, we must have an account for that
        # user for the specified domain.
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
            u = urlparse(longurl)
            if not u.scheme:
                longurl = 'http://' + longurl
            shorturl = Link.get_or_create(longurl).short_url
            args['shorturl'] = shorturl

        # send the item.
        try:
            print repr(unicode.encode(message, 'utf-8'))
            result, error = provider.api(acct).sendmessage(message, args)
        except ValueError, e:
            import traceback
            traceback.print_exc()
            # XXX we need to handle this better, but if for some reason the
            # oauth values are bad we will get a ValueError raised
            error = {'provider': domain,
                     'message': str(e),
                     'status': 401
            }
            return {'result': result, 'error': error}

        if error:
            assert not result
            log.info("send failure: %r", error)
        else:
            # create a new record in the history table.
            assert result
            if asbool(config.get('history_enabled', True)):
                # this is faster, but still want to look further into SA perf
                #data = {
                #    'json_attributes': json.dumps(dict(request.POST)),
                #    'account_id': acct.get('id'),
                #    'published': UTCDateTime.now()
                #}
                #Session.execute("INSERT DELAYED INTO history (json_attributes, account_id, published) VALUES (:json_attributes, :account_id, :published)",
                #                data)

                history = History()
                history.account_id = acct.get('id')
                history.published = UTCDateTime.now()
                for key, val in request.POST.items():
                    setattr(history, key, val)
                Session.add(history)
                Session.commit()
            result['shorturl'] = shorturl
            result['from'] = userid
            result['to'] = to
        # no redirects requests, just return the response.
        return {'result': result, 'error': error}
