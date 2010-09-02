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
    def get(self, id=None):
        if id is None:
            accts = Session.query(Account).all()
        else:
            accts = [Session.query(Account).get(id)]
        return [a.to_dict() for a in accts]

    def _get_or_create_account(self, domain, userid, username):
        user_key = session.get('userkey')
        # Find or create an account
        try:
            acct = Session.query(Account).filter(and_(Account.domain==domain, Account.userid==userid)).one()
        except NoResultFound:
            acct = Account()
            acct.domain = domain
            acct.userid = userid
            acct.username = username
            Session.add(acct)

        if user_key:
            acct.userkey = user_key
        else:
            session['userkey'] = acct.userkey
            session.save()

        return acct

    @json_exception_response
    def authorize(self, *args, **kw):
        provider = request.POST['domain']
        session['oauth_provider'] = provider
        session.save()
        responder = get_provider(provider)
        return responder().request_access()

    @json_exception_response
    def verify(self, *args, **kw):
        provider = session.pop('oauth_provider')
        session.save()
        responder = get_provider(provider)

        auth = responder()
        access_key = auth.verify()
        data = auth.get_credentials(access_key)
        #import sys; print >> sys.stderr, data
        
        account = data['profile']['accounts'][0]

        acct = self._get_or_create_account(provider, account['userid'], account['username'])
        acct.profile = data['profile']
        acct.oauth_token = data['oauth_token']
        if 'oauth_token_secret' in data:
            acct.oauth_token_secret = data['oauth_token_secret']
        Session.commit()

        fragment = "oauth_success_" + provider
        return redirect(session['end_point_success'])
