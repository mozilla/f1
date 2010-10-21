"""Pylons environment configuration"""
import os
from ConfigParser import ConfigParser

#from mako.lookup import TemplateLookup
from pylons.configuration import PylonsConfig
#from pylons.error import handle_mako_error
from sqlalchemy import engine_from_config
from paste.deploy.converters import asbool

from migrate.versioning.util import load_model
from migrate.versioning import exceptions, genmodel, schemadiff, schema

import linkdrop.lib.app_globals as app_globals
import linkdrop.lib.helpers
from linkdrop.config.routing import make_map
from linkdrop.model import init_model, meta


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
    config['pylons.h'] = linkdrop.lib.helpers
    
    # Setup cache object as early as possible
    import pylons
    pylons.cache._push_object(config['pylons.app_globals'].cache)

    # Create the Mako TemplateLookup, with the default auto-escaping
    #config['pylons.app_globals'].mako_lookup = TemplateLookup(
    #    directories=paths['templates'],
    #    error_handler=handle_mako_error,
    #    module_directory=os.path.join(app_conf['cache_dir'], 'templates'),
    #    input_encoding='utf-8', default_filters=['escape'],
    #    imports=['from webhelpers.html import escape'])

    # Setup the SQLAlchemy database engine
    engine = engine_from_config(config, 'sqlalchemy.')
    init_model(engine)

    # sqlalchemy auto migration
    if asbool(config.get('migrate.auto')):
        try:
            # managed upgrades
            cschema = schema.ControlledSchema.create(engine, config['migrate.repository'])
            cschema.update_db_from_model(meta.Base.metadata)
        except exceptions.InvalidRepositoryError, e:
            # unmanaged upgrades
            diff = schemadiff.getDiffOfModelAgainstDatabase(
                meta.Base.metadata, engine, excludeTables=None)
            genmodel.ModelGenerator(diff).applyModel()

    # CONFIGURATION OPTIONS HERE (note: all config options will override
    # any Pylons config options)
    
    return config
