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

from linkdrop.controllers import send
from linkdrop.tests import TestController
from mock import patch
from nose import tools


class TestSendController(TestController):
    def setUp(self):
        self.req_patcher = patch('linkdrop.controllers.send.request')
        self.gprov_patcher = patch(
            'linkdrop.controllers.send.get_provider')
        self.metrics_patcher = patch(
            'linkdrop.controllers.send.metrics')
        self.req_patcher.start()
        self.gprov_patcher.start()
        self.metrics_patcher.start()
        send.request.POST = dict()
        self.controller = send.SendController()
        self.real_send = self.controller.send.undecorated.undecorated

    def _setup_domain(self):
        domain = 'example.com'
        send.request.POST['domain'] = domain
        return domain

    def test_send_no_domain(self):
        res = self.real_send(self.controller)
        tools.eq_(res['result'], dict())
        tools.eq_(res['error']['message'], "'domain' is not optional")

    def test_send_no_provider(self):
        domain = self._setup_domain()
        send.get_provider.return_value = None
        res = self.real_send(self.controller)
        send.get_provider.assert_called_once_with(domain)
        tools.eq_(res['result'], dict())
        tools.eq_(res['error']['message'], "'domain' is invalid")

    def test_send_no_acct(self):
        domain = self._setup_domain()
        res = self.real_send(self.controller)
        send.metrics.track.assert_called_with(send.request, 'send-noaccount',
                                              domain=domain)
        tools.eq_(res['result'], dict())
        tools.ok_(res['error']['message'].startswith('not logged in or no user'))
        tools.eq_(res['error']['provider'], domain)
        tools.eq_(res['error']['status'], 401)

