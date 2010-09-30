import logging
import datetime
import json
import urllib
import sys
import httplib2

from pylons import config, request, response, session
from pylons.controllers.util import abort, redirect
from pylons.decorators.util import get_pylons

from linkdrop.lib.base import BaseController
from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg
from linkdrop.lib.oauth import get_provider

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
        domain = request.POST.get('domain')
        message = request.POST.get('message', '')
        username = request.POST.get('username')
        shorturl = request.POST.get('shorturl')
        userid = request.POST.get('userid')
        to = request.POST.get('to')
        if not domain:
            error = {
                'reason': "'domain' is not optional",
                'code': 409
            }
            return {'result': result, 'error': error}
        keys = session.get('account_keys', '').split(',')
        if not keys:
            error = {'provider': domain,
                     'reason': "no user session exists, auth required",
                     'code': 401
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
                     'reason': "not logged in or no user account for that domain",
                     'code': 401
            }
            return {'result': result, 'error': error}

        # send the item.
        result, error = provider.api(acct).sendmessage(message, request.POST)

        if error:
            assert not result
            log.info("send failure: %r", error)
        else:
            # create a new record in the history table.
            assert result
            history = History()
            history.account_id = acct.get('id')
            history.published = UTCDateTime.now()
            for key, val in request.POST.items():
                setattr(history, key, val)
            Session.add(history)
            # remove for now until we have a need to do this
            #link = sign_link(shorturl, acct.username)
            Session.commit()
            result['linkdrop'] = history.id
            result['shorturl'] = shorturl
            result['from'] = userid
            result['to'] = to
            log.info("send success - linkdrop id is %s", history.id)
        # no redirects requests, just return the response.
        return {'result': result, 'error': error}
