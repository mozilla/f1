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
                        val = val.isoformat().split('.')[0]+'Z'
    
                    if prop.key == 'json_attributes':
                        propdict.update(json.loads(val))
                    else:
                        propdict[prop.key] = val
                elif prop.key != 'json_attributes':
                    propdict[prop.key] = val

        for val in self._rd_collection_to_dict('tags', fields):
            propdict.setdefault('tags', []).append(val)

        return propdict
