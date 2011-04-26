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
#    Rob Miller <rmiller@mozilla.com>
#
# ***** END LICENSE BLOCK *****

from linkdrop.wsgiapp import ShareServerApp
from nose.tools import ok_
from paste.deploy import loadapp
from webtest import TestApp

__all__ = ['environ', 'TestController', 'testable_services']

testable_services = ["google.com", "facebook.com", "twitter.com",
                     "linkedin.com", "yahoo.com"]

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
        # have to do a bit of digging to get to the app object that we actually
        # care about :P
        outer_app = loadapp('config:test.ini', relative_to='.')
        self.app = outer_app.app.application
        ok_(self.app.__class__ is ShareServerApp)
        self.test_app = TestApp(self.app)
