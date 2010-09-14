# Link definitions
from uuid import uuid1
import urllib, json, cgi

from sqlalchemy import Column, Integer, String, Boolean, UniqueConstraint, Text, Sequence

from linkdrop.model.meta import Base, Session, make_table_args
from linkdrop.model.types import RDUnicode
from linkdrop.model.expando_mixin import JsonExpandoMixin
from linkdrop.model.serializer_mixin import SerializerMixin

usingOwnShortener = False

def makeid():
    links = Session.query(Link).order_by(Link.id.desc()).all()
    
    if not links:
        return 1
    return links[0].id + 1

class Link(JsonExpandoMixin, SerializerMixin, Base):
    __tablename__ = 'links'

    id = Column(Integer, primary_key=True, default=makeid)

    userkey = Column(RDUnicode(128), index=True)
    long_url = Column(RDUnicode(128), nullable=False)
    short_url = Column(RDUnicode(128), nullable=False)
    audience = Column(RDUnicode(128), nullable=False)

    def __init__(self):
        self.id = makeid() # we'll need it before the INSERT statement occurs

    def shorten(self):
        if usingOwnShortener:
            self.short_url = "http://127.0.0.1:5000/api/links/get/" + "%x" % self.id
        else: # using bitly for now
            longUrl = cgi.escape(self.long_url)
            bitly_userid="linkdrop"
            bitly_key = "R_9d8dc7f30887c45eb7b3719d71251006"
            bitly_result = urllib.urlopen("http://api.bit.ly/v3/shorten?login=%(bitly_userid)s&apiKey=%(bitly_key)s&longUrl=%(longUrl)s&format=json" % locals()).read()
            bitly_data = json.loads(bitly_result)['data']
            self.short_url = bitly_data["url"]

