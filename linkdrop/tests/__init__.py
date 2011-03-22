"""Pylons application test package

This package assumes the Pylons environment is already loaded, such as
when this script is imported from the `nosetests --with-pylons=test.ini`
command.

This module initializes the application via ``websetup`` (`paster
setup-app`) and provides the base testing objects.
"""
from paste.deploy import loadapp
from paste.script.appinstall import SetupCommand
from pylons import url
from routes.util import URLGenerator
from webtest import TestApp

import pylons.test

__all__ = ['environ', 'url', 'TestController', 'testable_services']

testable_services = ["google.com", "yahoo.com", "facebook.com", "twitter.com",
                     "linkedin.com"]

# Invoke websetup with the current config file
SetupCommand('setup-app').run([pylons.test.pylonsapp.application.wrap_app.app.config['__file__']])

# oh, this is just insane - re-enable all 'linkdrop' child loggers
# due to http://bugs.python.org/issue11424 and the fact we have a logger
# called 'linkdrop-metrics'
# Note we don't see this in production due to when the logs are
# initialized in a real app vs in tests.
import logging
for log_name in logging.getLogger().manager.loggerDict.keys():
    if log_name.startswith("linkdrop."):
        logging.getLogger(log_name).disabled = False

environ = {}

# Note the base for our test cases is *not* a unittest.TestCase as some
# nose features don't work with such classes.
class TestController(object):
    def __init__(self, *args, **kwargs):
        wsgiapp = pylons.test.pylonsapp
        config = wsgiapp.config
        self.app = TestApp(wsgiapp)
        url._push_object(URLGenerator(config['routes.map'], environ))
