/**
 * @license blade/object Copyright (c) 2010, The Dojo Foundation All Rights Reserved.
 * Available via the MIT, GPL or new BSD license.
 * see: http://github.com/jrburke/blade for details
 */
/*jslint plusplus: false */
/*global define: false */

'use strict';

define(['./fn'], function (fn) {

    var empty = {},

        /**
         * Creates a new constructor function for generating objects of a certain type.
         *
         * @param {Object} base the base object to inherit from in the
         * prototype chain. Pass null if no parent desired.
         *
         * @param {Array} mixins an array of objects to use to mix in their
         * properties into the new object. Pass null if no mixins desired.
         *
         * @param {Function} objPropertyFunc, a function that returns an object
         * whose properties should be part of this new object's prototype.
         * The function will be passed the function used to call methods
         * on the parent prototype used for this object. The function expects
         * three arguments:
         *   - obj: pass the this object for this arg
         *   - funcName: the function name to call on the prototype object (a string)
         *   - args: an array of arguments. Normally just pass the arguments object.
         * The parent prototype will be a combination of the base object
         * with all mixins applied.
         *
         * @returns {Function} a constructor function.
         */
        object = function (base, mixins, objPropertyFunc) {
            base = base || {};
            var constructor,

                //Create the parent and its parentFunc calling wrapper.
                //The parent function just makes it easier to call the parent
                parent = object.create(base.prototype, mixins),
                parentFunc = function (obj, funcName, args) {
                    return parent[funcName].apply(obj, args);
                },

                //Create a different object for the prototype instead of using
                //parent, so that parent can still refer to parent object
                //without the curren object's properties mixed in
                //(via the objPropertyFunc) with the mixed in properties taking
                //priority over the parent's properties.
                proto = object.create(parent);

            object.mixin(proto, (fn.is(objPropertyFunc) ? objPropertyFunc(parentFunc) : objPropertyFunc), true);

            //Create the constructor function. Calls init if it is defined
            //on the prototype (proto)
            constructor = function () {
                //Protect against a missing new
                if (!(this instanceof constructor)) {
                    throw new Error('blade/object: constructor function called without "new" in front');
                }

                //Call initializer if present.
                if (this.init) {
                    this.init.apply(this, arguments);
                }
            };

            //Set the prototype for this constructor
            constructor.prototype = proto;

            return constructor;
        };

    /**
     * Similar to ES5 create, but instead of setting property attributes
     * for the second arg, allow an array of mixins to mix in properties
     * to the newly created object.
     * A copy of dojo.delegate
     * @param {Object} parent the parent object to use as the prototype.
     * @param {Array} [mixins] array of mixin objects to mix in to the new object.
     */
    function Temp() {}

    object.create = function (obj, mixins) {
        Temp.prototype = obj;
        var temp = new Temp(), i, mixin;

        //Avoid any extra memory hanging around
        Temp.prototype = null;

        if (mixins) {
            for (i = 0; (mixin = mixins[i]); i++) {
                object.mixin(temp, mixin);
            }
        }
        return temp; // Object
    };

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name,
     * unless override is set to true. Borrowed from Dojo.
     *
     * To extend a prototype on a given object, pass in the prototype property
     * to mixin. For example: object.mixin(func.prototype, {a: 'b'});
     *
     * @param {Object} target the object receiving the mixed in properties.
     *
     * @param {Object} source the object that contains the properties to mix in.
     *
     * @param {Boolean} [override] if set to true, then the source's properties
     * will be mixed in even if a property of the same name already exists on
     * the target.
     */
    object.mixin = function (target, source, override) {
        //TODO: consider ES5 getters and setters in here.
        for (var prop in source) {
            if (!(prop in empty) && (!(prop in target) || override)) {
                target[prop] = source[prop];
            }
        }
    };

    return object;
});
