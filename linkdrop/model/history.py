# Account definitions
from sqlalchemy import Column, Integer, String, Boolean, UniqueConstraint, Text, ForeignKey
from sqlalchemy.orm import relationship, backref

from linkdrop.model.meta import Base, Session, make_table_args
from linkdrop.model.types import RDUnicode, UTCDateTime
from linkdrop.model.expando_mixin import JsonExpandoMixin
from linkdrop.model.serializer_mixin import SerializerMixin

from linkdrop.model.account import Account

class History(JsonExpandoMixin, SerializerMixin, Base):
    __tablename__ = 'history'
    __table_args__ = make_table_args()

    id = Column(Integer, primary_key=True)
    account_id = Column(None, ForeignKey(Account.id), index=True)
    published = Column(UTCDateTime, nullable=False)
    
    account = relationship('Account')
