# Tests for invalid requests to the contacts end-point.
# This is primarily exercising missing and invalid params.
import json

from linkdrop.lib import constants

from linkdrop.tests import TestController
from linkdrop.tests import testable_services
from linkdrop.tests import url
from nose.tools import eq_


class TestContactsInvalidParams(TestController):
    def getFullRequest(self, *except_for):
        account = {"oauth_token": "foo", "oauth_token_secret": "bar",
                   "profile": {"emails": [
                            {'value': 'me@example.com'}
                            ],
                            "displayName": "Me",
                    },
                  }
        result = {'domain': 'google.com',
                  'account': json.dumps(account),
                  'to': 'you@example.com',
                }
        for elt in except_for:
            del result[elt]
        return result
        
    def checkContacts(self, request,
                  expected_message=None,
                  expected_code=constants.INVALID_PARAMS,
                  expected_status=None,
                  expected_http_code=200):

        # you must give *something* to check!
        assert expected_message or expected_code or expected_status
        domain = request.pop('domain')
        response = self.app.post(url(controller='contacts', action='get',
                                     domain=domain),
                                 params=request)
        
        assert response.status_int==expected_http_code, response.status_int
        try:
            got = json.loads(response.body)
        except ValueError:
            raise AssertionError("non-json response: %r" % (response.body,))

        assert 'error' in got, response.body
        if expected_message:
            eq_(got['error'].get('message'), expected_message, response.body)
        if expected_code:
            eq_(got['error'].get('code'), expected_code, response.body)
        if expected_status:
            eq_(got['error'].get('status'), expected_status, response.body)

    def testUnknownDomain(self):
        req = self.getFullRequest()
        req['domain'] = "foo.com"
        self.checkContacts(req)

    def testNoAccount(self):
        self.checkContacts(self.getFullRequest('account'), expected_status=401,
                           expected_code=None)

    # test missing OAuth params for each of the services.
    def checkMissingOAuth(self, service, missing_param):
        req = self.getFullRequest()
        req['domain'] = service
        acct = json.loads(req['account'])
        del acct[missing_param]
        req['account'] = json.dumps(acct)
        self.checkContacts(req, expected_status=401, expected_code=None)

    def testMissingOAuth(self):
        for service in testable_services:
            yield self.checkMissingOAuth, service, "oauth_token"

