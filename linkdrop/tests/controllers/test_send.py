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
import hashlib
import json

class TestSendController(TestController):
    domain = 'example.com'
    username = 'USERNAME'
    userid = 'USERID'

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

    def tearDown(self):
        self.req_patcher.stop()
        self.gprov_patcher.stop()
        self.metrics_patcher.stop()

    def _setup_domain(self, domain=None):
        if domain is None:
            domain = self.domain
        else:
            self.domain = domain
        send.request.POST['domain'] = domain

    def _setup_acct_data(self):
        send.request.POST['username'] = self.username
        send.request.POST['userid'] = self.userid
        acct_json = json.dumps({'username': self.username,
                                'userid': self.userid})
        send.request.POST['account'] = acct_json

    def _acct_hash(self):
        return hashlib.sha1(
            "%s#%s" % ((self.username).encode('utf-8'),
                       (self.userid).encode('utf-8'))).hexdigest()

    def _setup_provider(self, result=None, error=None):
        if result is None:
            result = dict(result='success', domain=self.domain)
        self.result = result
        self.error = error
        provider = send.get_provider()
        provider.api().sendmessage.return_value = result, error

    def test_send_no_domain(self):
        res = self.real_send(self.controller)
        tools.eq_(res['result'], dict())
        tools.eq_(res['error']['message'], "'domain' is not optional")

    def test_send_no_provider(self):
        self._setup_domain()
        send.get_provider.return_value = None
        res = self.real_send(self.controller)
        send.get_provider.assert_called_once_with(self.domain)
        tools.eq_(res['result'], dict())
        tools.eq_(res['error']['message'], "'domain' is invalid")

    def test_send_no_acct(self):
        self._setup_domain()
        res = self.real_send(self.controller)
        send.metrics.track.assert_called_with(send.request, 'send-noaccount',
                                              domain=self.domain)
        tools.eq_(res['result'], dict())
        tools.ok_(res['error']['message'].startswith(
            'not logged in or no user'))
        tools.eq_(res['error']['provider'], self.domain)
        tools.eq_(res['error']['status'], 401)

    @patch('linkdrop.controllers.send.shorten_link')
    def test_send_shorten(self, mock_shorten):
        self._setup_domain()
        self._setup_acct_data()
        self._setup_provider()
        send.request.POST['shorten'] = True
        longurl = 'www.mozilla.org/path/to/something'
        send.request.POST['link'] = longurl
        shorturl = 'http://sh.ort/url'
        mock_shorten.return_value = shorturl
        res = self.real_send(self.controller)
        mock_shorten.assert_called_once_with('http://'+longurl)
        timer_args = send.metrics.start_timer.call_args_list
        tools.eq_(len(timer_args), 2)
        tools.eq_(timer_args[0], ((send.request,), dict(long_url=longurl)))
        tools.eq_(timer_args[1][0][0], send.request)
        tools.eq_(timer_args[1][1]['long_url'], 'http://'+longurl)
        tools.eq_(timer_args[1][1]['short_url'], shorturl)
        tools.eq_(timer_args[1][1]['acct_id'], self._acct_hash())
        mock_timer = send.metrics.start_timer()
        track_args = mock_timer.track.call_args_list
        tools.eq_(len(track_args), 2)
        tools.eq_(track_args[0], (('link-shorten',),
                                 dict(short_url=shorturl)))
        tools.eq_(track_args[1], (('send-success',),))
        tools.eq_(res, dict(result=self.result, error=self.error))
        tools.eq_(res['result']['shorturl'], shorturl)

    def test_send_oauthkeysexception(self):
        from linkoauth.base import OAuthKeysException
        def raise_oauthkeysexception(*args):
            raise OAuthKeysException('OAUTHKEYSEXCEPTION')
        mock_sendmessage = send.get_provider().api().sendmessage
        mock_sendmessage.side_effect = raise_oauthkeysexception
        self._setup_domain()
        self._setup_acct_data()
        res = self.real_send(self.controller)
        send.metrics.track.assert_called_with(send.request,
                                              'send-oauth-keys-missing',
                                              domain=self.domain)
        tools.eq_(res['result'], dict())
        tools.eq_(res['error']['provider'], self.domain)
        tools.ok_(res['error']['message'].startswith(
            'not logged in or no user account'))
        tools.eq_(res['error']['status'], 401)

    def test_send_serviceunavailexception(self):
        from linkoauth.base import ServiceUnavailableException
        debug_msg = 'DEBUG'
        def raise_servunavailexception(*args):
            e = ServiceUnavailableException('SERVUNAVAIL')
            e.debug_message = debug_msg
            raise e
        mock_sendmessage = send.get_provider().api().sendmessage
        mock_sendmessage.side_effect = raise_servunavailexception
        self._setup_domain()
        self._setup_acct_data()
        res = self.real_send(self.controller)
        send.metrics.track.assert_called_with(send.request,
                                              'send-service-unavailable',
                                              domain=self.domain)
        tools.eq_(res['result'], dict())
        tools.eq_(res['error']['provider'], self.domain)
        tools.ok_(res['error']['message'].startswith(
            'The service is temporarily unavailable'))
        tools.eq_(res['error']['status'], 503)
        tools.eq_(res['error']['debug_message'], debug_msg)

    def test_send_error(self):
        self._setup_domain()
        self._setup_acct_data()
        mock_sendmessage = send.get_provider().api().sendmessage
        errmsg = 'ERROR'
        mock_sendmessage.return_value = (dict(), errmsg)
        res = self.real_send(self.controller)
        mock_timer = send.metrics.start_timer()
        mock_timer.track.assert_called_with('send-error', error=errmsg)
        tools.eq_(res['result'], dict())
        tools.eq_(res['error'], errmsg)

    def test_send_success(self):
        self._setup_domain()
        self._setup_acct_data()
        to_ = 'hueylewis@example.com'
        send.request.POST['to'] = to_
        mock_sendmessage = send.get_provider().api().sendmessage
        mock_sendmessage.return_value = (
            dict(message='SUCCESS'), dict())
        res = self.real_send(self.controller)
        mock_timer = send.metrics.start_timer()
        mock_timer.track.assert_called_with('send-success')
        tools.eq_(res['result']['message'], 'SUCCESS')
        tools.ok_(res['result']['shorturl'] is None)
        tools.eq_(res['result']['from'], self.userid)
        tools.eq_(res['result']['to'], to_)
