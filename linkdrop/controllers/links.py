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
import urllib, cgi, json, sys
from urlparse import urlparse

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from pylons.decorators import jsonify
from pylons.decorators.util import get_pylons

from linkdrop.lib.base import BaseController, render
from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg, get_redirect_response
from linkdrop.lib.oauth import get_provider
from linkdrop.lib import constants

from linkdrop.model.meta import Session
from linkdrop.model.links import Link
from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy import and_


log = logging.getLogger(__name__)


class LinksController(BaseController):
    """
Links
=====

The 'link' namespace is used to access information regarding the shortened links.

"""
    __api_controller__ = True # for docs


    @api_response
    @json_exception_response
    def get(self, id):
        num_id = int(id, 16)
        #print "ID is ", num_id
        link = Session.query(Link).filter_by(id = num_id).first()
        #import sys
        #print >> sys.stderr, link.to_dict()
        #print "LONG_URL = ", link.long_url
        resp = get_redirect_response(link.long_url,
                                     additional_headers=[
                                        ('x-shortened-by', link.userkey),
                                        ('x-shortened-for', link.audience),
                                        ])
        raise resp.exception

    @api_response
    @json_exception_response
    def shorten(self):
        if not request.POST:
            # XXX should be a 405
            return {
                'code': constants.INVALID_REQUEST,
                'message': "must be POST call"}
        try:
            url = request.POST.get('url')
            #_from = request.POST.get('from')
            #_to = request.POST.get('to')
        except KeyError, what:
            error = {
                'code': constants.INVALID_PARAMS,
                'message': "'%s' request param is not optional" % (what,),
            }
            return {'error': error}

        # important to canonicalize the URL
        u = urlparse(url)
        if not u.scheme:
            url = 'http://' + url
        link = Link.get_or_create(url)
        return {'result': link.to_dict()}
