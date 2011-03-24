"""Pylons application test package

This package assumes the Pylons environment is already loaded, such as
when this script is imported from the `nosetests --with-pylons=test.ini`
command.

This module initializes the application via ``websetup`` (`paster
setup-app`) and provides the base testing objects.
"""
from unittest import TestCase

from paste.deploy import loadapp
from paste.script.appinstall import SetupCommand
from pylons import url
from routes.util import URLGenerator
from webtest import TestApp

import pylons.test

__all__ = ['environ', 'url', 'TestController']


# ugly hack to get back the original app
wsgiapp = pylons.test.pylonsapp.wrap_app.app[(None, '/api')].orig_app

# Invoke websetup with the current config file
config_file = wsgiapp.config['__file__'] + '#api'
SetupCommand('setup-app').run([config_file])

environ = {}

class TestController(TestCase):

    def __init__(self, *args, **kwargs):
        config = wsgiapp.config
        self.app = TestApp(pylons.test.pylonsapp)
        url._push_object(URLGenerator(config['routes.map'], environ))
        TestCase.__init__(self, *args, **kwargs)
