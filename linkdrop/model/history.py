# Account definitions
from sqlalchemy import Column, Integer, String, Boolean, UniqueConstraint, Text, ForeignKey
from sqlalchemy.orm import relationship, backref

from linkdrop.model.meta import Base, Session, make_table_args
from linkdrop.model.types import RDUnicode, UTCDateTime
from linkdrop.model.expando_mixin import JsonExpandoMixin
from linkdrop.model.serializer_mixin import SerializerMixin

from linkdrop.model.account import Account

from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql import expression

from pylons import config
from paste.deploy.converters import asbool

@compiles(expression.Insert)
def annotated_insert(insert, compiler, **kw):
    if getattr(insert.table, 'insert_prefix', None):
        insert = insert.prefix_with('%s' % insert.table.insert_prefix)
    return compiler.visit_insert(insert, **kw)

class History(JsonExpandoMixin, SerializerMixin, Base):
    __tablename__ = 'history'
    # we use ISAM for this table so we can do delayed inserts
    __table_args__ = make_table_args(mysql_engine = 'MyISAM')

    id = Column(Integer, primary_key=True)
    account_id = Column(None, ForeignKey(Account.id), index=True)
    published = Column(UTCDateTime, nullable=False)
    
    account = relationship('Account')
    
    def __init__(self):
        # a one time modification to the table so insert statments
        # get modified properly
        if asbool(config.get('delayed_inserts', False)) and not \
            hasattr(History.__table__, 'insert_prefix'):
            History.__table__.insert_prefix = 'DELAYED'

