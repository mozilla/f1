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
import imp
import sys
import inspect
from docutils import core

from pylons import request, response, tmpl_context as c, url
from pylons.controllers.util import abort, redirect

from linkdrop.lib.base import BaseController, render
from linkdrop.lib.helpers import json_exception_response, api_response, api_entry, api_arg
from pylons import config

log = logging.getLogger(__name__)

def reST_to_html_fragment(a_str):
    parts = core.publish_parts(
                          source=a_str,
                          writer_name='html')
    return parts['body_pre_docinfo']+parts['fragment']


def import_module(partname, fqname, parent):
    try:
        return sys.modules[fqname]
    except KeyError:
        pass
    try:
        fp, pathname, stuff = imp.find_module(partname,
                                              parent and parent.__path__)
    except ImportError:
        return None
    try:
        m = imp.load_module(fqname, fp, pathname, stuff)
    finally:
        if fp: fp.close()
    if parent:
        setattr(parent, partname, m)
    return m


def getmodule(module_name):
    # XXX this should be generic and be able to discover controllers that
    # are loaded into a pylons app
    import linkdrop.controllers
    fqname = "linkdrop.controllers."+module_name
    try:
        return import_module(module_name, fqname, linkdrop.controllers)
    except ImportError, e:
        print "import error %s %r" % (module_name, e)
        return None


def getclass(module, classname):
    if classname not in dir(module):
        return None
    for (name, class_) in inspect.getmembers(module):
        if name == classname:
            break
        class_ = None
    if not class_ or not '__api_controller__' in class_.__dict__:
        return None
    return class_

class DocsController(BaseController):
    """
API Documentation
=================

Returns structured information about the Raindrop API, for use in user interfaces
that want to show an API reference.

"""
    __api_controller__ = True # for docs

    @api_response
    @json_exception_response
    @api_entry(
        doc="""
docs/index
----------

Returns a json object containing documentation
""",
        response={'type': 'object', 'doc': 'An object that describes the API methods and parameters.'}
    )

    def index(self):
        # iterate through our routes and get the controller classes
        import linkdrop.controllers
        mapper = config['routes.map']
        module_names = {}
        for m in mapper.matchlist:
            module_name = m.defaults.get('controller', None)
            if not module_name:
                continue
            
            if module_name in module_names:
                # we've already got docs for this controller, just backfill
                # some additional data
                action = module_names[module_name]['methods'].get(m.defaults['action'], None)
                if action:
                    action.setdefault('routes',[]).append(m.routepath)
                continue
            
            # this is the first hit for this controller
            # import the module and create all documentation for the controller,
            # we'll backfill some data from Routes as we process more mappings
            module = getmodule(module_name)
            if not module:
                continue

            classname = module_name.title()+'Controller'
            class_ = getclass(module, classname)
            if not class_:
                continue
            
            doc = inspect.getdoc(class_)
            doc = doc and reST_to_html_fragment(doc)
            class_data = {
                'controller': classname,
                'doc': doc,
                'methods': {}
            }
            for (name, method) in inspect.getmembers(class_):
                if name[0] == "_":
                    continue
                f = class_data['methods'][name] = {}
                f.update(getattr(method, '__api', {}))
                if 'doc' in f:
                    f['doc'] = reST_to_html_fragment(f['doc'])
                else:
                    doc = inspect.getdoc(method)
                    f['doc'] = doc and reST_to_html_fragment(doc)

            module_names[module_name] = class_data
            action = class_data['methods'].get(m.defaults['action'], None)
            if action:
                action.setdefault('routes',[]).append(m.routepath)
            
        return module_names
