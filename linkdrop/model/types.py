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

import time
import datetime
import dateutil.parser
from dateutil.tz import tzutc, tzlocal
from email.utils import formatdate as email_format_date
from email.utils import mktime_tz, parsedate_tz
from sqlalchemy.types import TypeDecorator, DateTime, Unicode
import codecs

# SqlAlchemy takes a very anal approach to Unicode - if a column is unicode,
# then the Python object must also be unicode and not a string.  This is very
# painful in py2k, so we loosen this a little - string objects are fine so long
# as they don't include extended chars.
class RDUnicode(Unicode):
    def __init__(self, length=None, **kwargs):
        kwargs.setdefault('_warn_on_bytestring', False)
        super(RDUnicode, self).__init__(length=length, **kwargs)

    def bind_processor(self, dialect):
        encoder = codecs.getencoder(dialect.encoding)
        def process(value):
            if isinstance(value, unicode):
                return encoder.encode(value)
            elif isinstance(value, str):
                # Force an error should someone pass a non-ascii string
                assert value.decode('ascii')==value
                return value
            elif value is None:
                return None
            raise ValueError("invalid value for unicode column: %r" % (value,))


# from http://stackoverflow.com/questions/2528189/can-sqlalchemy-datetime-objects-only-be-naive
# to force all dates going to and coming back from the DB to be in UTC.
# All raindrop DateTime fields should be declared using this type.
class UTCDateTime(TypeDecorator):
    impl = DateTime

    def process_bind_param(self, value, engine):
        if value is not None:
            return value.astimezone(tzutc())

    def process_result_value(self, value, engine):
        if value is not None:
            return datetime.datetime(value.year, value.month, value.day,
                            value.hour, value.minute, value.second,
                            value.microsecond, tzinfo=tzutc())

    # Helpers for creating, formatting and parsing datetime values.
    @classmethod
    def from_string(cls, strval, deftz=None):
        try:
            ret = dateutil.parser.parse(strval)
        except ValueError:
            # Sadly, some (but not many) dates which appear in emails can't be
            # parsed by dateutil, but can by the email package. I've no idea
            # if such dates are rfc compliant, but they do exist in the wild -
            # eg:
            # "Sat, 11 Oct 2008 13:29:43 -0400 (Eastern Daylight Time)"
            try:
                utctimestamp = mktime_tz(parsedate_tz(strval))
                ret = datetime.datetime.fromtimestamp(utctimestamp, tzutc())
            except TypeError, exc:
                raise ValueError(exc.args[0])
        else:
            # dateutil parsed it - now turn it into a UTC value.
            # If there is no tzinfo in the string we assume utc.
            if ret.tzinfo is None:
                if deftz is None: deftz = tzutc()
                ret = ret.replace(tzinfo=deftz)
        return ret

    @classmethod
    def as_string(cls, datetimeval):
        return datetimeval.isoformat().split('.')[0].replace('+00:00','Z')

    @classmethod
    def as_rfc2822_string(cls, datetimeval):
        # Need to pass localtime as that is what the email package expects.
        lt = datetimeval.astimezone(tzlocal())
        timestamp = time.mktime(lt.timetuple())
        return email_format_date(timestamp)

    @classmethod
    def from_timestamp(cls, tsval, tz=None):
        if tz is None: tz = tzutc()
        return datetime.datetime.fromtimestamp(tsval, tz)

    @classmethod
    def now(cls):
        return datetime.datetime.now(tzutc())
