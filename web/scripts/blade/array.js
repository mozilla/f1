/**
 * @license blade/array Copyright (c) 2010, The Dojo Foundation All Rights Reserved.
 * Available via the MIT, GPL or new BSD license.
 * see: http://github.com/jrburke/blade for details
 */
/*jslint  nomen: false, plusplus: false */
/*global require: false */

'use strict';

require.def('blade/array', function () {
    var ostring = Object.prototype.toString,

        array = {
            /**
             * Determines if the input a function.
             * @param {Object} it whatever you want to test to see if it is a function.
             * @returns Boolean
             */
            is: function (it) {
                return ostring.call(it) === "[object Array]";
            }
        };

    return array;
});
