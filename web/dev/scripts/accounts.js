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

/*jslint indent: 2, plusplus: false */
/*global require: false, define: false, window: false, location: true,
 localStorage: false, opener: false, setTimeout: false */
'use strict';

define([ 'storage', 'dispatch', 'rdapi', 'services'],
function (storage,   dispatch,   rdapi,   services) {

  function isCacheMatch(cache, domain, userid, username) {
    return cache.domain === domain &&
           ((userid && cache.userid === userid) ||
           (username && cache.username === username));
  }

  function fromJson(value) {
    if (value) {
      value = JSON.parse(value);
    }
    return value;
  }

  var store = storage(), impl,
    changeTypes = {
      //localStorage is the most robust, since the change in localStorage
      //can be listened to across windows.

      'localStorage': {

        accounts: function (ok, error) {
          // accounts now simply provides existing accounts retreived during
          // the oauth dances
          var accountCache = fromJson(store.accountCache) || [],
              serviceCache = fromJson(store.serviceCache);

          if (!serviceCache) {
            // fetch now, let the response call ok
            // Set up serviceCache.  This should only ever happen
            // if the local store is cleared (e.g. first run, cleared cookies)
            impl.fetch(ok, error);
            return;
          }

          serviceCache = serviceCache || [];

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
          var accountCache = fromJson(store.accountCache) || [],
              serviceCache = fromJson(store.serviceCache),
              existing = false,
              profile, p, a, acct;

          // move the profile into accountCache
          profile = account_data.profile;
          for (p = 0; p < accountCache.length; p++) {
            acct = accountCache[p].accounts[0];
            if (isCacheMatch(acct, account_data.domain, account_data.userid,
                             account_data.username)) {
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
            for (a = 0; a < serviceCache.length; a++) {
              if (isCacheMatch(serviceCache[a], account_data.domain,
                               account_data.userid, account_data.username)) {
                serviceCache[a] = account_data;
                existing = true;
                break;
              }
            }
          } else {
            serviceCache = [];
          }
          if (!existing) {
            serviceCache.push(account_data);
          }
          store.serviceCache = JSON.stringify(serviceCache);
          impl.changed();
        },

        // remove this once there is time enough for all users
        // to have been migrated over to the new cache.
        fetch: function (ok, error) {
          rdapi('account/get/full', {
            success: function (json) {
              if (json.error) {
                json = [];
              }

              store.serviceCache = JSON.stringify(json);
              var accountCache = [], svc, p;
              for (p = 0; p < json.length; p++) {
                accountCache.push(json[p].profile);

                // clear the contacts cache
                // remove this clearCache call when 3.6 is removed.
                svc = services.domains[json[p].domain];
                svc.clearCache(store);
              }
              store.accountCache = JSON.stringify(accountCache);
              if (ok) {
                ok(accountCache, json);
              }
            },
            error: error || function () {}
          });
        },

        remove: function (domain, userid, username) {
          var accountCache = fromJson(store.accountCache),
              serviceCache = fromJson(store.serviceCache),
              i, cache, a, p, s, svc;

          if (serviceCache) {
            for (i = 0; (cache = serviceCache[i]); i++) {
              if (isCacheMatch(cache, domain, userid, username)) {
                serviceCache.splice(i, 1);
                break;
              }
            }
            store.serviceCache = JSON.stringify(serviceCache);
          }

          // eventually we will deprecate accountCache
          if (accountCache) {
            for (p = 0; p < accountCache.length; p++) {
              s = accountCache[p].accounts;
              for (a = 0; a < s.length; a++) {
                if (isCacheMatch(s[a], domain, userid, username)) {
                  accountCache.splice(p, 1);
                  break;
                }
              }
            }
            store.accountCache = JSON.stringify(accountCache);
          }

          // clear the contacts cache
          svc = services.domains[domain];

          // remove this clearCache call when 3.6 is removed.
          svc.clearCache(store);

          // Delete auxillary data.
          impl.clearData(domain, userid, username);

          impl.changed();
        },

        /**
         * Set auxillary data related to an account. Deleted when the account
         * is deleted.
         */
        setData: function (domain, userid, username, name, value) {
          var key = [domain, userid, username].join('|') + 'Data',
              data = fromJson(store[key]) || {};

          if (value === undefined || value === null) {
            delete data[name];
          } else {
            data[name] = value;
          }

          store[key] = JSON.stringify(value);

          return value;
        },

        /**
         * Get auxillary data related to an account.
         */
        getData: function (domain, userid, username, name) {
          var key = [domain, userid, username].join('|') + 'Data',
              data = fromJson(store[key]) || {};

          return data ? data[name] : null;
        },

        /**
         * Clears auxillary data related to an account. Deleted when the account
         * is deleted.
         */
        clearData: function (domain, userid, username) {
          var key = [domain, userid, username].join('|') + 'Data';
          delete store[key];
        },

        getService: function (domain, userid, username) {
          var serviceCache = fromJson(store.serviceCache),
              i, cache;

          if (serviceCache) {
            for (i = 0; (cache = serviceCache[i]); i++) {
              if (isCacheMatch(cache, domain, userid, username)) {
                return cache;
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
   * @param {string} domain
   * @param {string} userid
   * @param {string} username
   */
  accounts.remove = function (account, userid, username) {
    impl.remove(account, userid, username);
  };

  /**
   * Fetch accounts stored on server.
   * DEPRECATED, interim use for auto-adding accounts that
   * users have already configured
   */
  accounts.fetch = function (ok, error) {
    impl.fetch(ok, error);
  };

  /**
   * Get a full service account record
   * @param {string} domain
   * @param {string} userid
   * @param {string} username
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
   * Sets auxillary data associated with an account.
   * @param {string} domain
   * @param {string} userid
   * @param {string} username
   */
  accounts.setData = function (account, userid, username, name, value) {
    return impl.setData(account, userid, username, name, value);
  };

  /**
   * Gets auxillary data associated with an account.
   * @param {string} domain
   * @param {string} userid
   * @param {string} username
   */
  accounts.getData = function (account, userid, username, name) {
    return impl.getData(account, userid, username, name);
  };

  /**
   * Sets auxillary data associated with an account.
   * @param {string} domain
   * @param {string} userid
   * @param {string} username
   */
  accounts.clearData = function (account, userid, username) {
    return impl.clearData(account, userid, username);
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
