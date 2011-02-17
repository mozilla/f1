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
from datetime import datetime
from uuid import uuid1

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from pylons.decorators import jsonify
from pylons.decorators.util import get_pylons

from linkdrop.lib.base import BaseController, render
from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg
from linkdrop.lib.metrics import metrics
from linkdrop.lib.oauth import get_provider
from linkdrop.lib.oauth.base import AccessException

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
                rem_keys = keys[:]
                for k in keys:
                    acct = session[k]
                    if acct['domain']==domain and \
                       (not username or acct['username']==username) and \
                       (not userid or acct['userid']==userid):
                        session.pop(k)
                        rem_keys.remove(k)
                session['account_keys'] = ','.join(rem_keys)
            except:
                log.exception('failed to signout from domain %s', domain)
                session.clear()
        else:
            session.clear()
        session.save()

    def _get_or_create_account(self, domain, userid, username):
        keys = [k for k in session.get('account_keys', '').split(',') if k]
        # Find or create an account
        for k in keys:
            acct = session[k]
            if acct['domain']==domain and acct['userid']==userid:
                metrics.track(request, 'account-auth', domain=domain)
                break
        else:
            acct = dict(key=str(uuid1()), domain=domain, userid=userid,
                        username=username)
            metrics.track(request, 'account-create', domain=domain)
            keys.append(acct['key'])
            session['account_keys'] = ','.join(keys)
        return acct

    # this is not a rest api
    def authorize(self, *args, **kw):
        provider = request.POST['domain']
        log.info("authorize request for %r", provider)
        service = get_provider(provider)
        return service.responder().request_access()

    # this is not a rest api
    def verify(self, *args, **kw):
        provider = request.params.get('provider')
        log.info("verify request for %r", provider)
        service = get_provider(provider)

        auth = service.responder()
        try:
            user = auth.verify()
            account = user['profile']['accounts'][0]
            if not user.get('oauth_token') and not user.get('oauth_token_secret'):
                raise Exception('Unable to get OAUTH access')
            
            acct = self._get_or_create_account(provider, str(account['userid']), account['username'])
            acct['profile'] = user['profile']
            acct['oauth_token'] = user.get('oauth_token', None)
            if 'oauth_token_secret' in user:
                acct['oauth_token_secret'] = user['oauth_token_secret']
            acct['updated'] = datetime.now()
            session[acct['key']] = acct
            session.save()
        except AccessException, e:
            self._redirectException(e)
        except Exception, e:
            log.exception('failed to verify the account')
            self._redirectException(e)
        return redirect(session.get('end_point_success', config.get('oauth_success')))

    def _redirectException(self, e):
        err = urllib.urlencode([('error',str(e))])
        url = session.get('end_point_auth_failure',config.get('oauth_failure')).split('#')
        return redirect('%s?%s#%s' % (url[0], err, url[1]))
