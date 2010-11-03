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

"""OpenID Extensions

Additional OpenID extensions for OAuth and UIRequest extensions.

original code from velruse
"""
from openid import extension

class UIRequest(extension.Extension):
    """OpenID UI extension"""
    ns_uri = 'http://specs.openid.net/extensions/ui/1.0'
    ns_alias = 'ui'
    
    def __init__(self, mode=None, icon=False):
        super(UIRequest, self).__init__()
        self._args = {}
        if mode:
            self._args['mode'] = mode
        if icon:
            self._args['icon'] = str(icon).lower()
    
    def getExtensionArgs(self):
        return self._args


class OAuthRequest(extension.Extension):
    """OAuth extension"""
    ns_uri = 'http://specs.openid.net/extensions/oauth/1.0'
    ns_alias = 'oauth'
    
    def __init__(self, consumer, scope=None):
        super(OAuthRequest, self).__init__()
        self._args = {'consumer': consumer}
        if scope:
            self._args['scope'] = scope
    
    def getExtensionArgs(self):
        return self._args
