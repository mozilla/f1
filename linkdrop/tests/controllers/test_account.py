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
# ***** END LICENSE BLOCK *****

from linkdrop.controllers import account
from linkdrop.tests import TestController
from mock import Mock
from mock import patch
from nose import tools
from webob.exc import HTTPFound


class MockException(Exception):
    pass


class TestAccountController(TestController):
    def setUp(self):
        self.log_patcher = patch('linkdrop.controllers.account.log')
        self.gserv_patcher = patch('linkdrop.controllers.account.get_services')
        self.httpf_patcher = patch('linkdrop.controllers.account.HTTPFound')
        self.log_patcher.start()
        self.gserv_patcher.start()
        self.httpf_patcher.start()
        # funky hoop we jump through so we can tell what location gets passed
        account.HTTPFound.side_effect = HTTPFound
        self.request = Mock()
        self.controller = account.AccountController(self.app)

    def tearDown(self):
        self.log_patcher.stop()
        self.gserv_patcher.stop()
        self.httpf_patcher.stop()

    def test_authorize(self):
        provider = 'example.com'
        self.request.POST = dict(domain=provider)
        self.controller.authorize(self.request)
        logmsg = "authorize request for %r"
        account.log.info.assert_called_once_with(logmsg, provider)
        account.get_services.assert_called_once()
        mock_services = account.get_services()
        mock_services.request_access.assert_called_once_with(
            provider, self.request, self.request.urlgen,
            self.request.environ.get('beaker.session'))

    @patch('linkdrop.controllers.account.metrics')
    @patch('linkdrop.controllers.account.get_redirect_response')
    def test_verify(self, mock_get_redirect_response, mock_metrics):
        # first no oauth token -> verify failure
        provider = 'example.com'
        self.request.params = dict(provider=provider)
        self.request.config = dict(oauth_failure='http://example.com/foo#bar',
                                   oauth_success='SUCCESS')
        mock_services = account.get_services()
        mock_user = dict(profile={'accounts': (dict(),)},)
        mock_services.verify.return_value = mock_user
        mock_resp = mock_get_redirect_response()
        mock_resp.exception = MockException()
        tools.assert_raises(HTTPFound, self.controller.verify,
                            self.request)
        mock_services.verify.assert_called_with(
            provider, self.request, self.request.urlgen,
            self.request.environ.get('beaker.session'))
        errmsg = 'error=Unable+to+get+OAUTH+access'
        account.HTTPFound.assert_called_with(
            location='http://example.com/foo?%s#bar' % errmsg)

        # now with oauth token -> verify success
        mock_user = dict(profile={'accounts': ({'userid': 'USERID',
                                                'username': 'USERNAME'},)},
                         oauth_token=True,
                         oauth_token_secret=False)
        mock_services.verify.return_value = mock_user
        tools.assert_raises(MockException, self.controller.verify,
                            self.request)
        mock_get_redirect_response.assert_called_with('SUCCESS')

    @patch('linkdrop.controllers.account.get_redirect_response')
    def test_verify_access_exception(self, mock_get_redirect_response):
        provider = 'example.com'
        self.request.params = dict(provider=provider)
        self.request.config = dict(oauth_failure='http://example.com/foo#bar')
        mock_services = account.get_services()
        errmsg = 'ACCESSEXCEPTION'
        from linkoauth.errors import AccessException
        mock_services.verify.side_effect = AccessException(errmsg)
        mock_resp = mock_get_redirect_response()
        mock_resp.exception = MockException()
        tools.assert_raises(HTTPFound, self.controller.verify,
                            self.request)
        account.HTTPFound.assert_called_with(
            location='http://example.com/foo?error=%s#bar' % errmsg)

    @patch('linkdrop.controllers.account.get_redirect_response')
    def test_verify_http_exception(self, mock_get_redirect_response):
        provider = 'example.com'
        self.request.params = dict(provider=provider)
        self.request.config = dict(oauth_failure='http://example.com/foo#bar')
        mock_services = account.get_services()
        from linkdrop.controllers.account import HTTPException
        url = 'http://example.com/redirect'
        exc = HTTPException(url, None)
        mock_services.verify.side_effect = exc
        tools.assert_raises(HTTPException, self.controller.verify,
                            self.request)
        errmsg = "account verification for %s caused a redirection: %s"
        account.log.info.assert_called_with(errmsg, provider, exc)
