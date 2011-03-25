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
# Contributor(s): Tarek Ziade <tarek@mozilla.com>
#
import urllib2
import json

from linkdrop.tests import TestController
from linkdrop.tests.functional.proxy import recproxy


class TestSendController(TestController):

    @recproxy('https', 'twitter.com', 'test_send.rec')
    def test_send(self):
        # my twitter account
        account = {"username": "tarekmoz",
                   "profile": {"displayName": "tarekmoz",
                               "providerName": "Twitter",
                               "photos":[]},
                   "accounts":[{"username":"tarekmoz",
                                "domain":"twitter.com",
                                "userid":270831117}],
                   "published":"Wed Mar 23 10:06:50 +0000 2011",
                   "identifier": "http://twitter.com/?id=270831117",
                   "domain": "twitter.com",
                   "oauth_token_secret": "***",
                   "userid": "270831117",
                   "updated": "2011-03-23T11:08:43.643771",
                   "oauth_token": "***",
                   "key":"***"}

        # the twitt to be sent
        data = {'username': u'tarekmoz', 'domain': u'twitter.com',
                'description': u'Today we journey as pythonauts',
                'title': u'Adventures in PyOpenCL: Part 2',
                'shareType': u'public', 'userid': u'270831117',
                'account': json.dumps(account),
                'shorturl': u'http://wp.me/pgWjI-7X',
                'link': u'http://enja.org/2011/03/22/adventures-in-'
                          'pyopencl-part-2-particles-with-pyopengl/'}

        # calling the send API
        res = self.app.post('/api/send', data)

        # did the send go through ?
        result = res.json
        self.assertEqual(result['result']['shorturl'], 'http://wp.me/pgWjI-7X')
