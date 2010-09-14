import logging
import urllib, cgi, json

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from pylons.decorators import jsonify
from pylons.decorators.util import get_pylons

from linkdrop.lib.base import BaseController, render
from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg
from linkdrop.lib.oauth import get_provider

from linkdrop.model.meta import Session
from linkdrop.model.account import Account
from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy import and_

log = logging.getLogger(__name__)

class AccountController(BaseController):
    """
Accounts
========

The 'account' namespace is used to access information regarding the current
user's account. This does not retrieve the users contact, for that see
the contacts API that uses @me/@self.

"""
    __api_controller__ = True # for docs

    # for testing...
    @api_response
    @json_exception_response
    def get(self, domain=None):
        keys = session.get('account_keys', '').split(',')
        import sys; print >> sys.stderr, keys
        accts = Session.query(Account).filter(Account.key.in_(keys)).all()
        return [a.profile for a in accts]

    def _get_or_create_account(self, domain, userid, username):
        keys = session.get('account_keys', '').split(',')
        # Find or create an account
        try:
            acct = Session.query(Account).filter(and_(Account.domain==domain, Account.userid==userid)).one()
        except NoResultFound:
            acct = Account()
            acct.domain = domain
            acct.userid = userid
            acct.username = username
            Session.add(acct)
        if acct.key not in keys:
            keys.append(acct.key)
            session['account_keys'] = ','.join(keys)
            session.save()
        return acct

    # this is not a rest api
    def authorize(self, *args, **kw):
        provider = request.POST['domain']
        session['oauth_provider'] = provider
        session.save()
        service = get_provider(provider)
        return service.responder().request_access()

    # this is not a rest api
    def verify(self, *args, **kw):
        provider = session.pop('oauth_provider')
        session.save()
        service = get_provider(provider)

        auth = service.responder()
        try:
            user = auth.verify()
            account = user['profile']['accounts'][0]
    
            acct = self._get_or_create_account(provider, account['userid'], account['username'])
            acct.profile = user['profile']
            acct.oauth_token = user.get('oauth_token', None)
            if 'oauth_token_secret' in user:
                acct.oauth_token_secret = user['oauth_token_secret']
            Session.commit()
        except Exception, e:
            import traceback
            traceback.print_exc()
            err = urllib.urlencode([('error',str(e))])
            url = session['end_point_auth_failure'].split('#')
            return redirect('%s?%s#%s' % (url[0], err, url[1]))
        return redirect(session['end_point_success'])
