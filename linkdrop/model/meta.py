"""SQLAlchemy Metadata and Session object"""
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import scoped_session, sessionmaker

__all__ = ['Base', 'Session']

# SQLAlchemy session manager. Updated by model.init_model()
Session = scoped_session(sessionmaker())

# The declarative Base
Base = declarative_base()


# Return a value suitable for __table_args__ which includes common table
# arguments which should be used by all tables.
def make_table_args(*args, **kw):
    kwuse = kw.copy()
    if 'mysql_charset' not in kwuse:
        kwuse['mysql_charset'] = 'utf8'
    if not args:
        return kwuse
    return args + (kwuse,)
