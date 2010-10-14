import logging
import urllib, cgi, json, sys
from urlparse import urlparse

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

class ContactsController(BaseController):
    """
Contacts
========

A proxy for retrieving contacts from a service.

"""
    __api_controller__ = True # for docs


    @api_response
    @json_exception_response
    @api_entry(
        doc="""
contacts
--------

Get contacts from a service.
""",
        urlargs=[
            api_arg('domain', 'string', True, None, None, """
The domain of the service to get contacts from (e.g. google.com)
"""),
        ],
        queryargs=[
            # name, type, required, default, allowed, doc
            api_arg('username', 'string', False, None, None, """
The user name used by the service. The username or userid is required if more
than one account is setup for the service.
"""),
            api_arg('userid', 'string', False, None, None, """
The user id used by the service. The username or userid is required if more
than one account is setup for the service.
"""),
            api_arg('startindex', 'integer', False, 0, None, """
Start index used for paging results.
"""),
            api_arg('maxresults', 'integer', False, 25, None, """
Max results to be returned per request, used with startindex for paging.
"""),
        ],
        response={'type': 'object', 'doc': 'Portable Contacts Collection'}
    )
    def get(self, domain):
        username = request.params.get('username')
        userid = request.params.get('userid')
        startIndex = int(request.params.get('startindex','0'))
        maxResults = int(request.params.get('maxresults','25'))
        keys = session.get('account_keys', '').split(',')
        if not keys:
            error = {'provider': domain,
                     'message': "no user session exists, auth required",
                     'status': 401
            }
            return {'result': None, 'error': error}
        provider = get_provider(domain)

        # even if we have a session key, we must have an account for that
        # user for the specified domain.
        acct = None
        for k in keys:
            a = session.get(k)
            if a and a.get('domain') == domain and (not username or a.get('username')==username and not userid or a.get('userid')==userid):
                acct = a
                break
        if not acct:
            error = {'provider': domain,
                     'message': "not logged in or no user account for that domain",
                     'status': 401
            }
            return {'result': None, 'error': error}

        result, error = provider.api(acct).getcontacts(startIndex, maxResults)
        return {'result': result, 'error': error}

