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
#    Rob Miller <rmiller@mozilla.com>
#

from linkdrop.controllers import account
from linkdrop.tests import TestController
from mock import patch
from nose import tools

class MockException(Exception):
    pass

class TestAccountController(TestController):
    def setUp(self):
        self.log_patcher = patch('linkdrop.controllers.account.log')
        self.req_patcher = patch('linkdrop.controllers.account.request')
        self.gprov_patcher = patch('linkdrop.controllers.account.get_provider')
        self.log_patcher.start()
        self.req_patcher.start()
        self.gprov_patcher.start()
        self.controller = account.AccountController()

    def tearDown(self):
        self.log_patcher.stop()
        self.req_patcher.stop()
        self.gprov_patcher.stop()

    def test_authorize(self):
        provider = 'example.com'
        account.request.POST = dict(domain=provider)
        self.controller.authorize()
        logmsg = "authorize request for %r"
        account.log.info.assert_called_once_with(logmsg, provider)
        account.get_provider.assert_called_once_with(provider)
        mock_service = account.get_provider()
        mock_service.responder().request_access.assert_called_once_with(
            account.request, account.url, account.session)

    @patch.dict('linkdrop.controllers.account.config',
                dict(oauth_failure='http://example.com/foo#bar',
                     oauth_success='SUCCESS'))
    @patch('linkdrop.controllers.account.metrics')
    @patch('linkdrop.controllers.account.get_redirect_response')
    @patch('linkdrop.controllers.account.redirect')
    def test_verify(self, mock_redirect, mock_get_redirect_response,
                    mock_metrics):
        # first no oauth token -> verify failure
        provider = 'example.com'
        account.request.params = dict(provider=provider)
        mock_service = account.get_provider()
        mock_auth = mock_service.responder()
        mock_user = dict(profile={'accounts': (dict(),)},)
        mock_auth.verify.return_value = mock_user
        mock_resp = mock_get_redirect_response()
        mock_resp.exception = MockException()
        tools.assert_raises(MockException, self.controller.verify)
        mock_auth.verify.assert_called_with(account.request,
                                            account.url,
                                            account.session)
        errmsg = 'error=Unable+to+get+OAUTH+access'
        mock_redirect.assert_called_with(
            'http://example.com/foo?%s#bar' % errmsg)

        # now with oauth token -> verify success
        mock_user = dict(profile={'accounts': ({'userid': 'USERID',
                                                'username': 'USERNAME'},)},
                         oauth_token=True,
                         oauth_token_secret=False)
        mock_auth.verify.return_value = mock_user
        mock_redirect.reset_mock()
        tools.assert_raises(MockException, self.controller.verify)
        tools.eq_(mock_redirect.call_count, 0)
        mock_get_redirect_response.assert_called_with('SUCCESS')

    @patch.dict('linkdrop.controllers.account.config',
                dict(oauth_failure='http://example.com/foo#bar'))
    @patch('linkdrop.controllers.account.get_redirect_response')
    @patch('linkdrop.controllers.account.redirect')
    def test_verify_access_exception(self, mock_redirect,
                                     mock_get_redirect_response):
        provider = 'example.com'
        account.request.params = dict(provider=provider)
        mock_service = account.get_provider()
        mock_auth = mock_service.responder()
        errmsg = 'ACCESSEXCEPTION'
        def raise_access_exception(*args):
            from linkoauth.base import AccessException
            raise AccessException(errmsg)
        mock_auth.verify.side_effect = raise_access_exception
        mock_resp = mock_get_redirect_response()
        mock_resp.exception = MockException()
        tools.assert_raises(MockException, self.controller.verify)
        mock_redirect.assert_called_with(
            'http://example.com/foo?error=%s#bar' % errmsg)


    @patch.dict('linkdrop.controllers.account.config',
                dict(oauth_failure='http://example.com/foo#bar'))
    @patch('linkdrop.controllers.account.get_redirect_response')
    @patch('linkdrop.controllers.account.redirect')
    def test_verify_http_exception(self, mock_redirect,
                                   mock_get_redirect_response):
        provider = 'example.com'
        account.request.params = dict(provider=provider)
        mock_service = account.get_provider()
        mock_auth = mock_service.responder()
        from linkdrop.controllers.account import HTTPException
        url = 'http://example.com/redirect'
        exc = HTTPException(url, None)
        def raise_http_exception(*args):
            raise exc
        mock_auth.verify.side_effect = raise_http_exception
        tools.assert_raises(HTTPException, self.controller.verify)
        errmsg = "account verification for %s caused a redirection: %s"
        account.log.info.assert_called_with(errmsg, provider, exc)
