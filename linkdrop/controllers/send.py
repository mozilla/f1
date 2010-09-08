import logging
import datetime
import json
import urllib
import httplib2

from pylons import config, request, response, session
from pylons.controllers.util import abort, redirect
from pylons.decorators.util import get_pylons

from linkdrop.lib.base import BaseController
from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg
from linkdrop.lib.oauth import get_provider

from linkdrop.model.meta import Session
from linkdrop.model import Account, History
from linkdrop.model.types import UTCDateTime
from sqlalchemy.orm.exc import NoResultFound

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
        # If we don't have a userkey in our session we bail early with a
        # 401
        userkey = session.get('userkey')
        if not userkey:
            error = {'provider': domain,
                     'reason': "no session for that domain",
                     'code': 401
            }
            return {'result': result, 'error': error}
        try:
            domain = request.POST.get('domain')
            message = request.POST['message']
        except KeyError, what:
            error = {'provider': domain,
                     'reason': "'%s' request param is not optional" % (what,),
            }
            return {'result': result, 'error': error}

        provider = get_provider(domain)
        # even if we have a session key, we must have an account for that
        # user for the specified domain.
        try:
            acct = Session.query(Account).filter_by(userkey=userkey, domain=domain).one()
        except NoResultFound:
            error = {'provider': domain,
                     'reason': "no account for that domain",
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
            history.message = message
            Session.add(history)
            Session.commit()
            result['linkdrop'] = history.id
            log.info("send success - linkdrop id is %s", history.id)
        # no redirects requests, just return the response.
        return {'result': result, 'error': error}
