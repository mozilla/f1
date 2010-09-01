# Account definitions
from sqlalchemy import Column, Integer, String, Boolean, UniqueConstraint
from linkdrop.model.meta import Base, Session, make_table_args
from linkdrop.model.types import RDUnicode
from linkdrop.model.expando_mixin import JsonExpandoMixin
from linkdrop.model.serializer_mixin import SerializerMixin

class Account(JsonExpandoMixin, SerializerMixin, Base):
    __tablename__ = 'accounts'
    __table_args__ = make_table_args(UniqueConstraint('domain', 'username', 'userid'))

    id = Column(Integer, primary_key=True)

    # The external account identity information, modelled from poco
    domain = Column(RDUnicode(128), nullable=False)
    username = Column(RDUnicode(128), nullable=False)
    userid = Column(RDUnicode(128), nullable=False)
