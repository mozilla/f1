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

"""Pylons environment configuration"""
import os
from ConfigParser import ConfigParser

from mako.lookup import TemplateLookup
from pylons.configuration import PylonsConfig
from pylons.error import handle_mako_error

import linkdrop.lib.app_globals as app_globals
from linkdrop.config.routing import make_map


def load_environment(global_conf, app_conf):
    """Configure the Pylons environment via the ``pylons.config``
    object
    """
    config = PylonsConfig()

    # Pylons paths
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    paths = dict(root=root,
                 controllers=os.path.join(root, 'controllers'),
                 static_files=os.path.join(root, 'public'),
                 templates=[os.path.join(root, 'templates')])

    # import our private.ini that holds keys, etc
    imp = global_conf.get('import')
    if imp:
        cp = ConfigParser()
        cp.read(imp)
        global_conf.update(cp.defaults())
        if cp.has_section('APP'):
            app_conf.update(cp.items('APP'))

    # Initialize config with the basic options
    config.init_app(global_conf, app_conf, package='linkdrop', paths=paths)
    config['routes.map'] = make_map(config)
    config['pylons.app_globals'] = app_globals.Globals(config)

    import linkdrop.lib.helpers as h
    config['pylons.h'] = h

    # Setup cache object as early as possible
    import pylons
    pylons.cache._push_object(config['pylons.app_globals'].cache)

    # Create the Mako TemplateLookup, with the default auto-escaping
    config['pylons.app_globals'].mako_lookup = TemplateLookup(
        directories=paths['templates'],
        error_handler=handle_mako_error,
        module_directory=os.path.join(app_conf['cache_dir'], 'templates'),
        input_encoding='utf-8', default_filters=['escape'],
        imports=['from webhelpers.html import escape'])

    # CONFIGURATION OPTIONS HERE (note: all config options will override
    # any Pylons config options)

    return config
