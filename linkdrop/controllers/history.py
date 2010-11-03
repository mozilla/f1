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
        keys = session.get('account_keys', '').split(',')
        stmt = Session.query(Account.id).filter(Account.key.in_(keys)).subquery()
        data = Session.query(History, Account.domain, Account.username, Account.id).filter(
            Account.id == History.account_id).\
            filter(History.account_id.in_(stmt)).\
            order_by(History.published.desc()).\
            all()
        res = []
        for h, d, u, i in data:
            r = h.to_dict()
            r['domain'] = d
            r['username'] = u
            r['userid'] = i
            res.append(r)
        return res
