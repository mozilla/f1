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
from linkdrop.lib.links import sign_link

from linkdrop.model.meta import Session
from linkdrop.model import Account, History
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
        message = request.POST.get('message')
        username = request.POST.get('username')
        shorturl = request.POST.get('shorturl')
        userid = request.POST.get('userid')
        to = request.POST.get('to')
        if not domain or not message:
            error = {
                'reason': "'domain' and 'message' request params are not optional",
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
        try:
            q = Session.query(Account).filter(Account.key.in_(keys)).filter(Account.domain==domain)
            if username:
                q = q.filter(Account.username==username)
            if userid:
                q = q.filter(Account.userid==userid)
            acct = q.one()
        except MultipleResultsFound:
            error = {'provider': domain,
                     'reason': "Multiple accounts for %s were found, username or userid required" % domain,
                     'code': 409
            }
            return {'result': result, 'error': error}
        except NoResultFound:
            error = {'provider': domain,
                     'reason': "no user account for that domain",
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
            history.account = acct
            history.published = UTCDateTime.now()
            for key, val in request.POST.items():
                setattr(history, key, val)
            Session.add(history)
            link = sign_link(shorturl, acct.username)
            Session.commit()
            result['linkdrop'] = history.id
            result['shorturl'] = shorturl
            result['from'] = userid
            result['to'] = to
            log.info("send success - linkdrop id is %s", history.id)
        # no redirects requests, just return the response.
        return {'result': result, 'error': error}
