import os
import json
import httplib2
import random
import time
import logging
import urlparse

import oauth2
from pylons import config
from paste.deploy.converters import asbool

log = logging.getLogger(__name__)

# A capturing base-class - not specific to a single protocol
class ProtocolCapturingBase(object):
    pc_protocol = None # should be set by sub-classes
    def __init__(self, host=None):
        assert self.pc_protocol is not None # set this on the subclass!

    def pc_get_host(self):
        raise NotImplementedError() # subclasses must provide this

    def _save_capture(self, dirname):
        raise NotImplementedError() # subclasses must provide this

    def save_capture(self, reason="no reason"):
        host = self.pc_get_host()
        try:
            base_path = config.get('protocol_capture_path')
            if not base_path:
                log.warn("want to write a request capture, but no protocol_capture_path is defined")
                return
            if not os.path.isdir(base_path):
                log.warn("want to write a request capture, but directory %r does not exist", base_path)
                return
            thisdir = "%s-%s-%s-%s" % (self.pc_protocol, host, time.time(), random.getrandbits(32))
            dirname = os.path.join(base_path, thisdir)
            os.makedirs(dirname)
            # call the subclass to save itself and return the metadata
            meta = {'protocol': self.pc_protocol, 'reason': reason}
            submeta = self._save_capture(dirname)
            if submeta:
                meta.update(submeta)
            meta_file = os.path.join(dirname, "meta.json")
            with open(meta_file, "wb") as f:
                json.dump(meta, f, sort_keys=True, indent=4)
                f.write("\n")
            log.info("wrote '%s' capture to %s", self.pc_protocol, dirname)
        except Exception:
            log.exception("failed to write a capture log")

# Stuff for http captures
    
# In memory repr is
# {'uri': full URI initiating the sequence
#  'connections': [list of connection made]
# }
# connections will usually have 1 entry but may have more due to things
# like redirects and the auto retry capability builtin to httplib2.
class RecordingHttpBase(object):
    def __init__(self):
        self.capture = None

    def request(self, uri, *args):
        self.capture = {'uri': uri, 'connections': []}
        return super(RecordingHttpBase, self).request(uri, *args)

    def _conn_request(self, conn, request_uri, method, body, headers):
        connections = self.capture['connections']
        this_con = {'path': request_uri, 'method': method, 'body': body, 'headers': headers}
        connections.append(this_con)
        try:
            response, content = super(RecordingHttpBase, self)._conn_request(conn, request_uri, method, body, headers)
        except Exception, e:
            this_con['exception'] = e
            raise
        this_con['response_headers'] = response
        this_con['response_status'] = response.status
        this_con['response_reason'] = response.reason
        this_con['content'] = content
        return response, content

class RecordingHttplib2(RecordingHttpBase, httplib2.Http):
    def __init__(self):
        httplib2.Http.__init__(self)
        RecordingHttpBase.__init__(self)


class HttpRequestor(ProtocolCapturingBase):
    """This class can be used for trivial uses of the httplib2 library, where
    only the 'request' method is called.
    """
    pc_protocol = 'http'
    pc_http_class = RecordingHttplib2
    def __init__(self, *args, **kw):
        ProtocolCapturingBase.__init__(self)
        self.http = self.pc_http_class(*args, **kw)

    def pc_get_host(self):
        return urlparse.urlparse(self.http.capture['uri']).netloc

    def request(self, uri, method="GET", body=None, headers=None):
        response, data = self.http.request(uri, method, body, headers)
        if response['status']=='200' and asbool(config.get('protocol_capture_success')):
            self.save_capture("automatic success save")
        return response, data

    def _save_capture(self, dirname):
        capture = self.http.capture
        for i, con in enumerate(capture['connections']):
            req_file = os.path.join(dirname, "request-%d" % i)
            with open(req_file, "wb") as f:
                f.write("%s %s\r\n" % (con['method'], con['path']))
                for n, v in con['headers'].iteritems():
                    f.write("%s: %s\r\n" % (n, v))
                f.write("\r\n")
                if con['body']:
                     f.write(con['body'])
            if 'response_status' in con:
                resp_file = os.path.join(dirname, "response-%d" % i)
                with open(resp_file, "wb") as f:
                    f.write("HTTP/1.1 %s %s\r\n" % (con['response_status'], con['response_reason']))
                    for n, v in con['response_headers'].iteritems():
                        if n != "transfer-encoding": # we don't chunk on replay...
                            f.write("%s: %s\r\n" % (n, v))
                    f.write("\r\n")
                    f.write(con['content'])
            # XXX - todo - exceptions!
        return {'uri': capture['uri']}

# For code which uses the oauth2 library - still httplib2 based but with
# a class in the middle of the inheritance tree.
class RecordingOauth2(RecordingHttpBase, oauth2.Client):
    def __init__(self, *args, **kw):
        oauth2.Client.__init__(self, *args, **kw)
        RecordingHttpBase.__init__(self)

class OAuth2Requestor(HttpRequestor):
    pc_http_class = RecordingOauth2
