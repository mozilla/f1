import logging

from pylons import request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect

from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg

from linkdrop.lib.base import BaseController, render
from linkdrop.model.meta import Session
from linkdrop.model.account import Account
from linkdrop.model.history import History

log = logging.getLogger(__name__)

class HistoryController(BaseController):

    @api_response
    @json_exception_response
    def get(self):
        userkey = session['userkey']
        stmt = Session.query(Account.id).filter(Account.userkey==userkey).subquery()
        data = Session.query(History, Account.domain, Account.username).filter(History.account_id.in_(stmt)).all()
        res = []
        for h, d, u in data:
            r = h.to_dict()
            r['domain'] = d
            r['username'] = u
            res.append(r)
        return res
