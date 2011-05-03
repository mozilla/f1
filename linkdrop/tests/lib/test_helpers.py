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

from linkdrop.lib import helpers
from linkdrop.tests import TestController
from mock import Mock
from mock import patch
from nose import tools
import json
import pprint


class TestHelpers(TestController):
    @patch.dict('linkdrop.lib.helpers.status_map', {302: Mock()})
    def test_get_redirect_response(self):
        url = 'http://www.example.com/some/path'
        addl_headers = [('foo', 'bar'), ('baz', 'batch')]
        helpers.get_redirect_response(url, additional_headers=addl_headers)
        mock_resp = helpers.status_map[302]
        mock_resp.assert_called_once_with(location=url)
        headers_add_args = [args[0] for args in
                            mock_resp().headers.add.call_args_list if args]
        tools.eq_(dict(addl_headers), dict(headers_add_args))

    def test_safeHTML(self):
        unsafe = """
        <html><body><script>alert('hi');</script>
        <p id=foo>sometext&#169;&nbsp;&nbspp;
        <p id="bar">othertext</p></body></html>
        """
        safe = helpers.safeHTML(unsafe)
        tools.ok_('html' not in safe)
        tools.ok_('script' not in safe)
        tools.ok_('</p>' in safe)
        tools.ok_('&#169;' in safe)
        tools.ok_('&nbspp;' not in safe)
        tools.ok_('&nbspp' in safe)
        tools.ok_('id=foo' not in safe)
        tools.ok_('id="foo"' in safe)

    @patch('linkdrop.lib.helpers.log')
    @patch('linkdrop.lib.helpers.metrics')
    def test_json_exception_response(self, mock_metrics, mock_log):
        # first make sure HTTPException gets passed through
        from webob.exc import HTTPException
        http_exc = HTTPException('msg', 'wsgi_response')
        request = Mock()

        @helpers.json_exception_response
        def http_exception_raiser(self, request):
            raise http_exc
        tools.assert_raises(HTTPException, http_exception_raiser, None,
                            request)

        # then make sure other exceptions get converted to JSON
        @helpers.json_exception_response
        def other_exception_raiser(self, request):
            exc = Exception('EXCEPTION')
            raise exc
        res = other_exception_raiser(None, request)
        tools.ok_(res['result'] is None)
        tools.eq_(res['error']['name'], 'Exception')
        tools.eq_(res['error']['message'], 'EXCEPTION')
        track_args = mock_metrics.track.call_args
        tools.eq_(track_args[0][1], 'unhandled-exception')
        tools.eq_(track_args[1]['function'], 'other_exception_raiser')
        tools.eq_(track_args[1]['error'], 'Exception')

    def test_api_response(self):
        data = {'foo': 'bar', 'baz': 'bawlp'}

        @helpers.api_response
        def sample_data(self, request):
            return data
        request = Mock()
        response = request.response  # another Mock

        # json format
        request.params = dict()
        response.headers = dict()
        res = sample_data(None, request)
        tools.eq_(res, json.dumps(data))
        tools.eq_(response.headers['Content-Type'], 'application/json')

        # "test" format (i.e. pprinted output)
        request.params['format'] = 'test'
        response.headers = dict()
        res = sample_data(None, request)
        tools.eq_(res, pprint.pformat(data))
        tools.eq_(response.headers['Content-Type'], 'text/plain')

        # xml format / dict
        request.params['format'] = 'xml'
        response.headers = dict()
        res = sample_data(None, request)
        xml = ('<?xml version="1.0" encoding="UTF-8"?><response>'
               '<foo>bar</foo><baz>bawlp</baz></response>')
        tools.eq_(res, xml)
        tools.eq_(response.headers['Content-Type'], 'text/xml')

        # xml format / list
        data = ['foo', 'bar', 'baz', 'bawlp']

        @helpers.api_response
        def sample_data2(self, request):
            return data
        request.params['format'] = 'xml'
        response.headers = dict()
        res = sample_data(None, request)
        xml = ('<?xml version="1.0" encoding="UTF-8"?><response>foo</response>'
               '<response>bar</response><response>baz</response><response>'
               'bawlp</response>')
        tools.eq_(res, xml)
        tools.eq_(response.headers['Content-Type'], 'text/xml')

    def test_api_entry(self):
        @helpers.api_entry(
            doc="DOC",
            queryargs=[
                helpers.api_arg('qryarg1', 'string', True, None, None,
                                "QryArg1 Doc"),
                helpers.api_arg('qryarg2', 'boolean', False, True, None,
                                "QryArg2 Doc"),
                ],
            bodyargs=[
                helpers.api_arg('bodyarg1', 'string', True, None, None,
                                'BodyArg1 Doc'),
                helpers.api_arg('bodyarg2', 'boolean', False, True, None,
                                'BodyArg2 Doc'),
                ],
            response={'type': 'list', 'doc': 'callargs list'},
            name='NAME')
        def api_fn(arg1, arg2, kwarg1=None, kwarg2=None):
            return [(arg1, arg2), dict(kwarg1=kwarg1, kwarg2=kwarg2)]
        res = api_fn(1, 2, kwarg1='foo', kwarg2='bar')
        tools.eq_(res, [(1, 2), dict(kwarg1='foo', kwarg2='bar')])
        tools.ok_(api_fn.__doc__.startswith('NAME\n===='))
        tools.ok_("qryarg1              string     QryArg1 Doc (required)"
                  in api_fn.__doc__)
        tools.ok_("qryarg2              boolean    QryArg2 Doc (default=True)"
                  in api_fn.__doc__)
        tools.ok_("**Request Body**: A JSON object" in api_fn.__doc__)
        tools.ok_("bodyarg1             string     BodyArg1 Doc (required)"
                  in api_fn.__doc__)
        tools.ok_("**Response Body**: list       callargs list"
                  in api_fn.__doc__)

        @helpers.api_entry(
            doc="DOC",
            body={'type': 'list', 'doc': 'body list'},
            )
        def api_fn2():
            return
        tools.ok_("**Request Body**:  list       body list"
                  in api_fn2.__doc__)
