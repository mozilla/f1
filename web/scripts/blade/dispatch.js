/**
 * @license blade/dispatch Copyright (c) 2010, The Dojo Foundation All Rights Reserved.
 * Available via the MIT, GPL or new BSD license.
 * see: http://github.com/jrburke/blade for details
 */
/*jslint  nomen: false, plusplus: false */
/*global require: false */

'use strict';

require.def('blade/dispatch', ['blade/object', 'blade/fn'], function (object, fn) {
    var emptyFunc = function () {},
        mainDispatch,
        slice = Array.prototype.slice,

        needBind = function (f) {
            return f !== undefined && (typeof f === 'string' || fn.is(f));
        },

        register = function (type) {
            return function (name, obj, f) {
                //Adjust args to allow for a bind call
                if (needBind(f)) {
                    f = fn.bind(obj, f);
                } else {
                    f = obj;
                }

                var qName = type,
                    typeQ = this[qName] || (this[qName] = {}),
                    q = typeQ[name] || (typeQ[name] = []), index;

                index = q.push(f) - 1;
                q.count = q.count ? q.count + 1 : 1;

                //Return an unregister function to allow removing
                //a listener. Notice that it can make the q array sparsely
                //populated. This should be a sparsely populated array
                //to allow a callback to unregister itself without affecting
                //other callbacks in the array.
                return function () {
                    q[index] = null;
                    q.count -= 1;
                    if (q.count === 0) {
                        delete typeQ[name];
                    }

                    //Clean up closure references for good measure/avoid leaks.
                    qName = typeQ = q = null;
                };
            };
        },

        onAfter = register('_dispatchAfterQ'),

        /**
         * Defines the dispatch object. You can call its methods for a general
         * publish/subscribe mechanism, or mixin its prototype properties
         * to another object to give that object dispatch capabilities.
         */
        dispatch = {
            on: register('_dispatchBeforeQ'),
            onAfter: function (name, obj, f, wantValue) {
                var doBind = needBind(f), result, value, callback, evt;
                //Adjust args if needing a bind
                if (doBind) {
                    callback = f = fn.bind(obj, f);
                } else {
                    wantValue = f;
                    callback = obj;
                }

                result = doBind ? onAfter.call(this, name, f, wantValue) : onAfter.call(this, name, obj, f);
                if (wantValue) {
                    //value is the property on the object, unless it is something
                    //that should be immutable or does not exist, then only get a value from _dispatchPersisted
                    value = name in this ? this[name] :
                            (this._dispatchPersisted && name in this._dispatchPersisted ? this._dispatchPersisted[name] : undefined);
                    evt = {
                        preventDefault: emptyFunc,
                        stopPropagation: emptyFunc,
                        returnValue: value
                    };

                    if (value !== undefined) {
                        callback(evt);
                    }
                }
                return result;
            },

            /**
             * Sends an event. An event can have its values modified by "before"
             * listeners before the default action happens. A "before" listener
             * can also prevent the default action from occurring. "after" listeners
             * only get to be notified of the return value from the event.
             * 
             * @param {Object||String} message the message can either be an object
             * with the following properties:
             * @param {String} message.name the name of the message
             * @param {Array} message.args the array of arguments for the message
             * @param {Boolean}message.persist the result of the send should be
             * remembered, so that any subsequent listeners that listen after
             * the result is rememberd can opt to get the last good value.
             * @param {Function} [message.defaultAction] a default action to take
             * if any of the "before" listeners do not call preventDefault()
             * on the event object they receive.
             *
             * If message is a string, then that is like the "name" property mentioned
             * above, and any additional function arguments are treated as the
             * args array.
             *
             * If defaultAction is not passed, then the default action will be to
             * either set the property value on this object that matches the name
             * to the first arg value, or if the name maps to function property
             * on the object, it will call that function with the args.
             * 
             * @returns {Object} the returnValue from any 
             */
            send: function (message) {
                if (typeof message === 'string') {
                    //Normalize message to object arg form.
                    message = {
                        name: message,
                        args: slice.call(arguments, 1)
                    };
                }

                var name = message.name,
                    beforeQ = this._dispatchBeforeQ && this._dispatchBeforeQ[name],
                    afterQ = this._dispatchAfterQ && this._dispatchAfterQ[name],
                    preventDefault = false, stopImmediatePropagation,
                    evt = {
                        preventDefault: function () {
                            preventDefault = true;
                        },
                        stopImmediatePropagation: function () {
                            stopImmediatePropagation = true;
                        },
                        args: message.args
                    },
                    i, result, value, args, isFunc, persisted;

                //Trigger before listeners
                if (beforeQ) {
                    for (i = 0; i < beforeQ.length; i++) {
                        //array can be sparse because of unregister functions
                        if (beforeQ[i]) {
                            beforeQ[i](evt);
                            if (stopImmediatePropagation) {
                                break;
                            }
                        }
                    }
                }

                //If a before handler prevents the default action, exit
                //early, using any return value found in the event that may
                //have been set by a before handler.
                if (preventDefault) {
                    return evt.returnValue;
                }

                //Do the default action.
                if (message.defaultAction) {
                    result = message.defaultAction.apply(this, evt.args);
                } else {
                    //Only bother if the property already exists on the object,
                    //otherwise it is a catch all or just an event router
                    args = evt.args;
                    if (name in this) {
                        isFunc = fn.is(this[name]);
                        value = this[name];

                        if (args && args.length) {
                            //A set operation
                            result = isFunc ? value.apply(this, args) : this[name] = args[0];
                        } else {
                            //A get operation
                            result = isFunc ? this[name]() : value;
                        }
                    } else if (this._dispatchCatchAll) {
                        //Allow the catch all to get it.
                        result = this._dispatchCatchAll(name, args);
                    } else {
                        result = args && args[0];
                    }
                }

                //Trigger mutable after listeners first, before the immutable ones
                //to allow the mutable ones to modify the result.
                if (afterQ) {
                    stopImmediatePropagation = false;
                    evt.returnValue = result;
                    for (i = 0; i < afterQ.length; i++) {
                        //array can be sparse because of unregister functions
                        if (afterQ[i]) {
                            afterQ[i](evt);
                            if (stopImmediatePropagation) {
                                break;
                            }
                        }
                    }
                    result = evt.returnValue;
                }

                //Hold on to the result if need be. Useful for the deferred/promise
                //cases where listeners can be added after the deferred completes.
                if (message.persist) {
                    persisted = this._dispatchPersisted || (this._dispatchPersisted = {});
                    persisted[message.name] = result;
                }

                return result;
            }
        };

    //Create a top level dispatch that can be used for "global" event routing,
    //and which can make new dispatch objects that have all the methods above,
    //but without the instance variables.
    mainDispatch = object.create(dispatch);
    mainDispatch.make = function () {
        return object.create(dispatch);
    };

    return mainDispatch;
});
