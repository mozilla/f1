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
#

"""Helper functions

Consists of functions to typically be used within templates, but also
available to Controllers. This module is available to templates as 'h'.
"""
from pylons.decorators.util import get_pylons
from pylons.controllers.core import HTTPException
from decorator import decorator
import pprint
from xml.sax.saxutils import escape
import json
from webob.exc import status_map

import logging


from linkdrop.lib.metrics import metrics

log = logging.getLogger(__name__)


def get_redirect_response(url, code=302, additional_headers=[]):
    """Raises a redirect exception to the specified URL

    Optionally, a code variable may be passed with the status code of
    the redirect, ie::

        redirect(url(controller='home', action='index'), code=303)

    XXX explain additional_headers

    """
    exc = status_map[code]
    resp = exc(location=url)
    for k, v in additional_headers:
        resp.headers.add(k, v)
    return resp

## {{{ http://code.activestate.com/recipes/52281/ (r1) PSF License
import sgmllib
import string


class StrippingParser(sgmllib.SGMLParser):
    # These are the HTML tags that we will leave intact
    valid_tags = ('b', 'a', 'i', 'br', 'p')

    from htmlentitydefs import entitydefs  # replace entitydefs from sgmllib
    entitydefs  # make pyflakes happy

    def __init__(self):
        sgmllib.SGMLParser.__init__(self)
        self.result = ""
        self.endTagList = []

    def handle_data(self, data):
        if data:
            self.result = self.result + data

    def handle_charref(self, name):
        self.result = "%s&#%s;" % (self.result, name)

    def handle_entityref(self, name):
        if name in self.entitydefs:
            x = ';'
        else:
            # this breaks unstandard entities that end with ';'
            x = ''
        self.result = "%s&%s%s" % (self.result, name, x)

    def unknown_starttag(self, tag, attrs):
        """ Delete all tags except for legal ones """
        if tag in self.valid_tags:
            self.result = self.result + '<' + tag
            for k, v in attrs:
                if (string.lower(k[0:2]) != 'on'
                    and string.lower(v[0:10]) != 'javascript'):
                    self.result = '%s %s="%s"' % (self.result, k, v)
            endTag = '</%s>' % tag
            self.endTagList.insert(0, endTag)
            self.result = self.result + '>'

    def unknown_endtag(self, tag):
        if tag in self.valid_tags:
            self.result = "%s</%s>" % (self.result, tag)
            remTag = '</%s>' % tag
            self.endTagList.remove(remTag)

    def cleanup(self):
        """ Append missing closing tags """
        for j in range(len(self.endTagList)):
                self.result = self.result + self.endTagList[j]


def safeHTML(s):
    """ Strip illegal HTML tags from string s """
    parser = StrippingParser()
    parser.feed(s)
    parser.close()
    parser.cleanup()
    return parser.result
## end of http://code.activestate.com/recipes/52281/ }}}


# Fetch all of the headers in the originating request which we want to pass
# on to the services.
_PASSTHROUGH_HEADERS = ["Accept-Language"]
def get_passthrough_headers(request):
    headers = {}
    for name in _PASSTHROUGH_HEADERS:
        val = request.headers.get(name, None)
        if val is not None:
            headers[name] = val
    return headers


@decorator
def json_exception_response(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except HTTPException:
        raise
    except Exception, e:
        log.exception("%s(%s, %s) failed", func, args, kwargs)
        metrics.track(get_pylons(args).request, 'unhandled-exception',
                      function=func.__name__, error=e.__class__.__name__)
        return {
            'result': None,
            'error': {
                'name': e.__class__.__name__,
                'message': str(e),
            }
        }


@decorator
def api_response(func, *args, **kwargs):
    pylons = get_pylons(args)
    data = func(*args, **kwargs)
    format = pylons.request.params.get('format', 'json')

    if format == 'test':
        pylons.response.headers['Content-Type'] = 'text/plain'
        return pprint.pformat(data)
    elif format == 'xml':

        # a quick-dirty dict serializer
        def ser(d):
            r = ""
            for k, v in d.items():
                if isinstance(v, dict):
                    r += "<%s>%s</%s>" % (k, ser(v), k)
                elif isinstance(v, list):
                    for i in v:
                        #print k,i
                        r += ser({k: i})
                else:
                    r += "<%s>%s</%s>" % (k, escape("%s" % v), k)
            return r
        pylons.response.headers['Content-Type'] = 'text/xml'
        return ('<?xml version="1.0" encoding="UTF-8"?>'
                + ser({'response': data}).encode('utf-8'))
    pylons.response.headers['Content-Type'] = 'application/json'
    res = json.dumps(data)
    return res


def api_entry(**kw):
    """Decorator to add tags to functions.
    """
    def decorate(f):
        if not hasattr(f, "__api"):
            f.__api = kw
        if not getattr(f, "__doc__") and 'doc' in kw:
            doc = kw['doc'] + "\n"
            if 'name' in kw:
                doc = kw['name'] + "\n" + "=" * len(kw['name']) + "\n\n" + doc
            args = []
            for m in kw.get('urlargs', []):
                line = "  %(name)-20s %(type)-10s %(doc)s" % m
                opts = []
                if m['required']:
                    opts.append("required")
                if m['default']:
                    opts.append("default=%s" % m['default'])
                if m['allowed']:
                    opts.append("options=%r" % m['allowed'])
                if opts:
                    line = "%s (%s)" % (line, ','.join(opts),)
                args.append(line)
            args = []
            d = "URL Arguments\n-------------\n\n%s\n\n" % '\n'.join(args)
            for m in kw.get('queryargs', []):
                line = "  %(name)-20s %(type)-10s %(doc)s" % m
                opts = []
                if m['required']:
                    opts.append("required")
                if m['default']:
                    opts.append("default=%s" % m['default'])
                if m['allowed']:
                    opts.append("options=%r" % m['allowed'])
                if opts:
                    line = "%s (%s)" % (line, ','.join(opts),)
                args.append(line)
            d += ("Request Arguments\n-----------------\n\n%s\n\n"
                  % '\n'.join(args))
            if 'bodyargs' in kw:
                args = []
                assert 'body' not in kw, "can't specify body and bodyargs"
                for m in kw['bodyargs']:
                    line = "  %(name)-20s %(type)-10s %(doc)s" % m
                    opts = []
                    if m['required']:
                        opts.append("required")
                    if m['default']:
                        opts.append("default=%s" % m['default'])
                    if m['allowed']:
                        opts.append("options=%r" % m['allowed'])
                    if opts:
                        line = "%s (%s)" % (line, ','.join(opts),)
                    args.append(line)
                d = d + ("**Request Body**: A JSON object with the "
                        "following fields:\n")
                d = d + "\n".join(args) + "\n\n"
            elif 'body' in kw:
                d = d + ("**Request Body**:  %(type)-10s %(doc)s\n\n"
                        % kw['body'])
            if 'response' in kw:
                d = d + ("**Response Body**: %(type)-10s %(doc)s\n\n"
                        % kw['response'])
            f.__doc__ = doc + d
        return f
    return decorate


def api_arg(name, type=None, required=False, default=None, allowed=None,
            doc=None):
    return {
        'name': name,
        'type': type,
        'required': required,
        'default': default,
        'allowed': allowed,
        'doc': doc or '',
    }


if __name__ == '__main__':  # pragma: no cover

    @api_entry(
        name="contacts",
        body={'type': "json", 'doc': "A json object"},
        doc="""
See Portable Contacts for api for detailed documentation.

http://portablecontacts.net/draft-spec.html

**Examples**::

    /contacts                        returns all contacts
    /contacts/@{user}/@{group}       returns all contacts (user=me, group=all)
    /contacts/@{user}/@{group}/{id}  returns a specific contact

""",
        urlargs=[
            api_arg('user', 'string', True, None, ['me'],
                    'User to query'),
            api_arg('group', 'string', True, None, ['all', 'self'],
                    'Group to query'),
            api_arg('id', 'integer', False, None, None,
                    'Contact ID to return'),
            ],
        queryargs=[
            # name, type, required, default, allowed, doc
            api_arg('filterBy', 'string', False, None, None,
                    'Field name to query'),
            api_arg('filterOp', 'string', False, None,
                    ['equals', 'contains', 'startswith', 'present'],
                    'Filter operation'),
            api_arg('filterValue', 'string', False, None, None,
                    'A value to compare using filterOp '
                    '(not used with present)'),
            api_arg('startIndex', 'int', False, 0, None,
                    'The start index of the query, used for paging'),
            api_arg('count', 'int', False, 20, None,
                    'The number of results to return, used with paging'),
            api_arg('sortBy', 'string', False, 'ascending',
                    ['ascending', 'descending'],
                    'A list of conversation ids'),
            api_arg('sortOrder', 'string', False, 'ascending',
                    ['ascending', 'descending'], 'A list of conversation ids'),
            api_arg('fields', 'list', False, None, None,
                    'A list of fields to return'),
        ],
        response={'type': 'object',
                  'doc': ('An object that describes the API methods '
                          'and parameters.')})
    def foo():
        pass
    print foo.__doc__
