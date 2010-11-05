import logging

from pylons import request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect

from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg

from linkdrop.lib.base import BaseController, render
from linkdrop.model.meta import Session
from linkdrop.model.account import Account
from linkdrop.model.history import History

log = logging.getLogger(__name__)

class StatsController(BaseController):
    """F1 Statistics API"""
    __api_controller__ = True # for docs

    @api_response
    @json_exception_response
    @api_entry(
        doc="""
accounts
--------

Get statistics about accounts on F1.
""",
        queryargs=[
            # name, type, required, default, allowed, doc
            api_arg('opts', 'string', False, None, None, """
comma seperated values that can be [domain,perday]
"""),
        ],
        response={'type': 'list', 'doc': 'raw data list'}
    )
    def accounts(self):
        limit = int(request.params.get('limit','5'))
        opts = request.params.get('opts','').split(',')
        if 'domain' in opts:
            if 'perday' in opts:
                sql = 'SELECT DATE(created), domain, count(id) FROM accounts a group by TO_DAYS(created), domain'
            else:
                sql = 'SELECT COUNT(domain), domain from accounts group by domain'
        else:
            sql = 'SELECT DATE(created), count(id) FROM accounts a group by TO_DAYS(created)'
        return [list(a) for a in Session.execute(sql).fetchall()]

    # for now do not enable this
    #@api_response
    #@json_exception_response
    #def links(self):
    #    limit = int(request.params.get('limit','5'))
    #    opts = request.params.get('opts','').split(',')
    #    if 'popular' in opts:
    #        sql = 'SELECT count(link) as c, link FROM history where link <> "" and link is not NULL group by link order by c desc limit %d' % limit
    #    else:
    #        sql = 'select distinct(link) FROM history where link <> "" and link is not NULL order by published desc limit %d' % limit
    #    return [list(a) for a in Session.execute(sql).fetchall()]

    @api_response
    @json_exception_response
    @api_entry(
        doc="""
history
-------

Get statistics about shares on F1.
""",
        queryargs=[
            # name, type, required, default, allowed, doc
            api_arg('opts', 'string', False, None, None, """
comma seperated values that can be [domain,perday]
"""),
        ],
        response={'type': 'list', 'doc': 'raw data list'}
    )
    def history(self):
        limit = int(request.params.get('limit','5'))
        opts = request.params.get('opts','').split(',')
        if 'domain' in opts:
            if 'perday' in opts:
                sql = 'SELECT DATE_FORMAT(published, "%Y-%m-%d"), domain, count(domain) FROM history a group by TO_DAYS(published), domain'
            else:
                sql = 'SELECT COUNT(domain), domain from history group by domain'
        else:
            sql = 'SELECT DATE_FORMAT(published, "%Y-%m-%d"), count(id) FROM history a group by TO_DAYS(published)'
        return [list(a) for a in Session.execute(sql).fetchall()]


