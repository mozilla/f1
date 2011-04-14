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

define([ 'jquery', 'blade/object', 'blade/fn', 'dispatch', 'rdapi', 'accounts'],
function ($,        object,         fn,         dispatch,   rdapi,   accounts) {

  var Contacts;

  Contacts = object(null, null, {
    init: function (svc, svcAccount) {
      this.svc = svc;
      this.svcAccount = svcAccount;

      this.callbacks = [];
      this.lastUpdated = this.fromStore().lastUpdated;
      // Time check is one day.
      this.timeCheck = 24 * 60 * 60 * 1000;

      // listen for changes in the options, and if a greater than a day,
      // refresh the contacts.
      this.optionsChangeSub = dispatch.sub('optionsChanged', fn.bind(this, function (options) {
        if (this.needFetch()) {
          this.fetch();
        }
      }));
    },

    /**
     * Destroys this instance, not necessarily the data. For that, use
     * clear().
     * Used as an opportunity to unbind event listeners.
     */
    destroy: function () {
      dispatch.unsub('optionsChanged', this.optionsChangeSub);
    },

    clear: function () {
      var acct = this.svcAccount;
      accounts.setData(acct.domain, acct.userid, acct.username, 'contacts');
    },

    needFetch: function () {
      return !this.lastUpdated || (new Date()).getTime() - this.lastUpdated > this.timeCheck;
    },

    /**
     * Retrieves stored contacts. Should only be used internally or by subclasses.
     */
    fromStore: function () {
      var acct = this.svcAccount;
      return accounts.getData(acct.domain, acct.userid, acct.username, 'contacts') || {};
    },

    /**
     * Saves contacts to storage. Should only be used internally or by
     * subclasses.
     *
     * @param {Object} data an object with a "list" property which is this
     * list of contacts to store.
     */
    toStore: function (data) {
      var acct = this.svcAccount;

      if (!data.lastUpdated) {
        data.lastUpdated = this.lastUpdated;
      }

      accounts.setData(acct.domain, acct.userid, acct.username, 'contacts', data);

      this.notifyCallbacks();

      return data;
    },

    /**
     * Includes any new names from a successful share into the autocomplete.
     * By default, it does nothing, but subclasses may do something with it.
     * @param {String} contactsText a comma-separated string of contacts that
     * follow the format returned from findContact().
     */
    incorporate: function (contactsText) {
    },

    /**
     * Notify about changes to the autocomplete list. Can be async, so callback is needed.
     * @param {Function} callback called when contacts are available.
     * It will receive an array of contacts.
     */
    notify: function (callback) {
      this.callbacks.push(callback);
      this.contacts = this.fromStore().list;

      if (!this.contacts || this.needFetch()) {
        this.fetch();
      } else {
        this.notifyCallbacks();
      }
    },

    fetch: function () {
      var acct = this.svcAccount,
          svcData = accounts.getService(acct.domain, acct.userid, acct.username);

      rdapi('contacts/' + acct.domain, {
        type: 'POST',
        domain: acct.domain,
        data: {
          username: acct.username,
          userid: acct.userid,
          startindex: 0,
          maxresults: 500,
          account: JSON.stringify(svcData)
        },
        //Only wait for 10 seconds, then give up.
        timeout: 10000,
        success: fn.bind(this, function (json) {
          //Transform data to a form usable by the front end.
          if (json && !json.error) {
            var entries = json.result.entry;

            this.contacts = this.getFormattedContacts(entries);
            this.lastUpdated = (new Date()).getTime();

            this.toStore({
              list: this.contacts
            });
          }
        }),
        error: fn.bind(this, function (xhr, textStatus, errorThrown) {
          // does not matter what the error is, just eat it and hide
          // the UI showing a wait.
          this.notifyCallbacks();
        })
      });
    },

    notifyCallbacks: function () {
      this.callbacks.forEach(fn.bind(this, function (callback) {
        callback(this, this.contacts);
      }));
    },

    findContact: function (to) {
      var contactId = null;

      (this.contacts || []).some(function (contact) {
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
     * Can throw an error if there is an invalid recipient.
     */
    convert: function (toText) {
      var newrecip = [],
          result = '',
          recip, error;

      if (this.contacts) {
        recip = toText.split(',');
        recip.forEach(fn.bind(this, function (to) {
          to = to.trim();
          if (to) {
            var contactId = this.findContact(to);
            if (contactId) {
              newrecip.push(contactId);
            } else {
              error = new Error('Invalid Recipient');
              error.recipient = to;
              throw error;
            }
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
