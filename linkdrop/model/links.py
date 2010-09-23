# Link definitions
from uuid import uuid1
import urllib, json, cgi

from pylons import config, request, response, session, url
from paste.deploy.converters import asbool

from sqlalchemy import Column, Integer, String, Boolean, UniqueConstraint, Text, Sequence
from sqlalchemy.orm.exc import NoResultFound

from linkdrop.model.meta import Base, Session, make_table_args
from linkdrop.model.types import RDUnicode
from linkdrop.model.expando_mixin import JsonExpandoMixin
from linkdrop.model.serializer_mixin import SerializerMixin

class Link(JsonExpandoMixin, SerializerMixin, Base):
    __tablename__ = 'links'

    id = Column(Integer, primary_key=True)
    userkey = Column(RDUnicode(128), index=True)
    long_url = Column(RDUnicode(128), nullable=False)
    short_url = Column(RDUnicode(128), nullable=False, index=True, default='')
    audience = Column(RDUnicode(128), nullable=False, default='')

    def shorten(self):
        if asbool(config.get('test_shortener')):
            assert self.id is not None
            self.short_url = url(controller='links', action='get', id=self.id, qualified=True)
        else:
            longUrl = cgi.escape(self.long_url)
            bitly_userid= config.get('bitly.userid')
            bitly_key = config.get('bitly.key')
            bitly_result = urllib.urlopen("http://api.bit.ly/v3/shorten?login=%(bitly_userid)s&apiKey=%(bitly_key)s&longUrl=%(longUrl)s&format=json" % locals()).read()
            bitly_data = json.loads(bitly_result)['data']
            self.short_url = bitly_data["url"]

    @staticmethod
    def get_or_create(longurl, author=None):
        try:
            return Session.query(Link).filter_by(long_url=longurl).one()
        except NoResultFound:
            l = Link()
            l.long_url = longurl
            l.userkey = author
            Session.add(l)
            if asbool(config.get('test_shortener')):
                # add and commit to get the id, then shorten
                Session.commit()
                Session.flush()
            l.shorten()
            Session.commit()
            return l

