import logging
import datetime
import json
import urllib

from pylons import config, request, response, session
from pylons.controllers.util import abort, redirect
from pylons.decorators.util import get_pylons

from linkdrop.lib.base import BaseController
from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg
from linkdrop.lib.oauth.base import get_oauth_config

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

    def _handle_auth_failure(self, reason):
        try:
            redirect(request.POST['end_point_auth_failure'])
        except KeyError:
            abort(401, reason)

    @api_response
    @json_exception_response
    def send(self):
        # If we don't have a userkey in our session we bail early with a
        # 401
        userkey = session.get('userkey')
        if not userkey:
            self._handle_auth_failure('no session data')
        try:
            domain = request.params.get('domain')
            message = request.params['message']
        except KeyError, what:
            raise ValueError("'%s' request param is not optional" % (what,))

        # even if we have a session key, we must have an account for that
        # user for the specified domain.
        try:
            acct = Session.query(Account).filter_by(userkey=userkey, domain=domain).one()
        except NoResultFound:
            self._handle_auth_failure("no account for that domain")

        result = {}
        error = None
        # send the item.
        if domain=="twitter.com":
            from twitter.oauth import OAuth
            from twitter.api import Twitter, TwitterHTTPError
            oauth_config = get_oauth_config(domain)
            auth = OAuth(token=acct.oauth_token,
                         token_secret=acct.oauth_token_secret,
                         consumer_key=oauth_config['consumer_key'],
                         consumer_secret=oauth_config['consumer_secret'])
            try:
                api = Twitter(auth=auth)
                status = api.statuses.update(status=message)
                result[domain] = status['id']
            except TwitterHTTPError, exc:
                details = json.load(exc.e)
                if 'error' in details:
                    msg = details['error']
                else:
                    msg = str(details)
                error = {'provider': domain,
                         'reason': msg,
                }
        elif domain=="facebook.com":
            url = "https://graph.facebook.com/me/feed"
            body = urllib.urlencode({"message": message})
            response = json.load(urllib.urlopen(url + 
                urllib.urlencode(dict(access_token=acct.oauth_token)), body))
            if 'id' in response:
                result[domain] = response['id']
            elif 'error' in response:
                if response['error'].get('type')=="OAuthInvalidRequestException":
                    abort(401, "oauth token was rejected (%s)" % (response['error'],))
                error = {'provider': domain,
                         'reason': response['error'],
                }
            else:
                log.error("unexpected facebook response: %r", response)
        else:
            raise ValueError, "unsupported service %r" % (domain,)

        if error:
            assert not result
            log.info("send failure: %r", error)
            try:
                redirect(request.POST['end_point_failure'])
            except KeyError:
                pass
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
            try:
                redirect(request.POST['end_point_success'])
            except KeyError:
                pass
        # no redirects requests, just return the response.
        return {'result': result, 'error': error}
