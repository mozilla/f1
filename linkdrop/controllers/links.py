import logging
import urllib, cgi, json, sys

from pylons import config, request, response, session, tmpl_context as c, url
from pylons.controllers.util import abort, redirect
from pylons.decorators import jsonify
from pylons.decorators.util import get_pylons

from linkdrop.lib.base import BaseController, render
from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg
from linkdrop.lib.oauth import get_provider
from linkdrop.lib import constants

from linkdrop.model.meta import Session
from linkdrop.model.links import Link
from sqlalchemy.orm.exc import NoResultFound
from sqlalchemy import and_


log = logging.getLogger(__name__)


from webob.exc import status_map

def get_redirect_response(url, code=302, additional_headers=[]):
    """Raises a redirect exception to the specified URL

    Optionally, a code variable may be passed with the status code of
    the redirect, ie::

        redirect(url(controller='home', action='index'), code=303)

    XXX explain additional_headers

    """
    exc = status_map[code]
    resp = exc(location=url)
    for k,v in additional_headers:
        resp.headers.add(k, v)
    return resp

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
        if (not url.startswith('http://')):
            url = 'http://' + url
        link = Link.get_or_create(url)
        return {'result': link.to_dict()}
