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

# Account definitions
from sqlalchemy import Column, Integer, String, Boolean, UniqueConstraint, Text, ForeignKey, UnicodeText, DDL
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
    link = Column(UnicodeText)
    domain = Column(RDUnicode(64))
    
    account = relationship('Account')
    
    def __init__(self):
        # a one time modification to the table so insert statments
        # get modified properly
        if asbool(config.get('delayed_inserts', False)) and not \
            hasattr(History.__table__, 'insert_prefix'):
            History.__table__.insert_prefix = 'DELAYED'

def should_create(ddl, event, target, connection, **kw):
    if connection.engine.name != 'mysql':
        return False
    row = connection.execute("""SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
        WHERE table_name = 'history'
        AND index_name = 'ix_link';""").scalar()
    return not bool(row)

DDL("ALTER TABLE history ADD INDEX ix_link (link(128))", on=should_create).execute_at("after-create", Base.metadata)
