# A mixin for all objects which want 'expando' functionality;
# ie, the ability to have arbitrary content stored in a json column, but
# have the object seamlessly provide access to the items in the json as though
# they were real properties.

import json
from sqlalchemy.orm.interfaces import MapperExtension, EXT_CONTINUE
from sqlalchemy import Column, Text

# A mapper extension to help us with 'expandos' magic - ensures that expando
# attributes set via normal 'object.expando=value' syntax is reflected
# back into the json_attributes column.
class _ExpandoFlushingExtension(MapperExtension):
    def before_insert(self, mapper, connection, instance):
        instance._flush_expandos()
        return EXT_CONTINUE

    before_update = before_insert


# The actual mixin class
class JsonExpandoMixin(object):
    __mapper_args__ =  {'extension': _ExpandoFlushingExtension()}
    json_attributes = Column(Text)

    # Methods for providing 'expandos' via the json_attributes field.
    def _get_expando_namespace(self):
        if '_expando_namespace' not in self.__dict__:
            assert '_orig_json' not in self.__dict__
            attrs = self.json_attributes
            self.__dict__['_orig_json'] = attrs
            if not attrs:
                _expando_namespace = {}
            else:
                _expando_namespace = json.loads(attrs)
            self.__dict__['_expando_namespace'] = _expando_namespace
        return self.__dict__['_expando_namespace']

    def __getattr__(self, name):
        if name.startswith('_'):
            raise AttributeError(name)
        # is it in the namespace?
        try:
            return self._get_expando_namespace()[name]
        except KeyError:
            raise AttributeError(name)

    def __setattr__(self, name, value):
        if name.startswith("_") or name in self.__dict__ or hasattr(self.__class__, name):
            object.__setattr__(self, name, value)
            return
        # assume it is an 'expando' object
        # Set json attributes to itself simply so the object is marked as
        # 'dirty' for subsequent updates.
        self.json_attributes = self.json_attributes
        self._get_expando_namespace()[name] = value

    def __delattr__(self, name):
        try:
            del self._get_expando_namespace()[name]
            self.json_attributes = self.json_attributes # to mark as dirty
        except KeyError:
            raise AttributeError("'%s' is not an 'expando' property" % (name,))

    # Note that you should never need to call this function manually - a
    # mapper extension is defined above which calls this function before
    # the object is saved.
    def _flush_expandos(self):
        try:
            en = self.__dict__['_expando_namespace']
        except KeyError:
            # no property accesses at all
            return
        if self._orig_json != self.json_attributes:
            # This means someone used 'expandos' *and* explicitly set
            # json_attributes on the same object.
            raise ValueError("object's json_attributes have changed externally")
        self.json_attributes = None if not en else json.dumps(en)
        # and reset the world back to as if expandos have never been set.
        del self.__dict__['_orig_json']
        del self.__dict__['_expando_namespace']
