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
            url = "https://graph.facebook.com/me/feed?"+urllib.urlencode(dict(access_token=acct.oauth_token))
            body = urllib.urlencode({"message": message})
            resp, content = httplib2.Http().request(url, 'POST', body=body)
            response = json.loads(content)
            if 'id' in response:
                result[domain] = response['id']
            elif 'error' in response:
                import sys; print >> sys.stderr, repr(response)
                error = {'provider': domain,
                         'reason': response['error'].get('message'),
                         'type': response['error'].get('type')
                }
                if response['error'].get('type')=="OAuthInvalidRequestException":
                    # status will be 401 if we need to reauthorize
                    error['code'] = int(resp['status'])
            else:
                error = {'provider': domain,
                         'reason': "unexpected facebook response: %r"% (response,)
                }
                log.error("unexpected facebook response: %r", response)
        else:
            error = {'provider': domain,
                     'reason': "unsupported service %r" % (domain,)
            }

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
