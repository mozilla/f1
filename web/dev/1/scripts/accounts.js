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

  // Listen for chrome storage changes, and if it is for
  // serviceCache, translate that into a higher level message
  // understood by the web modules.
  dispatch.sub('storeNotifyChange', function (data) {
    if (data.key === 'serviceCache') {
      if (opener && !opener.closed) {
        dispatch.pub('accountsChanged', null, opener);
      }
      dispatch.pub('accountsChanged');
    }
  });

  var store = storage();

  /**
   * Gets the accounts. Can use a cached value.
   * @param {Function} ok function to receive the account info.
   * @param {Function} error function to call if an error.
   */
  function accounts(ok, error) {
    store.get('serviceCache', function (data) {
      if (ok) {
        ok(data || []);
      }
    });
  }

  /**
   * Updates the accounts from a json account object.
   * @param {Object} cookie object to update from
   */
  accounts.update = function (accountData) {
    // get the account and push it into storage, don't overwrite, we
    // get one account at a time here
    // We write into serviceCache which will be used by api calls
    // to send the auth keys

    store.get('serviceCache', function (serviceCache) {

      var existing = false,
          a;

      serviceCache = serviceCache || [];

      // we store the entire object in serviceCache
      if (serviceCache) {
        for (a = 0; a < serviceCache.length; a++) {
          if (isCacheMatch(serviceCache[a], accountData.domain,
                           accountData.userid, accountData.username)) {
            serviceCache[a] = accountData;
            existing = true;
            break;
          }
        }
      }
      if (!existing) {
        serviceCache.push(accountData);
      }
      store.set('serviceCache', serviceCache);
    });
  };

  /**
   * Remove an accounts from storage.
   * @param {string} domain
   * @param {string} userid
   * @param {string} username
   */
  accounts.remove = function (domain, userid, username) {
    store.get('serviceCache', function (serviceCache) {

      var i, cache;

      if (serviceCache) {
        for (i = 0; (cache = serviceCache[i]); i++) {
          if (isCacheMatch(cache, domain, userid, username)) {
            serviceCache.splice(i, 1);
            break;
          }
        }
        store.set('serviceCache', serviceCache);
      }

      // Delete auxillary data.
      accounts.clearData(domain, userid, username);
    });
  };

  /**
   * Get a full service account record
   * @param {string} domain
   * @param {string} userid
   * @param {string} username
   * @param {Function} callback the callback to call once date is retrieved.
   */
  accounts.getService = function (domain, userid, username, callback) {

    store.get('serviceCache', function (serviceCache) {
      var i, cache;

      if (serviceCache) {
        for (i = 0; (cache = serviceCache[i]); i++) {
          if (isCacheMatch(cache, domain, userid, username)) {
            callback(cache);
            return;
          }
        }
      }
      callback(null);
    });
  };

  /**
   * Clears the account data. Use this when it is known that the server
   * info is no longer valid/expired.
   */
  accounts.clear = function () {
    store.remove('serviceCache');
  };

  /**
   * Sets auxillary data associated with an account.
   * @param {string} domain
   * @param {string} userid
   * @param {string} username
   * @param {string} name the data key name
   * @param {Object} value the data to store at that key name.
   */
  accounts.setData = function (domain, userid, username, name, value) {

    var key = [domain, userid, username].join('|') + 'Data';

    store.get('key', function (data) {
      data = data || {};


      if (value === undefined || value === null) {
        delete data[name];
      } else {
        data[name] = value;
      }

      store.set(key, data);
    });

    return value;
  };

  /**
   * Gets auxillary data associated with an account.
   * @param {string} domain
   * @param {string} userid
   * @param {string} username
   * @param {string} name the key name for the auxillary data.
   * @param {Function} callbac the callback to call when the data is retreived.
   */
  accounts.getData = function (domain, userid, username, name, callback) {
    var key = [domain, userid, username].join('|') + 'Data';

    store.get(key, function (data) {
      data = data || {};

      callback(data[name] || null);
    });
  };

  /**
   * Sets auxillary data associated with an account.
   * @param {string} domain
   * @param {string} userid
   * @param {string} username
   */
  accounts.clearData = function (domain, userid, username) {
    var key = [domain, userid, username].join('|') + 'Data';
    store.remove(key);
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
    dispatch.sub('accountsChanged', action || defaultAction);
  };

  return accounts;
});
