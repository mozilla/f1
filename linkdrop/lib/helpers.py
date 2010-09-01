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

import logging


from linkdrop.model.meta import Session

logger=logging.getLogger(__name__)

@decorator
def exception_rollback(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except Exception, e:
        Session.rollback()
        raise

@decorator
def json_exception_response(func, *args, **kwargs):
    try:
        return func(*args, **kwargs)
    except HTTPException:
        raise
    except Exception, e:
        logger.exception("%s(%s, %s) failed", func, args, kwargs)
        #pylons = get_pylons(args)
        #pylons.response.status_int = 500
        return {
            'result': None,
            'error': {
                'name': e.__class__.__name__,
                'message': str(e)
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
            for k,v in d.items():
                if isinstance(v, dict):
                    r += "<%s>%s</%s>" % (k, ser(v), k)
                elif isinstance(v, list):
                    for i in v:
                        #print k,i
                        r += ser({k:i})
                else:
                    r += "<%s>%s</%s>" % (k, escape("%s"%v), k)
            return r
        pylons.response.headers['Content-Type'] = 'text/xml'
        return '<?xml version="1.0" encoding="UTF-8"?>' + ser({'response': data}).encode('utf-8')
    pylons.response.headers['Content-Type'] = 'application/json'
    return json.dumps(data)

def api_entry(**kw):
    """Decorator to add tags to functions.
    """
    def decorate(f):
        if not hasattr(f, "__api"):
            f.__api = kw
        if not getattr(f, "__doc__") and 'doc' in kw:
            doc = kw['doc']
            if 'name' in kw:
                doc = kw['name'] + "\n" + "="*len(kw['name']) +"\n\n" + doc
            args = []
            for m in kw.get('queryargs', []):
                line = "  %(name)-20s %(type)-10s %(doc)s" % m
                opts = []
                if m['required']: opts.append("required")
                if m['default']: opts.append("default=%s" % m['default'])
                if m['allowed']: opts.append("options=%r" % m['allowed'])
                if opts:
                    line = "%s (%s)" % (line, ','.join(opts),)
                args.append(line)
            d = "Request Arguments\n-----------------\n\n%s\n\n" % '\n'.join(args)
            if 'bodyargs' in kw:
                assert 'body' not in kw, "can't specify body and bodyargs"
                for m in kw['bodyargs']:
                    line = "  %(name)-20s %(type)-10s %(doc)s" % m
                    opts = []
                    if m['required']: opts.append("required")
                    if m['default']: opts.append("default=%s" % m['default'])
                    if m['allowed']: opts.append("options=%r" % m['allowed'])
                    if opts:
                        line = "%s (%s)" % (line, ','.join(opts),)
                    args.append(line)
                d = d+ "**Request Body**: A JSON object with the following fields:"
                d = d+ "\n".join(args)
            elif 'body' in kw:
                d = d+ "**Request Body**:  %(type)-10s %(doc)s\n\n" % kw['body']
            if 'response' in kw:
                d = d+ "**Response Body**: %(type)-10s %(doc)s\n\n" % kw['response']
            f.__doc__ = doc + d
        return f
    return decorate

def api_arg(name, type=None, required=False, default=None, allowed=None, doc=None):
    return {
        'name': name,
        'type': type,
        'required': required,
        'default': default,
        'allowed': allowed,
        'doc': doc or ''
    }


if __name__ == '__main__':
    @api_entry(
        name="contacts",
        body=("json", "A json object"),
        doc="""
See Portable Contacts for api for detailed documentation.

http://portablecontacts.net/draft-spec.html

**Examples**::

    /contacts                        returns all contacts
    /contacts/@{user}/@{group}       returns all contacts (user=me, group=all)
    /contacts/@{user}/@{group}/{id}  returns a specific contact

""",
        urlargs=[
            api_arg('user', 'string', True, None, ['me'], 'User to query'),
            api_arg('group', 'string', True, None, ['all', 'self'], 'Group to query'),
            api_arg('id', 'integer', False, None, None, 'Contact ID to return'),
            ],
        queryargs=[
            # name, type, required, default, allowed, doc
            api_arg('filterBy', 'string', False, None, None, 'Field name to query'),
            api_arg('filterOp', 'string', False, None, ['equals', 'contains', 'startswith', 'present'], 'Filter operation'),
            api_arg('filterValue', 'string', False, None, None, 'A value to compare using filterOp (not used with present)'),
            api_arg('startIndex', 'int', False, 0, None, 'The start index of the query, used for paging'),
            api_arg('count', 'int', False, 20, None, 'The number of results to return, used with paging'),
            api_arg('sortBy', 'string', False, 'ascending', ['ascending','descending'], 'A list of conversation ids'),
            api_arg('sortOrder', 'string', False, 'ascending', ['ascending','descending'], 'A list of conversation ids'),
            api_arg('fields', 'list', False, None, None, 'A list of fields to return'),
        ],
        response=('object', 'A POCO result object')
    )
    def foo():
        pass
    print foo.__doc__
