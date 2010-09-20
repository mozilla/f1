from linkdrop.model.links import Link
from linkdrop.model.meta import Session
from sqlalchemy.orm.exc import NoResultFound, MultipleResultsFound

def sign_link(shorturl, author):
    link = Session.query(Link).filter_by(short_url=shorturl).first()
    if link is None:
      return {'error': "Couldn't find that short URL"}

    print "XXXXXXXXXXX signing: ", shorturl, author
    link.userkey = author
    link.shorten()
    return link
