/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Raindrop.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Messaging, Inc..
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * */

//Ported directly from dojo.date.stamp
'use strict';
/*jslint nomen: false, regexp: false, plusplus: false */
/*global require: false */

define([], function () {

    // Methods to convert dates to or from a wire (string) format using well-known conventions
    var _isoRegExp = /^(?:(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?)?(?:T(\d{2}):(\d{2})(?::(\d{2})(.\d+)?)?((?:[+\-](\d{2}):(\d{2}))|Z)?)?$/,

        isoDate = function (/*String*/formattedString, /*Number?*/defaultTime) {
            //    summary:
            //        Returns a Date object given a string formatted according to a subset of the ISO-8601 standard.
            //
            //    description:
            //        Accepts a string formatted according to a profile of ISO8601 as defined by
            //        [RFC3339](http://www.ietf.org/rfc/rfc3339.txt), except that partial input is allowed.
            //        Can also process dates as specified [by the W3C](http://www.w3.org/TR/NOTE-datetime)
            //        The following combinations are valid:
            //
            //            * dates only
            //            |    * yyyy
            //            |    * yyyy-MM
            //            |    * yyyy-MM-dd
            //             * times only, with an optional time zone appended
            //            |    * THH:mm
            //            |    * THH:mm:ss
            //            |    * THH:mm:ss.SSS
            //             * and "datetimes" which could be any combination of the above
            //
            //        timezones may be specified as Z (for UTC) or +/- followed by a time expression HH:mm
            //        Assumes the local time zone if not specified.  Does not validate.  Improperly formatted
            //        input may return null.  Arguments which are out of bounds will be handled
            //         by the Date constructor (e.g. January 32nd typically gets resolved to February 1st)
            //        Only years between 100 and 9999 are supported.
            //
              //    formattedString:
            //        A string such as 2005-06-30T08:05:00-07:00 or 2005-06-30 or T08:05:00
            //
            //    defaultTime:
            //        Used for defaults for fields omitted in the formattedString.
            //        Uses 1970-01-01T00:00:00.0Z by default.

            var match = _isoRegExp.exec(formattedString),
                result = null, offset, zoneSign;

            if (match) {
                match.shift();
                if (match[1]) {
                    match[1]--; // Javascript Date months are 0-based
                }
                if (match[6]) {
                    match[6] *= 1000; // Javascript Date expects fractional seconds as milliseconds
                }

                if (defaultTime) {
                    // mix in defaultTime.  Relatively expensive, so use || operators for the fast path of defaultTime === 0
                    defaultTime = new Date(defaultTime);
                    ["FullYear", "Month", "Date", "Hours", "Minutes", "Seconds", "Milliseconds"].map(function (prop) {
                        return defaultTime["get" + prop]();
                    }).forEach(function (value, index) {
                        match[index] = match[index] || value;
                    });
                }
                result = new Date(match[0] || 1970, match[1] || 0, match[2] || 1, match[3] || 0, match[4] || 0, match[5] || 0, match[6] || 0); //TODO: UTC defaults
                if (match[0] < 100) {
                    result.setFullYear(match[0] || 1970);
                }

                offset = 0;
                zoneSign = match[7] && match[7].charAt(0);
                if (zoneSign !== 'Z') {
                    offset = ((match[8] || 0) * 60) + (Number(match[9]) || 0);
                    if (zoneSign !== '-') {
                        offset *= -1;
                    }
                }
                if (zoneSign) {
                    offset -= result.getTimezoneOffset();
                }
                if (offset) {
                    result.setTime(result.getTime() + offset * 60000);
                }
            }

            return result; // Date or null
        };

    /*=====
        __Options = function(){
            //    selector: String
            //        "date" or "time" for partial formatting of the Date object.
            //        Both date and time will be formatted by default.
            //    zulu: Boolean
            //        if true, UTC/GMT is used for a timezone
            //    milliseconds: Boolean
            //        if true, output milliseconds
            this.selector = selector;
            this.zulu = zulu;
            this.milliseconds = milliseconds;
        }
    =====*/

    isoDate.toIsoString = function (/*Date*/dateObject, /*__Options?*/options) {
        //    summary:
        //        Format a Date object as a string according a subset of the ISO-8601 standard
        //
        //    description:
        //        When options.selector is omitted, output follows [RFC3339](http://www.ietf.org/rfc/rfc3339.txt)
        //        The local time zone is included as an offset from GMT, except when selector=='time' (time without a date)
        //        Does not check bounds.  Only years between 100 and 9999 are supported.
        //
        //    dateObject:
        //        A Date object

        var _ = function (n) {
                return (n < 10) ? "0" + n : n;
            },
            formattedDate, getter, date, year, time, millis, timezoneOffset, absOffset;
        options = options || {};
        formattedDate = [];
        getter = options.zulu ? "getUTC" : "get";
        date = "";
        if (options.selector !== "time") {
            year = dateObject[getter + "FullYear"]();
            date = ["0000".substr((year + "").length) + year, _(dateObject[getter + "Month"]() + 1), _(dateObject[getter + "Date"]())].join('-');
        }
        formattedDate.push(date);
        if (options.selector !== "date") {
            time = [_(dateObject[getter + "Hours"]()), _(dateObject[getter + "Minutes"]()), _(dateObject[getter + "Seconds"]())].join(':');
            millis = dateObject[getter + "Milliseconds"]();
            if (options.milliseconds) {
                time += "." + (millis < 100 ? "0" : "") + _(millis);
            }
            if (options.zulu) {
                time += "Z";
            } else if (options.selector !== "time") {
                timezoneOffset = dateObject.getTimezoneOffset();
                absOffset = Math.abs(timezoneOffset);
                time += (timezoneOffset > 0 ? "-" : "+") +
                    _(Math.floor(absOffset / 60)) + ":" + _(absOffset % 60);
            }
            formattedDate.push(time);
        }
        return formattedDate.join('T'); // String
    };

    return isoDate;
});