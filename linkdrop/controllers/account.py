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
import urllib, json
from datetime import datetime
from uuid import uuid1
import hashlib

from pylons import config, request, session, url
from pylons.controllers.util import redirect
from pylons.controllers.core import HTTPException

from linkdrop.lib.base import BaseController
from linkdrop.lib.helpers import get_redirect_response
from linkdrop.lib.metrics import metrics

from linkoauth import get_provider
from linkoauth.base import AccessException

log = logging.getLogger(__name__)

class AccountController(BaseController):
    """
Accounts
========

OAuth authorization api.

"""
    __api_controller__ = True # for docs

    def _create_account(self, domain, userid, username):
        acct_hash = hashlib.sha1(
            "%s#%s" % ((username or '').encode('utf-8')
                       (userid or '').encode('utf-8'))).hexdigest()
        acct = dict(key=str(uuid1()), domain=domain, userid=userid,
                    username=username)
        metrics.track(request, 'account-create', domain=domain,
                      acct_id=acct_hash)
        return acct

    # this is not a rest api
    def authorize(self, *args, **kw):
        provider = request.POST['domain']
        log.info("authorize request for %r", provider)
        service = get_provider(provider)
        return service.responder().request_access(request, url, session)

    # this is not a rest api
    def verify(self, *args, **kw):
        provider = request.params.get('provider')
        log.info("verify request for %r", provider)
        service = get_provider(provider)

        auth = service.responder()
        try:
            user = auth.verify(request, url, session)
            account = user['profile']['accounts'][0]
            if (not user.get('oauth_token')
                and not user.get('oauth_token_secret')):
                raise Exception('Unable to get OAUTH access')

            acct = self._create_account(provider,
                                        str(account['userid']),
                                        account['username'])
            acct['profile'] = user['profile']
            acct['oauth_token'] = user.get('oauth_token', None)
            if 'oauth_token_secret' in user:
                acct['oauth_token_secret'] = user['oauth_token_secret']
            acct['updated'] = datetime.now().isoformat()
        except AccessException, e:
            self._redirectException(e)
        # lib/oauth/*.py throws redirect exceptions in a number of
        # places and we don't want those "exceptions" to be logged as
        # errors.
        except HTTPException, e:
            log.info("account verification for %s caused a redirection: %s",
                     provider, e)
            raise
        except Exception, e:
            log.exception('failed to verify the %s account', provider)
            self._redirectException(e)
        resp = get_redirect_response(config.get('oauth_success'))
        resp.set_cookie('account_tokens', urllib.quote(json.dumps(acct)))
        raise resp.exception

    def _redirectException(self, e):
        err = urllib.urlencode([('error',str(e))])
        url = config.get('oauth_failure').split('#')
        return redirect('%s?%s#%s' % (url[0], err, url[1]))
