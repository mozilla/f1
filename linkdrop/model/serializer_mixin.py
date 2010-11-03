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

# A serializer for items.
from datetime import datetime
import json
from sqlalchemy.orm.util import object_mapper
from sqlalchemy.orm.properties import ColumnProperty, RelationProperty

class SerializerMixin(object):
    # deal with the special plural fields
    def _rd_collection_to_dict(self, name, fields):
        if fields and name not in fields:
            return
        if hasattr(self, name):
            for entry in getattr(self, name, []):
                val = entry.to_dict()
                if val:
                    #import sys;print >> sys.stderr, val
                    yield val
                    #propdict.setdefault(name, []).append(val)

    def to_dict(self, fields=None):
        propdict = {}
        for prop in object_mapper(self).iterate_properties:
            if isinstance(prop, (ColumnProperty)):# or isinstance(prop, RelationProperty) and prop.secondary:
                if fields and prop.key not in fields: continue
                val = getattr(self, prop.key)
                if val:
                    if isinstance(val, datetime):
                        val = val.isoformat().split('.')[0].replace('+00:00','')+'Z'
    
                    if prop.key == 'json_attributes':
                        propdict.update(val)
                    else:
                        propdict[prop.key] = val
                else:
                    propdict[prop.key] = val

        for val in self._rd_collection_to_dict('tags', fields):
            propdict.setdefault('tags', []).append(val)

        return propdict
