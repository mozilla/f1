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
          var serviceCache = fromJson(store.serviceCache) || [];

          //Call ok callback with current knowledge. If there is a change in the
          //account info, then the changed event will be triggered later.
          if (ok) {
            ok(serviceCache);
          }
        },

        update: function (account_data) {
          // XXX TODO
          // get the account and push it into localstore, don't overwrite, we
          // get one account at a time here
          // We write into serviceCache which will be used by api calls
          // to send the auth keys
          var serviceCache = fromJson(store.serviceCache) || [],
              existing = false,
              profile, p, a, acct;

          // we store the entire object in serviceCache
          if (serviceCache) {
            for (a = 0; a < serviceCache.length; a++) {
              if (isCacheMatch(serviceCache[a], account_data.domain,
                               account_data.userid, account_data.username)) {
                serviceCache[a] = account_data;
                existing = true;
                break;
              }
            }
          }
          if (!existing) {
            serviceCache.push(account_data);
          }
          store.serviceCache = JSON.stringify(serviceCache);
          impl.changed();
        },

        remove: function (domain, userid, username) {
          var serviceCache = fromJson(store.serviceCache),
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

          store[key] = JSON.stringify(data);

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
