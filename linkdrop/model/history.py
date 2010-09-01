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
    userkey = Column(Integer, ForeignKey(Account.userkey), index=True)
    published = Column(UTCDateTime, nullable=False)
    
    # svckey is from the account table, a key to domain/userid/username,
    # it might end up being a relationship
    svckey = Column(RDUnicode(128), nullable=False)

    account = relationship('Account', uselist=False)
