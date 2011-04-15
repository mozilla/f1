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

/*jslint indent: 2 */
/*global define: false, localStorage: false */
"use strict";

define(['dispatch'], function (dispatch) {
  var internalStore = {},
      callbacks = {},
      store;

  store = {
    get: function (key, callback) {
      var keyCallbacks;

      if (key in internalStore) {
        // favor internal storage when available.
        callback(internalStore[key]);
      } else {
        // hold on to the callback until there is an answer.
        keyCallbacks = callbacks[key];

        if (!keyCallbacks) {
          keyCallbacks = callbacks[key] = [];

          // ask the real storage for it.
          dispatch.pub('storeGet', key);
        }

        keyCallbacks.push(callback);
      }
    },

    set: function (key, value) {
      internalStore[key] = value;

      dispatch.pub('storeSet', {
        key: key,
        value: value
      });
    },

    remove: function (key) {
      delete internalStore[key];
      dispatch.pub('storeRemove', key);
    }
  };

  dispatch.sub('storeGetReturn', function (data) {
    var key = data.key,
        value = data.value,
        keyCallbacks = callbacks[key];

    internalStore[key] = value;

    if (keyCallbacks) {
      keyCallbacks.forEach(function (callback) {
        callback(value);
      });

      delete callbacks[key];
    }

  });

  dispatch.sub('storeNotifyChange', function (data) {
    if (data.value === null) {
      delete internalStore[data.key];
    } else {
      internalStore[data.key] = data.value;
    }
  });

  dispatch.sub('storeNotifyRemoveAll', function (data) {
    // Reset the internal store
    internalStore = {};
  });

  function storage() {
    return store;
  }

  storage.type = 'chrome';

  return storage;
});