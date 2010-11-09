/**
 * @license blade/defer Copyright (c) 2010, The Dojo Foundation All Rights Reserved.
 * Available via the MIT, GPL or new BSD license.
 * see: http://github.com/jrburke/blade for details
 */
/*jslint  nomen: false, plusplus: false */
/*global require: false */

'use strict';

require.def('blade/defer', ['blade/fn', 'blade/dispatch'], function (fn, bladeDispatch) {

    /**
     * Creates an object representing a deferred action.
     * @param {Function} [onCancel] optional function to call if the deferred
     * action is canceled
     * @param {Array} otherEventNames an array of event names to also allow
     * sending and notifying on this type of deferred action. This allows you
     * to express more complex interactions besides something that just indicates
     * "ok", "error" or "cancel".
     * @returns {Object} object representing the deferred action. It contains
     * two properties:
     * send: a function to send events. It takes a string name for the event,
     * "ok", "error" or "cancel", and a value.
     * listener: an object that only exposes an "ok", "error" and "cancel"
     * functions that allow listening to those respective events. If otherEventNames
     * specified other events, then there are listener registration functions
     * for those event names too.
     */
    function defer(onCancel, otherEventNames) {        
        var dfd = {},
            sentName, i, evtName,
            dispatch = bladeDispatch.make(),
            makeCb = function (name) {
                return function (obj, f) {
                    var cb = fn.bind(obj, f);
                    dispatch.onAfter(name, function (evt) {
                        return cb(evt.returnValue);
                    }, true);
                    return dfd.listener;
                };
            };

        //Set up the cancellation action if desired.
        if (onCancel) {
            dispatch.onAfter('cancel', function (evt) {
                return onCancel();
            });
        }

        dfd.send = function (name, value) {
            //Do not allow sending more than one message for the deferred.
            if (sentName) {
                throw new Error('blade/defer object already sent event: ' + sentName);
            }
            sentName = name;

            dispatch.send({
                name: name,
                args: [value],
                persist: true
            });

            //If no error handlers on this deferred, be sure to at least
            //log it to allow some sort of debugging.
            if (name === 'error' &&
                (!dispatch._dispatchAfterQ || ! dispatch._dispatchAfterQ.error) &&
                defer.onErrorDefault) {
                defer.onErrorDefault(value);
            }

            return dfd;
        };

        dfd.listener = {
            ok: makeCb('ok'),
            error: makeCb('error'),
            cancel: makeCb('cancel')
        };

        //Allow wiring up other event names
        if (otherEventNames) {
            for (var i = 0; (evtName = otherEventNames[i]); i++) {
                dfd.listener[name] = makeCb[name];
            }
        }

        return dfd;
    }

    defer.onErrorDefault = function (err) {
        throw err;
    }

    return defer;
});

