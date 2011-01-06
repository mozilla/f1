/**
 * @license blade/func Copyright (c) 2010, The Dojo Foundation All Rights Reserved.
 * Available via the MIT, GPL or new BSD license.
 * see: http://github.com/jrburke/blade for details
 */
/*jslint  nomen: false, plusplus: false */
/*global define: false */

'use strict';

define([], function () {
    var slice = Array.prototype.slice,
        ostring = Object.prototype.toString,

        fn = {
            /**
             * Determines if the input a function.
             * @param {Object} it whatever you want to test to see if it is a function.
             * @returns Boolean
             */
            is: function (it) {
                return ostring.call(it) === '[object Function]';
            },

            /**
             * Different from Function.prototype.bind in ES5 --
             * it has the "this" argument listed first. This is generally
             * more readable, since the "this" object is visible before
             * the function body, reducing chances for error by missing it.
             * If only obj has a real value then obj will be returned,
             * allowing this method to be called even if you are not aware
             * of the format of the obj and f types.
             * It also allows the function to be a string name, in which case,
             * obj[f] is used to find the function.
             * @param {Object||Function} obj the "this" object, or a function.
             * @param {Function||String} f the function of function name that
             * should be called with obj set as the "this" value.
             * @returns {Function}
             */
            bind: function (obj, f) {
                //Do not bother if
                if (!f) {
                    return obj;
                }

                //Make sure we have a function
                if (typeof f === 'string') {
                    f = obj[f];
                }
                var args = slice.call(arguments, 2);
                return function () {
                    return f.apply(obj, args.concat(slice.call(arguments, 0)));
                };
            }
        };

    return fn;
});
