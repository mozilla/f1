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
from uuid import uuid1

from sqlalchemy import Column, Integer, String, Boolean, UniqueConstraint, Text

from linkdrop.model.meta import Base, Session, make_table_args
from linkdrop.model.types import RDUnicode, UTCDateTime
from linkdrop.model.expando_mixin import JsonExpandoMixin
from linkdrop.model.serializer_mixin import SerializerMixin

class Account(JsonExpandoMixin, SerializerMixin, Base):
    __tablename__ = 'accounts'
    __table_args__ = make_table_args(UniqueConstraint('key', 'domain', 'username', 'userid'))

    id = Column(Integer, primary_key=True)

    key = Column(RDUnicode(64), index=True, nullable=False) # in this mockup, key is really the external user ID.
    # The external account identity information
    domain = Column(RDUnicode(64), nullable=False)
    username = Column(RDUnicode(64), nullable=False)
    userid = Column(RDUnicode(64), index=True, nullable=False)
    created = Column(UTCDateTime)
    updated = Column(UTCDateTime)

    def __init__(self, key):
        self.key = key
        self.updated = self.created = UTCDateTime.now()

