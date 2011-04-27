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

from linkdrop.controllers import contacts
from linkdrop.tests import TestController
from mock import Mock
from mock import patch
from nose import tools
import json


class TestContactsController(TestController):
    def setUp(self):
        self.gserv_patcher = patch(
            'linkdrop.controllers.contacts.get_services')
        self.metrics_patcher = patch(
            'linkdrop.controllers.contacts.metrics')
        self.gserv_patcher.start()
        self.metrics_patcher.start()
        self.request = Mock()
        self.request.POST = dict()
        self.domain = 'example.com'
        self.request.sync_info = dict(domain=self.domain)
        self.controller = contacts.ContactsController(self.app)
        self.real_get = self.controller.get.undecorated.undecorated

    def tearDown(self):
        self.gserv_patcher.stop()
        self.metrics_patcher.stop()

    def test_get_no_acct(self):
        res = self.real_get(self.controller, self.request)
        contacts.metrics.track.assert_called_with(self.request,
                                                  'contacts-noaccount',
                                                  domain=self.domain)
        tools.ok_(res['result'] is None)
        tools.eq_(res['error']['provider'], self.domain)
        tools.eq_(res['error']['status'], 401)
        tools.ok_(res['error']['message'].startswith('not logged in'))

    def _setup_acct_data(self):
        acct_json = json.dumps({'username': 'USERNAME',
                                'userid': 'USERID'})
        self.request.POST['account'] = acct_json

    def test_get_no_provider(self):
        from linkoauth.errors import DomainNotRegisteredError
        mock_services = contacts.get_services()
        mock_services.getcontacts.side_effect = DomainNotRegisteredError()
        self._setup_acct_data()
        res = self.real_get(self.controller, self.request)
        tools.ok_(res['result'] is None)
        tools.eq_(res['error']['message'], "'domain' is invalid")

    def test_get_oauthkeysexception(self):
        from linkoauth.errors import OAuthKeysException
        oauthexc = OAuthKeysException('OAUTHKEYSEXCEPTION')
        mock_services = contacts.get_services()
        mock_services.getcontacts.side_effect = oauthexc
        domain = 'example.com'
        self._setup_acct_data()
        res = self.real_get(self.controller, self.request)
        contacts.metrics.track.assert_called_with(
            self.request, 'contacts-oauth-keys-missing',
            domain=self.domain)
        tools.ok_(res['result'] is None)
        tools.eq_(res['error']['provider'], self.domain)
        tools.eq_(res['error']['status'], 401)
        tools.ok_(res['error']['message'].startswith('not logged in'))

    def test_get_serviceunavailexception(self):
        from linkoauth.errors import ServiceUnavailableException
        servexc = ServiceUnavailableException('SERVUNAVAIL')
        mock_services = contacts.get_services()
        mock_services.getcontacts.side_effect = servexc
        self._setup_acct_data()
        res = self.real_get(self.controller, self.request)
        contacts.metrics.track.assert_called_with(
            self.request, 'contacts-service-unavailable',
            domain=self.domain)
        tools.ok_(res['result'] is None)
        tools.eq_(res['error']['provider'], self.domain)
        tools.eq_(res['error']['status'], 503)
        tools.ok_(res['error']['message'].startswith(
            'The service is temporarily unavailable'))

    def test_get_success(self):
        self._setup_acct_data()
        mock_services = contacts.get_services()
        mock_services.getcontacts.return_value = ('SUCCESS', None)
        res = self.real_get(self.controller, self.request)
        tools.eq_(res['result'], 'SUCCESS')
        tools.ok_(res['error'] is None)
