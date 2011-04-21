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
# The Original Code is F1.
#
# The Initial Developer of the Original Code is Mozilla
# Portions created by the Initial Developer are Copyright (C) 2011
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#


# Test that some request headers make it all the way to the service.
# Currently the only such header is "Accept-Language"

from linkoauth import get_providers

from test_playback import (HttpReplayer, setupReplayers, teardownReplayers,
                           domain_to_test)

from nose import with_setup
from nose.tools import eq_

# A fake response object we return to the apis - we just pretend a 500
# error occured every time after checking the header we expect is there.
class FakeResponse(dict):
    def __init__(self):
        self['status'] = "500"

    def __getattr__(self, attr):
        try:
            return self[attr]
        except KeyError:
            raise AttributeError(attr)


class SimpleHttpReplayer(HttpReplayer):
    _expected_language = None
    def request(self, uri, method="GET", body=None, headers=None, **kw):
        # check the header is (or is not) sent to the service.
        for k, v in (headers or {}).iteritems():
            if k.lower()=="accept-language":
                eq_(v, self._expected_language)
                break
        else:
            assert self._expected_language is None
        # just return a 500 so things bail quickly.
        return FakeResponse(), ""


def doSetup():
    setupReplayers(SimpleHttpReplayer)


@with_setup(doSetup, teardownReplayers)
def check_with_headers(provider, req_type, exp_language, headers=None):
    SimpleHttpReplayer._expected_language = exp_language
    testclass = domain_to_test[provider]
    test = testclass()
    request = test.getDefaultRequest(req_type)
    response = test.getResponse(req_type, request, headers)

def test_all():
    for provider in get_providers():
        if provider in ["google.com", "googleapps.com"]:
            # these use SMTP which doesn't attempt to pass on the header.
            continue
        for req_type in ['send', 'contacts']:
            # test no header in f1 request means no header in service req.
            yield (check_with_headers, provider, req_type, None)
            # test "normal" case header makes it through.
            yield (check_with_headers, provider, req_type, 'something',
                   {'Accept-Language': 'something'})
            # test lower-case header names it through.
            yield (check_with_headers, provider, req_type, 'something-else',
                   {'accept-language': 'something-else'})
