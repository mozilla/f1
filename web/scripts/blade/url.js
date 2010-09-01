/**
 * @license blade/url Copyright (c) 2010, The Dojo Foundation All Rights Reserved.
 * Available via the MIT, GPL or new BSD license.
 * see: http://github.com/jrburke/blade for details
 */
/*jslint  nomen: false, plusplus: false */
/*global require: false */

'use strict';

require.def('blade/url', function () {
    var ostring = Object.prototype.toString;

    return {
        queryToObject: function (/*String*/ str) {
            // summary:
            //        Create an object representing a de-serialized query section of a
            //        URL. Query keys with multiple values are returned in an array.
            //
            // example:
            //        This string:
            //
            //    |        "foo=bar&foo=baz&thinger=%20spaces%20=blah&zonk=blarg&"
            //        
            //        results in this object structure:
            //
            //    |        {
            //    |            foo: [ "bar", "baz" ],
            //    |            thinger: " spaces =blah",
            //    |            zonk: "blarg"
            //    |        }
            //    
            //        Note that spaces and other urlencoded entities are correctly
            //        handled.
            var ret = {},
                qp = str.split('&'),
                dec = decodeURIComponent,
                parts, name, val;

            qp.forEach(function (item) {
                if (item.length) {
                    parts = item.split('=');
                    name = dec(parts.shift());
                    val = dec(parts.join('='));
                    if (typeof ret[name] === 'string') {
                        ret[name] = [ret[name]];
                    }

                    if (ostring.call(ret[name]) === '[object Array]') {
                        ret[name].push(val);
                    } else {
                        ret[name] = val;
                    }
                }
            });
            return ret;
        }
    };
});
