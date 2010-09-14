from linkdrop.model.links import Link
from linkdrop.model.meta import Session
from sqlalchemy.orm.exc import NoResultFound, MultipleResultsFound

def sign_link(shorturl, author):
    try:
      link = Session.query(Link).filter_by(short_url=shorturl).all()[0]
    except NoResultFound:
      print "FAILURE TO SIGN"
      return {'error': "Couldn't find that short URL"}

    print "XXXXXXXXXXX signing: ", shorturl, author
    link.userkey = author
    link.shorten()
    return link
