# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
# The Original Code is Sync Server
#
# The Initial Developer of the Original Code is the Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2010
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Tarek Ziade (tarek@mozilla.com)
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****
"""Proxy that can be used to record and replay requests
"""
import os
import re
import sys
from wsgiref.simple_server import make_server
from StringIO import StringIO
import threading
import atexit
import urllib2
from functools import wraps

from util import proxy
from webob.dec import wsgify
from webob.exc import HTTPBadRequest
from webob import Response

_DATA = None
_SERVER = None

_SEP = '\n=======\n'
_SEP2 = '\n====\n'

class ReqRespFile(dict):
    def __init__(self, path):
        self.path = path

        if not os.path.exists(path):
            return

        with open(path) as f:
            content = f.read().split(_SEP)

        for pair in content:
            pair = pair.split(_SEP2)
            if len(pair) != 2:
                continue
            req, resp = pair
            self[req] = resp

    def sync(self):
        with open(self.path, 'w') as f:
            for req, resp in self.items():
                f.write(req)
                f.write(_SEP2)
                f.write(resp)
                f.write(_SEP)

    close = sync


def _open_data(path):
    global _DATA
    _DATA = ReqRespFile(path)


def _close_data():
    if _DATA is None:
        return
    _DATA.close()


atexit.register(_close_data)


class ProxyApp(object):
    def __init__(self, config):
        self.config = config
        _open_data(self.config['data'])

    @wsgify
    def __call__(self, request):
        config = self.config

        if config['proxy']:
            scheme = config.get('scheme', 'http')
            netloc = config['netloc'].rstrip()
            path = request.environ['PATH_INFO']
            print 'Proxying to %s://%s%s' % (scheme, netloc, path)
            if 'HTTP_AUTHORIZATION' in request.environ:
                request._authorization = request.environ['HTTP_AUTHORIZATION']
            response = proxy(request, scheme, netloc, timeout=15)
            _DATA[str(request)] = str(response)
            _DATA.sync()
            return response

        resp = self._find_resp(str(request))

        if resp is None:
            raise HTTPBadRequest()

        return Response.from_file(StringIO(resp))

    def _find_resp(self, req):
        for sreq, resp in _DATA.items():
            pattern = sreq.replace('XXX', '.*?')
            res = re.match(pattern, req)
            if res is not None:
                return resp
        return None

class ThreadedServer(threading.Thread):
    def __init__(self, server):
        threading.Thread.__init__(self)
        self.server = server

    def run(self):
        self.server.serve_forever()

    def join(self):
        self.server.shutdown()
        threading.Thread.join(self)


_NETLOC = None


def start(config, background=True, beforestart=None, port=-1):
    server = make_server('', port, ProxyApp(config))
    port = server.server_address[-1]

    def _open(req, timeout=None):
        host = req.get_host()
        data = req.data
        if host == config['netloc']:
            method = req.get_method()
            path = req.get_selector()
            headers = dict(req.headers)
            url = 'http://localhost:%d%s' % (port, path)
            req = urllib2.Request(url, data, headers)
            req.get_method = lambda: method

        return urllib2.old_urlopen(req, timeout=timeout)

    urllib2.old_urlopen = urllib2.urlopen
    urllib2.urlopen = _open

    if not background:
        if beforestart is not None:
            beforestart(port)
        server.serve_forever()
    else:
        global _SERVER
        if _SERVER is not None:
            return
        _SERVER = ThreadedServer(server)
        _SERVER.start()
        return port


def stop():
    urllib2.urlopen = urllib2.old_urlopen

    global _SERVER
    if _SERVER is None:
        return
    _SERVER.join()
    _SERVER = None


def recproxy(scheme, netloc, record):
    def _proxy(func):
        @wraps(func)
        def __proxy(*args, **kw):
            test_file = sys.modules[func.__module__].__file__
            location = os.path.dirname(test_file)
            record_ = os.path.join(location, record)
            proxy_config = {'scheme': scheme,
                            'proxy': os.getenv('PROXY', False),
                            'netloc': netloc,
                            'data': record_}
            start(proxy_config)
            try:
                return func(*args, **kw)
            finally:
                stop()

        return __proxy
    return _proxy


if __name__ == '__main__':
    config = {'proxy': False,
              'netloc': 'localhost:5000',
              'data': 'data'}

    try:

        def _start(port):
            print 'Running on localhost:%d' % port

        start(config, background=False, beforestart=_start)
    except KeyboardInterrupt:
        pass
