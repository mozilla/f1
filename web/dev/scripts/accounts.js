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
/*global require: false, define: false, window: false, location: true,
 localStorage: false, opener: false, setTimeout: false */
'use strict';

define([ 'storage', 'dispatch', 'rdapi', 'services'],
function (storage,   dispatch,   rdapi,   services) {

  var store = storage(), impl,
    changeTypes = {
      //localStorage is the most robust, since the change in localStorage
      //can be listened to across windows.

      'localStorage': {

        accounts: function (ok, error) {
          // accounts now simply provides existing accounts retreived during
          // the oauth dances
          var accountCache = store.accountCache,
              serviceCache = store.serviceCache;

          //Set up accountCache as a real object.
          if (accountCache) {
            accountCache = JSON.parse(accountCache);
          } else {
            accountCache = [];
          }
          if (!serviceCache) {
            // fetch now, let the response call ok
            // Set up serviceCache.  This should only ever happen
            // if the local store is cleared (e.g. first run, cleared cookies)
            impl.fetch(ok, error);
            return;
          }
          if (serviceCache) {
            serviceCache = JSON.parse(serviceCache);
          } else {
            serviceCache = [];
          }

          //Call ok callback with current knowledge. If there is a change in the
          //account info, then the fetch will trigger changed event later.
          if (ok) {
            ok(accountCache, serviceCache);
          }
        },

        update: function (account_data) {
          // XXX TODO
          // get the account and push it into localstore, don't overwrite, we
          // get one account at a time here
          // We write into accountCache to have account.fetch continue to work.
          // We also write into serviceCache which will be used by api calls
          // to send the auth keys
          var accountCache = store.accountCache,
              serviceCache = store.serviceCache,
              existing = false;
          
          if (accountCache) {
            accountCache = JSON.parse(accountCache);
          } else {
            accountCache = [];
          }
          
          // move the profile into accountCache
          var profile = account_data.profile;
          for (var p in accountCache) {
            if (accountCache[p].providerName === profile.providerName) {
              accountCache[p] = profile;
              existing = true;
              break;
            }
          }
          if (!existing) {
            accountCache.push(profile);
          }
          store.accountCache = JSON.stringify(accountCache);
          
          // we store the entire object in serviceCache, at some point in the
          // future we will remove accountCache
          if (serviceCache) {
            existing = false;
            serviceCache = JSON.parse(serviceCache);
            for (var a in serviceCache) {

              if (serviceCache[a].domain === account_data.domain &&
                  (serviceCache[a].userid === account_data.userid) ||
                  (serviceCache[a].username === account_data.username)) {
                serviceCache[a] = account_data;
                existing = true;
                break;
              }
            }
          } else {
            serviceCache = [];
          }
          if (!existing)
            serviceCache.push(account_data);
          store.serviceCache = JSON.stringify(serviceCache);
          impl.changed();
        },

        fetch: function (ok, error) {
          dump("account.fetch called\n");
          rdapi('account/get/full', {
            success: function (json) {
              if (json.error) {
                json = [];
              }
              if (json.length < 1) {
                dump("no accounts to add\n");
                return;
              }
              
              store.serviceCache = JSON.stringify(json)
              var accountCache = [], svc;
              for (var p in json) {
                accountCache.push(json[p].profile);

                // clear the contacts cache
                svc = services.domains[json[p].domain];
                svc.clearCache(store);
              }
              store.accountCache = JSON.stringify(accountCache);
              dump("account.get added services\n");
              if (ok) {
                ok(accountCache, json);
              }
            },
            error: error || function () {}
          });
        },

        remove: function(domain, userid, username) {
          var accountCache = store.accountCache,
              serviceCache = store.serviceCache;
          if (serviceCache) {
            serviceCache = JSON.parse(serviceCache);
            for (var a in serviceCache) {
              if (serviceCache[a].domain === domain &&
                  (userid && serviceCache[a].userid == userid) ||
                  (username && serviceCache[a].username == username)) {
                serviceCache.splice(a, 1);
                break;
              }
            }
            store.serviceCache = JSON.stringify(serviceCache);
          }
          
          // eventually we will deprecate accountCache
          if (accountCache) {
            accountCache = JSON.parse(accountCache);
            for (var p in accountCache) {
              var s = accountCache[p].accounts;
              for (var a in s) {
                if (s[a].domain === domain &&
                    (userid && s[a].userid == userid) ||
                    (username && s[a].username == username)) {
                  accountCache.splice(p, 1);
                  break;
                }
              }
            }
            store.accountCache = JSON.stringify(accountCache);
          }
          
          // clear the contacts cache
          var svc = services.domains[domain];
          svc.clearCache(store);
          
          impl.changed();
        },

        getService: function(domain, userid, username) {
          var serviceCache = store.serviceCache;
          if (serviceCache) {
            serviceCache = JSON.parse(serviceCache);
            for (var a in serviceCache) {
              if (serviceCache[a].domain === domain &&
                  (userid && serviceCache[a].userid == userid) ||
                  (username && serviceCache[a].username == username)) {
                return serviceCache[a];
              }
            }
          }
          return null;
        },
        
        changed: function () {
          store.accountChanged = (new Date()).getTime();
          //Force the onchange events to occur. Sometimes the storage
          //events do not fire?
          if (opener && !opener.closed) {
            dispatch.pub('accountsChanged', null, opener);
          }
          dispatch.pub('accountsChanged');
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
          //Also use direct notification in case storage events fail.
          dispatch.sub('accountsChanged', action);
        }
      },
      //Some extensions mess with localStorage, so in that case, fall back to
      //using dispatching.
      'memory': {

        accounts: function (ok, error) {
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
   * Updates the accounts from a json account object. 
   * @param {Object} cookie object to update from
   */
  accounts.update = function (account_data) {
    impl.update(account_data);
  };

  /**
   * Remove an accounts from storage. 
   * @param {string} account domain
   * @param {string} account userid
   * @param {string} account username
   */
  accounts.remove = function (account, userid, username) {
    impl.remove(account, userid, username);
  };

  /**
   * Fetch accounts stored on server.
   * DEPRECATED, interim use for auto-adding accounts that
   * users have already configured
   * 
   * @param {string} account domain
   * @param {string} account userid
   * @param {string} account username
   */
  accounts.fetch = function (ok, error) {
    impl.fetch(ok, error);
  };

  /**
   * Get a full service account record 
   * @param {string} account domain
   * @param {string} account userid
   * @param {string} account username
   */
  accounts.getService = function (account, userid, username) {
    return impl.getService(account, userid, username);
  };

  /**
   * Clears the account data. Use this when it is known that the server
   * info is no longer valid/expired.
   */
  accounts.clear = function () {
    delete store.accountCache;
    delete store.serviceCache;
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
