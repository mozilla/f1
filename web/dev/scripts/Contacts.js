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

/*jslint plusplus: false, indent: 2 */
/*global require: false, define: false, window: false */
"use strict";

define([ 'jquery', 'blade/object', 'blade/fn', 'dispatch', 'rdapi',
         'storage', 'accounts'],
function ($,        object,         fn,         dispatch,   rdapi,
          storage,   accounts) {

  var store = storage(),
      Contacts;

  Contacts = object(null, null, {
    init: function (svc, svcAccount) {
      this.svc = svc;
      this.svcAccount = svcAccount;
      this.key = [svcAccount.domain, svcAccount.userid, svcAccount.username].join('|');
      this.timeKey = this.key + 'Time';
      this.contactsKey = this.key + 'Contacts';
      this.callbacks = [];
      this.lastUpdated = store[this.timeKey] && parseInt(store[this.timeKey], 10);
      // Time check is one day.
      this.timeCheck = 24 * 60 * 60 * 1000;

      // listen for changes in the options, and if a greater than a day,
      // refresh the contacts.
      this.optionsChangeSub = dispatch.sub('optionsChanged', fn.bind(this, function (options) {
        if (this.needFetch()) {
          this.fetch();
        }
      }));

      // listen for account removal, and remove the account at that time.
      this.accountRemovedSub = dispatch.sub('accountRemoved-' + this.key, fn.bind(this, function () {
        this.clear();
      }));
    },

    /**
     * Destroys this instance, not necessarily the data. For that, use
     * clear().
     * Used as an opportunity to unbind event listeners.
     */
    destroy: function () {
      dispatch.unsub('optionsChanged', this.optionsChangeSub);
      dispatch.unsub('accountRemoved-' + this.key, this.accountRemovedSub);
    },

    clear: function () {
      delete store[this.timeKey];
      delete store[this.contactsKey];
    },

    needFetch: function () {
      return !this.lastUpdated || (new Date()).getTime() - this.lastUpdated > this.timeCheck;
    },

    /**
     * Private function to get the contacts out of local store.
     */
    parse: function () {
      var contacts = store[this.contactsKey];
      if (contacts) {
        contacts = JSON.parse(contacts);
      }
      return contacts;
    },

    /**
     * Notify about changes to the autocomplete list. Can be async, so callback is needed.
     * @param {Function} callback called when contacts are available.
     * It will receive an array of contacts.
     */
    notify: function (callback) {
      this.callbacks.push(callback);
      this.contacts = this.parse();

      if (!this.contacts || this.needFetch()) {
        this.fetch();
      } else {
        this.notifyCallbacks();
      }
    },

    fetch: function () {
      var svcData;
      svcData = accounts.getService(this.svcAccount.domain, this.svcAccount.userid, this.svcAccount.username);
      rdapi('contacts/' + this.svcAccount.domain, {
        type: 'POST',
        data: {
          username: this.svcAccount.username,
          userid: this.svcAccount.userid,
          startindex: 0,
          maxresults: 500,
          account: JSON.stringify(svcData)
        },
        success: fn.bind(this, function (json) {
          //Transform data to a form usable by the front end.
          if (json && !json.error) {
            var entries = json.result.entry;

            this.contacts = this.getFormattedContacts(entries);
            store[this.contactsKey] = JSON.stringify(this.contacts);
            store[this.timeKey] = this.lastUpdated = (new Date()).getTime();

            this.notifyCallbacks();
          }
        })
      });
    },

    notifyCallbacks: function () {
      this.callbacks.forEach(fn.bind(this, function (callback) {
        callback(this, this.contacts);
      }));
    },

    findContact: function (to, contacts) {
      var contactId;

      contacts.some(function (contact) {
        if (contact.displayName === to) {
          contactId = contact.email || contact.userid || contact.username;
          return true;
        }
        return false;
      });

      return contactId;
    },

    /**
     * Translates contact data from server into a format used on the client.
     * @param {Array} entries
     * @returns {Array}
     */
    getFormattedContacts: function (entries) {
      var data = [];
      entries.forEach(function (entry) {
        if (entry.accounts && entry.accounts.length) {
          entry.accounts.forEach(function (account) {
            data.push({
              displayName: entry.displayName,
              email: '',
              userid: account.userid,
              username: account.username
            });
          });
        }
      });
      return data;
    },

    /**
     * Converts a string that was created by formatContact to real IDs
     * understood by the back-end API calls.
     *
     * @param {String} toText a comma-separated list of contacts.
     * @returns {String} a comma-separated list of ID-based contacts.
     */
    convert: function (toText) {
      var contacts = this.svc.getContacts(store),
          newrecip = [],
          result = '',
          recip;

      if (contacts) {
        recip = toText.split(',');
        recip.forEach(fn.bind(this, function (to) {
          var contactId = this.findContact(to.trim(), contacts);
          if (contactId) {
            newrecip.push(contactId);
          }
        }));
      }

      if (newrecip.length > 0) {
        result = newrecip.join(', ');
      }

      return result;
    },

    /**
     * Formats the contact for display, such as for use in an autocomplete.
     * Overridden by Contact overlays.
     */
    formatContact: function (contact) {
      return contact.displayName;
    }
  });

  Contacts.modelVersion = '3';

  return Contacts;
});
