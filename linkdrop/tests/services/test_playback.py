import sys
import os
import glob
import httplib
import httplib2
import urllib
import json
import socket
import email
import difflib
from urlparse import parse_qsl
from pprint import pformat
from nose.tools import eq_
from nose import with_setup

from linkdrop.tests import TestController
from linkdrop.tests import url


def assert_dicts_equal(got, expected):
    if got != expected:
        diff = "\n".join(difflib.unified_diff(pformat(expected).splitlines(),
                                              pformat(got).splitlines()))
        raise AssertionError("dictionaries are different\n%s" % (diff,))


def assert_dicts_with_oauth_equal(got, expected):
    # oauth params are a PITA for various reasons - the playback responses
    # generally don't include them - but even if they did they would not
    # match as the signature is based on the content which we have probably
    # redacted.  So we just nuke all OAuth tokens from 'expected'
    for k in expected.keys():
        if k.startswith("oauth_"):
            del expected[k]

    if got != expected:
        diff = "\n".join(difflib.unified_diff(pformat(expected).splitlines(),
                                              pformat(got).splitlines()))
        raise AssertionError("dictionaries are different\n%s" % (diff,))


def assert_messages_equal(got, expected):
    gotpl = got.get_payload(decode=True)
    expectedpl = expected.get_payload(decode=True)
    if isinstance(gotpl, list):
        assert isinstance(expectedpl, list)
        eq_(len(gotpl), len(expectedpl))
        for got_elt, expected_elt in zip(gotpl, expectedpl):
            assert_messages_equal(got_elt, expected_elt)
    else:
        eq_(got.get_content_type(), expected.get_content_type())
        if got.get_content_type() == "application/x-www-form-urlencoded":
            got_items = dict(parse_qsl(gotpl))
            expected_items = dict(parse_qsl(expectedpl))
            assert_dicts_with_oauth_equal(got_items, expected_items)
        elif got.get_content_type() == "application/json":
            got_items = json.loads(gotpl)
            expected_items = json.loads(expectedpl)
            assert_dicts_equal(got_items, expected_items)
        elif gotpl is None:
            assert expectedpl is None
        else:
            # rstrip the payloads as some of our corpus items have trailing
            # newlines to stop git/hg/etc complaining...
            eq_(gotpl.rstrip(), expectedpl.rstrip())


# Somewhat analogous to a protocap.ProtocolCapturingBase object - but
# instead of capturing, it replays an earlier capture.
# In general, the request we make to the service is ignored - we just
# replay back the pre-canned responses.
class ProtocolReplayer(object):
    def __init__(self, *args, **kw):
        pass

    def save_capture(self, reason=""):
        pass


class HttpReplayer(ProtocolReplayer):
    to_playback = []

    def request(self, uri, method="GET", body=None, headers=None, **kw):
        freq, fresp = self.to_playback.pop(0)
        if freq is not None:
            # We have an 'expected request' file - check it is what
            # is actually being requested.
            reqmethod, reqpath = freq.readline().strip().split(" ", 1)
            eq_(method, reqmethod)
            proto, rest = urllib.splittype(uri)
            host, path = urllib.splithost(rest)
            eq_(path, reqpath)
            reqob = email.message_from_string(freq.read().rstrip())
            headers = headers or {}
            if method == "POST":
                for n in headers.keys():
                    if n.lower() == "content-type":
                        break
                else:
                    headers['Content-Type'] = ("application/"
                                               "x-www-form-urlencoded")
            # We may wind up with the oauth stuff creating an 'Authorization'
            # header as unicode.  Force all headers back to a string and if
            # any blow up as being non-ascii, we have a deeper problem...
            gotheadersstr = "\r\n".join(
                    ["%s: %s" % (n, v.encode("ascii"))
                     for n, v in headers.iteritems()])
            bodystr = gotheadersstr + "\r\n\r\n" + (body or '')
            gotob = email.message_from_string(bodystr)
            if headers:
                if 'content-type' in gotob:
                    eq_(gotob.get_content_type(), reqob.get_content_type())
                else:
                    assert 'content-type' not in reqob
                # only check the headers specified - additional headers
                # may have been added by httplib but we can ignore them.
                for hname, hval in headers.iteritems():
                    if hname.lower() in ["content-length", "content-type",
                                         "authorization"]:
                        continue
                    # otherwise the header must match exactly.
                    eq_(hval, reqob[hname])
            # finally check the content (ie, the body) is as expected.
            assert_messages_equal(gotob, reqob)

        resp = httplib.HTTPResponse(socket.socket())
        resp.fp = fresp
        resp.begin()
        content = resp.read()
        return httplib2.Response(resp), content


from linkoauth.backends.google_ import SMTP


class SmtpReplayer(SMTP, ProtocolReplayer):
    to_playback = None

    def __init__(self, *args, **kw):
        self.next_playback = self.to_playback.readline()
        SMTP.__init__(self, *args, **kw)
        self.sock = socket.socket()

    def save_captures(self, reason=""):
        pass

    def set_debuglevel(self, debuglevel):
        pass  # don't want the print statements during testing.

    def connect(self, host='localhost', port=0):
        return self.getreply()

    def _get_next_comms(self):
        result = []
        line = self.next_playback
        if line.startswith("E "):
            # a recorded exception - reconstitute it...
            exc_info = json.loads(line[2:])
            module = (sys.modules[exc_info['module']]
                      if exc_info['module'] else __builtins__)
            exc_class = getattr(module, exc_info['name'])
            raise exc_class(*tuple(exc_info['args']))
        if not line.startswith("< ") and not line.startswith("> "):
            # hrm - this implies something is wrong maybe?
            raise RuntimeError("strange: %r" % (line,))
        direction = line[0]
        result.append(line[2:].strip())
        while True:
            line = self.next_playback = self.to_playback.readline()
            if not line.startswith("+ "):
                break
            # a continuation...
            result.append(line[2:].strip())
        return direction, "\n".join(result)

    def getreply(self):
        direction, data = self._get_next_comms()
        if direction != "<":
            # hrm - this implies something is wrong maybe?
            raise RuntimeError("playback is out of sync")
        code = int(data[:3])
        errmsg = data[3:]
        return code, errmsg

    def send(self, str):
        direction, data = self._get_next_comms()
        if direction != ">":
            # hrm - this implies something is wrong maybe?
            raise RuntimeError("playback is out of sync")
        # we just throw the data away!

    def quit(self):
        SmtpReplayer.to_playback.close()
        SmtpReplayer.to_playback = None


class CannedRequest(object):
    def __init__(self, path):
        meta_filename = os.path.join(path, "meta.json")
        self.path = path
        (self.protocol, self.host,
         self.req_type, self.comments) = os.path.basename(path).split("-", 3)
        with open(meta_filename) as f:
            self.meta = json.load(f)

    def __repr__(self):
        return "<canned request at '%s'>" % (self.path,)


def genCanned(glob_pattern="*"):
    import linkdrop.tests.services
    corpus_dir = os.path.join(linkdrop.tests.services.__path__[0], 'corpus')
    num = 0
    for dirname in glob.glob(os.path.join(corpus_dir, glob_pattern)):
        meta_fname = os.path.join(dirname, "meta.json")
        if os.path.isfile(meta_fname):
            yield CannedRequest(dirname)
            num += 1
    if not num:
        raise AssertionError("No tests match %r" % (glob_pattern,))


class ServiceReplayTestCase(TestController):
    def checkResponse(self, canned, response):
        # First look for an optional 'expected-f1-response.json' which
        # allows custom status and headers to be specified.
        try:
            with open(os.path.join(canned.path,
                                   "expected-f1-response.json")) as f:
                expected = json.load(f)
        except IOError:
            # No expected-f1-response - assume this means a 200 is
            # expected and expected-f1-data.json has what we want.
            pass
        else:
            assert response.status_int == expected['status'], (
                response.status_int, expected['status'])
            for exp_header_name, exp_header_val in expected.get(
                'headers', {}).iteritems():
                got = response.headers.get(exp_header_name, None)
                assert got == exp_header_val, (got, exp_header_val)
            return

        # No expected-f1-response.json - do the expected-f1-data thang...
        assert response.status_int == 200, response.status
        try:
            got = json.loads(response.body)
        except ValueError:
            raise AssertionError("non-json response: %r" % (response.body,))
        try:
            with open(os.path.join(canned.path, "expected-f1-data.json")) as f:
                expected = json.load(f)
        except IOError:
            print "*** No 'expected-f1-data.json' in '%s'" % (canned.path,)
            print "The F1 response was:"
            print json.dumps(got, sort_keys=True, indent=4)
            raise AssertionError("expected-f1-data.json is missing")
        # do a little massaging of the data to avoid too much noise.
        for top in ["error", "result"]:
            sub = expected.get(top)
            if sub is None:
                continue
            for subname, subval in sub.items():
                if subval == "*":
                    # indicates any value is acceptable.
                    assert subname in got[top], ("no attribute [%r][%r]"
                                                 % (top, subname))
                    del got[top][subname]
                    del expected[top][subname]
        assert_dicts_equal(got, expected)

    def getResponse(self, canned, request):
        req_type = canned.req_type
        if req_type == "send":
            response = self.app.post(url(controller='send', action='send'),
                                    params=request)
        elif req_type == "contacts":
            # send the 'contacts' request.
            domain = request.pop('domain')
            response = self.app.post(url(controller='contacts',
                                         action='get', domain=domain),
                                     params=request)
        elif req_type == "auth":
            # this is a little gross - we need to hit "authorize"
            # direct, then assume we got redirected to the service,
            # which then redirected us back to 'verify'
            request['end_point_auth_failure'] = "/failure"
            request['end_point_auth_success'] = "/success"
            response = self.app.post(url(controller='account',
                                         action='authorize'),
                                     params=request)
            assert response.status_int == 302
            # and even more hacky...
            request['provider'] = request.pop('domain')
            request['code'] = "the_code"
            response = self.app.get(url(controller='account',
                                        action='verify'),
                                    params=request)
        else:
            raise AssertionError(req_type)
        return response


class FacebookReplayTestCase(ServiceReplayTestCase):
    def getDefaultRequest(self, req_type):
        if req_type == "send" or req_type == "contacts":
            return {'domain': 'facebook.com',
                    'shareType': 'wall',
                    'account': ('{"oauth_token": "foo", '
                                '"oauth_token_secret": "bar"}'),
                   }
        if req_type == "auth":
            return {'domain': 'facebook.com', 'username': 'foo',
                    'userid': 'bar'}
        raise AssertionError(req_type)


class TwitterReplayTestCase(ServiceReplayTestCase):
    def getDefaultRequest(self, req_type):
        if req_type == "send" or req_type == "contacts":
            account = {"oauth_token": "foo", "oauth_token_secret": "bar",
                       "username": "mytwitterid"}
            return {'domain': 'twitter.com',
                    'shareType': 'public',
                    'account': json.dumps(account),
                   }
        if req_type == "auth":
            return {'domain': 'twitter.com', 'username': 'foo',
                    'userid': 'bar'}
        raise AssertionError(req_type)


class YahooReplayTestCase(ServiceReplayTestCase):
    def getDefaultRequest(self, req_type):
        if req_type == "send" or req_type == "contacts":
            account = {"oauth_token": "foo", "oauth_token_secret": "bar",
                       "profile": {
                       "verifiedEmail": "me@yahoo.com",
                       "displayName": "me",
                       }
                      }
            return {'domain': 'yahoo.com',
                    'to': 'you@example.com',
                    'account': json.dumps(account),
                   }
        if req_type == "auth":
            return {'domain': 'yahoo.com', 'username': 'foo', 'userid': 'bar'}
        raise AssertionError(req_type)


class GoogleReplayTestCase(ServiceReplayTestCase):
    def getDefaultRequest(self, req_type):
        if req_type == "send":
            account = {"oauth_token": "foo", "oauth_token_secret": "bar",
                       "profile": {"emails": [{'value': 'me@example.com'}],
                                   "displayName": "Me",
                        },
                      }
            return {'domain': 'google.com',
                    'account': json.dumps(account),
                    'to': 'you@example.com',
                    }
        if req_type == "contacts":
            account = {"oauth_token": "foo", "oauth_token_secret": "bar",
                       "profile": {"emails": [{'value': 'me@example.com'}],
                                "displayName": "Me",
                        },
                      }
            return {'username': 'me',
                    'userid': '123',
                    'keys': "1,2,3",
                    'account': json.dumps(account),
                    'domain': 'google.com',
                   }
        raise AssertionError(req_type)


class LinkedinReplayTestCase(ServiceReplayTestCase):
    def getDefaultRequest(self, req_type):
        # No 'send' - all send tests have an f1-request.json file...
        if req_type == "contacts":
            account = {"oauth_token": "foo", "oauth_token_secret": "bar",
                       "profile": {"emails": [{'value': 'me@example.com'}],
                                "displayName": "Me",
                        },
                      }
            return {'username': 'me',
                    'userid': '123',
                    'keys': "1,2,3",
                    'account': json.dumps(account),
                    'domain': 'linkedin.com',
                    'maxresults': 500,
                   }
        if req_type == "auth":
            return {'domain': 'linkedin.com', 'username': 'foo',
                    'userid': 'bar'}
        raise AssertionError(req_type)


def setupReplayers():
    from linkoauth.backends import facebook_
    facebook_.HttpRequestor = HttpReplayer
    from linkoauth.backends import yahoo_
    yahoo_.HttpRequestor = HttpReplayer
    from linkoauth.backends import google_
    google_.SMTPRequestor = SmtpReplayer
    google_.OAuth2Requestor = HttpReplayer
    from linkoauth.backends import twitter_
    twitter_.OAuth2Requestor = HttpReplayer
    from linkoauth.backends import linkedin_
    linkedin_.OAuth2Requestor = HttpReplayer
    import linkoauth.oauth
    linkoauth.oauth.HttpRequestor = HttpReplayer
    HttpReplayer.to_playback = []
    SmtpReplayer.to_playback = None


def teardownReplayers():
    assert not HttpReplayer.to_playback, HttpReplayer.to_playback
    assert not SmtpReplayer.to_playback, SmtpReplayer.to_playback
    import linkoauth.protocap
    from linkoauth.backends import facebook_
    facebook_.HttpRequestor = linkoauth.protocap.HttpRequestor
    from linkoauth.backends import yahoo_
    yahoo_.HttpRequestor = linkoauth.protocap.HttpRequestor
    from linkoauth.backends import google_
    google_.SMTPRequestor = google_.SMTPRequestorImpl
    google_.OAuth2Requestor = linkoauth.protocap.OAuth2Requestor
    from linkoauth.backends import twitter_
    twitter_.OAuth2Requestor = linkoauth.protocap.OAuth2Requestor
    from  linkoauth.backends import linkedin_
    linkedin_.OAuth2Requestor = linkoauth.protocap.OAuth2Requestor
    from linkoauth import oauth
    oauth.HttpRequestor = linkoauth.protocap.HttpRequestor


host_to_test = {
    'graph.facebook.com': FacebookReplayTestCase,
    'www.google.com': GoogleReplayTestCase,
    'smtp.gmail.com': GoogleReplayTestCase,
    'mail.yahooapis.com': YahooReplayTestCase,
    'social.yahooapis.com': YahooReplayTestCase,
    'api.twitter.com': TwitterReplayTestCase,
    'twitter.com': TwitterReplayTestCase,
    'api.linkedin.com': LinkedinReplayTestCase,
}


def queueForReplay(canned):
    if canned.protocol == "smtp":
        fname = os.path.join(canned.path, "smtp-trace")
        SmtpReplayer.to_playback = open(fname)
    elif canned.protocol == "http":
        # http playbacks can have multiple responses due to redirections...
        i = 0
        while True:
            fname = os.path.join(canned.path, "request-%d" % (i,))
            try:
                freq = open(fname)
            except IOError:
                freq = None
            fname = os.path.join(canned.path, "response-%d" % (i,))
            try:
                fresp = open(fname)
            except IOError:
                fresp = None
            if freq is None and fresp is None:
                break
            HttpReplayer.to_playback.append((freq, fresp))
            i += 1
    else:
        raise AssertionError(canned.protocol)


def runOne(canned):
    testClass = host_to_test[canned.host]
    test = testClass()
    queueForReplay(canned)
    try:
        with open(os.path.join(canned.path, "f1-request.json")) as f:
            request = json.load(f)
        # and the handling of 'account' totally sucks - it is a string...
        request['account'] = json.dumps(request['account'])
    except IOError:
        request = test.getDefaultRequest(canned.req_type)
    response = test.getResponse(canned, request)
    test.checkResponse(canned, response)

# *sob* - this used to use a nose "test generator", but that technique
# doesn't work well with discovery and only running one of the tests in
# the corpus.
# So we hack up the global namespace.  This allows you to say, eg,
# % nosetests ... linkdrop/tests/services/test_playback.py:test_service_replay_http_www_google_com_auth_successful
# to just run one specific test from the corpus.
for canned in genCanned():

    @with_setup(setupReplayers, teardownReplayers)
    def decoratedRunOne(canned=canned):
        runOne(canned)
    tail = os.path.basename(canned.path).replace("-", "_").replace(".", "_")
    name = "test_service_replay_" + tail
    decoratedRunOne.__name__ = name
    globals()[name] = decoratedRunOne
