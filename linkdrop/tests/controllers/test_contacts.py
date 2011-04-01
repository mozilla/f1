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
from mock import patch
from nose import tools
import json

class TestContactsController(TestController):
    def setUp(self):
        self.req_patcher = patch('linkdrop.controllers.contacts.request')
        self.gprov_patcher = patch(
            'linkdrop.controllers.contacts.get_provider')
        self.metrics_patcher = patch(
            'linkdrop.controllers.contacts.metrics')
        self.req_patcher.start()
        self.gprov_patcher.start()
        self.metrics_patcher.start()
        contacts.request.POST = dict()
        self.controller = contacts.ContactsController()
        self.real_get = self.controller.get.undecorated.undecorated

    def tearDown(self):
        self.req_patcher.stop()
        self.gprov_patcher.stop()
        self.metrics_patcher.stop()

    def test_get_no_provider(self):
        contacts.get_provider.return_value = None
        res = self.real_get(self.controller, 'example.com')
        tools.ok_(res['result'] is None)
        tools.eq_(res['error']['message'], "'domain' is invalid")

    def test_get_no_acct(self):
        domain = 'example.com'
        res = self.real_get(self.controller, domain)
        contacts.metrics.track.assert_called_with(contacts.request,
                                                  'contacts-noaccount',
                                                  domain=domain)
        tools.ok_(res['result'] is None)
        tools.eq_(res['error']['provider'], domain)
        tools.eq_(res['error']['status'], 401)
        tools.ok_(res['error']['message'].startswith('not logged in'))

    def _setup_acct_data(self):
        acct_json = json.dumps({'username': 'USERNAME',
                                'userid': 'USERID'})
        contacts.request.POST['account'] = acct_json

    def test_get_oauthkeysexception(self):
        from linkoauth.base import OAuthKeysException
        def raise_oauthkeysexception(*args):
            raise OAuthKeysException('OAUTHKEYSEXCEPTION')
        mock_getcontacts = contacts.get_provider().api().getcontacts
        mock_getcontacts.side_effect = raise_oauthkeysexception
        domain = 'example.com'
        self._setup_acct_data()
        res = self.real_get(self.controller, domain)
        contacts.metrics.track.assert_called_with(
            contacts.request, 'contacts-oauth-keys-missing',
            domain=domain)
        tools.ok_(res['result'] is None)
        tools.eq_(res['error']['provider'], domain)
        tools.eq_(res['error']['status'], 401)
        tools.ok_(res['error']['message'].startswith('not logged in'))

    def test_get_serviceunavailexception(self):
        from linkoauth.base import ServiceUnavailableException
        def raise_servunavailexception(*args):
            raise ServiceUnavailableException('SERVUNAVAIL')
        mock_getcontacts = contacts.get_provider().api().getcontacts
        mock_getcontacts.side_effect = raise_servunavailexception
        domain = 'example.com'
        self._setup_acct_data()
        res = self.real_get(self.controller, domain)
        contacts.metrics.track.assert_called_with(
            contacts.request, 'contacts-service-unavailable',
            domain=domain)
        tools.ok_(res['result'] is None)
        tools.eq_(res['error']['provider'], domain)
        tools.eq_(res['error']['status'], 503)
        tools.ok_(res['error']['message'].startswith(
            'The service is temporarily unavailable'))

    def test_get_success(self):
        domain = 'example.com'
        self._setup_acct_data()
        mock_getcontacts = contacts.get_provider().api().getcontacts
        mock_getcontacts.return_value = ('SUCCESS', None)
        res = self.real_get(self.controller, domain)
        tools.eq_(res['result'], 'SUCCESS')
        tools.ok_(res['error'] is None)
