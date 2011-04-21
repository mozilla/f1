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
      this.fromStore(fn.bind(this, function (data) {
        this.lastUpdated = data;
      }));

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
    fromStore: function (callback) {
      var acct = this.svcAccount;
      accounts.getData(acct.domain, acct.userid, acct.username, 'contacts', function (data) {
        callback(data || {});
      });
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
      this.fromStore(fn.bind(this, function (data) {

        this.contacts = data.list;

        if (!this.contacts || this.needFetch()) {
          this.fetch();
        } else {
          this.notifyCallbacks();
        }
      }));
    },

    fetch: function (pageData) {
      var acct = this.svcAccount;

      accounts.getService(acct.domain, acct.userid,
        acct.username, fn.bind(this, function (svcData) {
        
        var data = {
          username: acct.username,
          userid: acct.userid,
          account: JSON.stringify(svcData)
        };
        if (pageData) {
          data.pageData = JSON.stringify(pageData);
        }

        rdapi('contacts/' + acct.domain, {
          type: 'POST',
          data: data,
          //Only wait for 10 seconds, then give up.
          timeout: 10000,
          success: fn.bind(this, function (json) {
            //Transform data to a form usable by the front end.
            if (json && !json.error) {
              var entries = json.result.entry;
              var nextPageData = json.result.pageData;

              this.getFormattedContacts(entries,
                fn.bind(this, function (contacts) {
                  if (!pageData) {
                    this.contacts = contacts;
                  } else {
                    this.contacts.push.apply(this.contacts, contacts);
                  }
                  this.lastUpdated = (new Date()).getTime();

                  this.toStore({
                    list: this.contacts
                  });
                  if (nextPageData) {
                    setTimeout(fn.bind(this, function(nextPageData) {
                      this.fetch(nextPageData);
                    }), 1, nextPageData);
                  }
                })
              );
            }
          }),
          error: fn.bind(this, function (xhr, textStatus, errorThrown) {
            // does not matter what the error is, just eat it and hide
            // the UI showing a wait.
            // If xhr.status === 503, could do a retry, and dispatch a
            // 'serverErrorPossibleRetry', but wait for UX to be worked out
            // in https://bugzilla.mozilla.org/show_bug.cgi?id=642653
            this.notifyCallbacks();
          })
        });
      }));
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
     * @param {Function} callback called once contacts are formatted. Could
     * involve asyn operations. The callback will receive an array of contacts.
     *
     */
    getFormattedContacts: function (entries, callback) {
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
      callback(data);
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
