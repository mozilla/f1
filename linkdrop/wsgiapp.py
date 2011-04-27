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
#   Rob Miller (rmiller@mozilla.com)
#
# ***** END LICENSE BLOCK *****
"""
Application entry point.
"""
from linkdrop.controllers.account import AccountController
from linkdrop.controllers.contacts import ContactsController
from linkdrop.controllers.docs import DocsController
from linkdrop.controllers.send import SendController
from linkoauth.util import setup_config
from routes.util import URLGenerator
from services.baseapp import set_app, SyncServerApp
from webob.dec import wsgify

urls = [
    ('GET', '/docs', 'docs', 'index'),
    ('POST', '/send', 'send', 'send'),
    ('POST', '/account/authorize', 'account', 'authorize'),
    (('GET', 'POST'), '/account/verify', 'account', 'verify'),
    ('POST', '/contacts/{domain}', 'contacts', 'get'),
    ]

controllers = {'account': AccountController,
               'contacts': ContactsController,
               'docs': DocsController,
               'send': SendController,
               }


class ShareServerApp(SyncServerApp):
    """Share server WSGI application"""
    def __init__(self, urls, controllers, config, auth_class=None,
                 *args, **kwargs):
        if auth_class is not None:
            raise ValueError("A ShareServerApp's ``auth_class`` must be None.")
        setup_config(config)
        super(ShareServerApp, self).__init__(urls, controllers, config,
                                             auth_class, *args, **kwargs)

    @wsgify
    def __call__(self, request, *args, **kwargs):
        """Construct an URLGenerator"""
        request.urlgen = URLGenerator(self.mapper, request.environ)
        superclass = super(ShareServerApp, self)
        return superclass.__call__.undecorated(request, *args, **kwargs)


make_app = set_app(urls, controllers, klass=ShareServerApp, auth_class=None)
