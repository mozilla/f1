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

import cgi

from paste.urlparser import PkgResourcesParser
from pylons.middleware import error_document_template
from webhelpers.html.builder import literal

from linkdrop.lib.base import BaseController

class ErrorController(BaseController):
    """Generates error documents as and when they are required.

    The ErrorDocuments middleware forwards to ErrorController when error
    related status codes are returned from the application.

    This behaviour can be altered by changing the parameters to the
    ErrorDocuments middleware in your config/middleware.py file.

    """
    def document(self):
        """Render the error document"""
        request = self._py_object.request
        resp = request.environ.get('pylons.original_response')
        content = (literal(resp.body) or
                   cgi.escape(request.GET.get('message', '')))
        page = error_document_template % \
            dict(prefix=request.environ.get('SCRIPT_NAME', ''),
                 code=cgi.escape(request.GET.get('code',
                                                 str(resp.status_int))),
                 message=content)
        return page

    def img(self, id):
        """Serve Pylons' stock images"""
        return self._serve_file('/'.join(['media/img', id]))

    def style(self, id):
        """Serve Pylons' stock stylesheets"""
        return self._serve_file('/'.join(['media/style', id]))

    def _serve_file(self, path):
        """Call Paste's FileApp (a WSGI application) to serve the file
        at the specified path
        """
        request = self._py_object.request
        request.environ['PATH_INFO'] = '/%s' % path
        return PkgResourcesParser('pylons', 'pylons')(
            request.environ, self.start_response)
