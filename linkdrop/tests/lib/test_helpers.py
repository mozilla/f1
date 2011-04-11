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
        @helpers.json_exception_response
        def http_exception_raiser():
            raise http_exc
        tools.assert_raises(HTTPException, http_exception_raiser)

        # then make sure other exceptions get converted to JSON
        @helpers.json_exception_response
        def other_exception_raiser():
            exc = Exception('EXCEPTION')
            raise exc
        res = other_exception_raiser()
        tools.ok_(res['result'] is None)
        tools.eq_(res['error']['name'], 'Exception')
        tools.eq_(res['error']['message'], 'EXCEPTION')
        track_args = mock_metrics.track.call_args
        tools.eq_(track_args[0][1], 'unhandled-exception')
        tools.eq_(track_args[1]['function'], 'other_exception_raiser')
        tools.eq_(track_args[1]['error'], 'Exception')

    @patch('linkdrop.lib.helpers.get_pylons')
    def test_api_response(self, mock_get_pylons):
        data = {'foo': 'bar', 'baz': 'bawlp'}
        @helpers.api_response
        def sample_data():
            return data
        request = mock_get_pylons().request
        response = mock_get_pylons().response
        # json format
        request.params = dict()
        response.headers = dict()
        res = sample_data()
        tools.eq_(res, json.dumps(data))
        tools.eq_(response.headers['Content-Type'], 'application/json')

        # "test" format (i.e. pprinted output)
        request.params['format'] = 'test'
        response.headers = dict()
        res = sample_data()
        tools.eq_(res, pprint.pformat(data))
        tools.eq_(response.headers['Content-Type'], 'text/plain')

        # xml format / dict
        request.params['format'] = 'xml'
        response.headers = dict()
        res = sample_data()
        xml = ('<?xml version="1.0" encoding="UTF-8"?><response>'
               '<foo>bar</foo><baz>bawlp</baz></response>')
        tools.eq_(res, xml)
        tools.eq_(response.headers['Content-Type'], 'text/xml')

        # xml format / list
        data = ['foo', 'bar', 'baz', 'bawlp']
        @helpers.api_response
        def sample_data2():
            return data
        request.params['format'] = 'xml'
        response.headers = dict()
        res = sample_data()
        xml = ('<?xml version="1.0" encoding="UTF-8"?><response>foo</response>'
               '<response>bar</response><response>baz</response><response>'
               'bawlp</response>')
        tools.eq_(res, xml)
        tools.eq_(response.headers['Content-Type'], 'text/xml')
