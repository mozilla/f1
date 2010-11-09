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
import urllib, cgi, json

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from pylons.decorators import jsonify
from pylons.decorators.util import get_pylons

from linkdrop.lib.base import BaseController, render
from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg
from linkdrop.lib.oauth import get_provider
from linkdrop.model.types import UTCDateTime

from linkdrop.model.meta import Session
from linkdrop.model.account import Account
from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy import and_, not_

log = logging.getLogger(__name__)

class AccountController(BaseController):
    """
Accounts
========

OAuth authorization api.

"""
    __api_controller__ = True # for docs

    # for testing...
    @api_response
    @json_exception_response
    def get(self, domain=None):
        keys = [k for k in session.get('account_keys', '').split(',') if k]
        return [p for p in [session[k].get('profile') for k in keys] if p]
        
    def signout(self):
        domain = request.params.get('domain')
        username = request.params.get('username')
        userid = request.params.get('userid')
        if domain and username or userid:
            try:
                keys = [k for k in session.get('account_keys', '').split(',') if k]
                for k in keys:
                    session.pop(k)
                _and = [Account.domain==domain]
                if username:
                    _and.append(Account.username==username)
                if userid:
                    _and.append(Account.userid==userid)
                accts = Session.query(Account).filter(Account.key.in_(keys)).filter(not_(and_(*_and))).all()
                session['account_keys'] = ','.join([a.key for a in accts])
                for a in accts:
                    session[a.key] = a.to_dict()
            except:
                session.clear()
        else:
            session.clear()
        session.save()

    def _get_or_create_account(self, domain, userid, username):
        keys = [k for k in session.get('account_keys', '').split(',') if k]
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
            session[acct.key] = acct.to_dict()
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
            acct.updated = UTCDateTime.now()
            try:
                Session.commit()
            except UnicodeEncodeError, e:
                log.exception("***** UnicodeEncodeError! %r: %r: %r %r" % (acct.domain, acct.userid, acct.username,acct.json_attributes,))
                raise e
            # XXX argh, this is also done in get_or_create above, but we have to
            # ensure we have the updated data
            session[acct.key] = acct.to_dict()
            session.save()
        except Exception, e:
            import traceback
            traceback.print_exc()
            err = urllib.urlencode([('error',str(e))])
            url = session.get('end_point_auth_failure',config.get('oauth_failure')).split('#')
            return redirect('%s?%s#%s' % (url[0], err, url[1]))
        return redirect(session.get('end_point_success', config.get('oauth_success')))
