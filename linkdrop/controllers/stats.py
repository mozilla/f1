import logging
from datetime import timedelta
import dateutil.parser

from pylons import request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect

from sqlalchemy.sql import select, func
from sqlalchemy import and_

from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg

from linkdrop.lib.base import BaseController, render
from linkdrop.model.meta import Session
from linkdrop.model.account import Account
from linkdrop.model.history import History
from linkdrop.model.types import UTCDateTime

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
            api_arg('start', 'date', False, None, None, """
start date (mm-dd-yyyy)
"""),
            api_arg('end', 'date', False, None, None, """
end date (mm-dd-yyyy)
"""),
            api_arg('days', 'integer', False, 30, None, """
number of days to return
"""),
            api_arg('opts', 'string', False, 'domain', None, """
comma seperated values that can be [domain,perday]
"""),
        ],
        response={'type': 'list', 'doc': 'raw data list'}
    )
    def accounts(self):
        start = request.params.get('start',None)
        end = request.params.get('end',None)
        limit = int(request.params.get('days','0'))
        opts = request.params.get('opts','').split(',')
        groupby = []
        whereclause = []
        if limit and not start and not end:
            whereclause.append(Account.created >= UTCDateTime.now() - timedelta(days=limit))
        if start:
            whereclause.append(Account.created >= UTCDateTime.from_string(start))
        if end:
            whereclause.append(Account.created < UTCDateTime.from_string(end))
        if 'perday' in opts:
            if 'domain' in opts:
                s = select([func.date_format(History.published, "%Y-%m-%d"), Account.domain, func.count(Account.id)])
                groupby.append(func.to_days(Account.created))
                groupby.append(Account.domain)
            else:
                s = select([func.date_format(History.published, "%Y-%m-%d"), func.count(Account.id)])
                groupby.append(func.to_days(Account.created))
        else:
            s = select([func.count(Account.domain), Account.domain])
            groupby.append(Account.domain)

        if whereclause:
            s = s.where(*whereclause)
        if groupby:
            s = s.group_by(*groupby)
        return [list(a) for a in Session.execute(s).fetchall()]

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
            api_arg('start', 'date', False, None, None, """
start date (mm-dd-yyyy)
"""),
            api_arg('end', 'date', False, None, None, """
end date (mm-dd-yyyy)
"""),
            api_arg('days', 'integer', False, 30, None, """
number of days to return
"""),
            api_arg('opts', 'string', False, 'domain', None, """
comma seperated values that can be [domain,perday]
"""),
        ],
        response={'type': 'list', 'doc': 'raw data list'}
    )
    def history(self):
        start = request.params.get('start',None)
        end = request.params.get('end',None)
        limit = int(request.params.get('days','0'))
        opts = request.params.get('opts','').split(',')
        whereclause = []
        vars = {}
        groupby = []
        if limit and not start and not end:
            whereclause.append(History.published >= UTCDateTime.now() - timedelta(days=limit))
        if start:
            whereclause.append(History.published >= UTCDateTime.from_string(start))
        if end:
            whereclause.append(History.published < UTCDateTime.from_string(end))
        if 'perday' in opts:
            if 'domain' in opts:
                s = select([func.date_format(History.published, "%Y-%m-%d"), History.domain, func.count(History.domain)],)
                groupby.append(func.to_days(History.published))
                groupby.append(History.domain)
            else:
                s = select([func.date_format(History.published, "%Y-%m-%d"), func.count(History.id)])
                groupby.append(func.to_days(History.published))
        else:
            s = select([func.count(History.domain), History.domain])
            groupby.append(History.domain)
        
        if whereclause:
            s = s.where(and_(*whereclause))
        if groupby:
            s = s.group_by(*groupby)
        return [list(a) for a in Session.execute(s).fetchall()]


