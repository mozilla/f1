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
/*global require: false, window: false, location: true, localStorage: false,
  opener: false, setTimeout: false */
'use strict';

require.def('accounts',
        ['storage', 'dispatch', 'rdapi'],
function (storage,   dispatch,   rdapi) {

  var store = storage(), impl,
    changeTypes = {
      //localStorage is the most robust, since the change in localStorage
      //can be listened to across windows.

      'localStorage': {

        accounts: function (ok, error) {
          var accountCache = store.accountCache,
              lastCheck = store.lastAccountCheck || 0,
              currentTime = (new Date()).getTime(),
              fetch = false;

          if (!accountCache || (currentTime - lastCheck) > 3000) {
            fetch = true;
          }

          //Set up accountCache as a real object.
          if (accountCache) {
            accountCache = JSON.parse(accountCache);
          } else {
            accountCache = [];
          }

          //Call ok callback with current knowledge. If there is a change in the
          //account info, then the fetch will trigger changed event later.
          if (ok) {
            ok(accountCache);
          }

          if (fetch) {
            impl.fetch(null, error);
          }
        },

        fetch: function (ok, error) {
          rdapi('account/get', {
            success: function (json) {
              if (json.error) {
                json = [];
              }

              store.lastAccountCheck = (new Date()).getTime();

              if (ok) {
                ok(json);
              }

              //Check for changes, and if so, then trigger accounts changed.
              var accountCache = store.accountCache, same;

              accountCache = accountCache ? JSON.parse(accountCache) : [];
              same = json.length === accountCache.length;

              if (same) {
                same = !json.some(function (account, i) {
                  return account.identifier !== accountCache[i].identifier;
                });
              }

              if (!same) {
                store.accountCache = JSON.stringify(json);
                impl.changed();
              }
            },
            error: error || function () {}
          });
        },

        changed: function () {
          store.accountChanged = (new Date()).getTime();
        },

        onChange: function (action) {
          //Listen to storage changes, and if a the accountChanged key
          //changes, refresh.
          var lastValue = store.accountChanged;
          window.addEventListener('storage', function (evt) {
            //Only refresh if the accounts were changed.
            if (store.accountChanged !== lastValue) {
              action();
            }
          }, false);
        }
      },
      //Some extensions mess with localStorage, so in that case, fall back to
      //using dispatching.
      'memory': {

        accounts: function (ok, error) {
          impl.fetch(ok, error);
        },

        fetch: function (ok, error) {
          rdapi('account/get', {
            success: function (json) {
              if (json.error) {
                json = [];
              }
              if (ok) {
                ok(json);
              }
            },
            error: error || function () {}
          });
        },

        changed: function () {
          //Use dispatching. Dispatch to current window, but also to an opener
          //if available.
          store.accountChanged = (new Date()).getTime();

          if (opener) {
            dispatch.pub('accountsChanged', null, opener);
          }
          dispatch.pub('accountsChanged');
        },

        onChange: function (action) {
          dispatch.sub('accountsChanged', action);
        }
      }
    };

  impl = changeTypes[storage.type];

  /**
   * Gets the accounts. Can use a cached value.
   * @param {Function} ok function to receive the account info.
   * @param {Function} error function to call if an error.
   */
  function accounts(ok, error) {
    return impl.accounts(ok, error);
  }

  /**
   * Gets the accounts. Forces a call to the server.
   * @param {Function} ok function to receive the account info.
   * @param {Function} error function to call if an error.
   */
  accounts.fetch = function (ok, error) {
    impl.fetch(ok, error);
  };

  /**
   * Clears the account data. Use this when it is known that the server
   * info is no longer valid/expired.
   */
  accounts.clear = function () {
    delete store.accountCache;
  };

  /**
   * Called when the cache of accounts has changed.
   */
  accounts.changed = function () {
    return impl.changed();
  };

  /**
   * Default action is to just reload.
   */
  function defaultAction() {
    location.reload();
  }

  /**
   * Called to set up the action when accounts change.
   * Call it with no args to get the default behavior, page reload.
   */
  accounts.onChange = function (action) {
    return impl.onChange(action || defaultAction);
  };

  return accounts;
});
