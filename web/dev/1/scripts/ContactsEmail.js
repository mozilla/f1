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

/*jslint indent: 2, regexp: false */
/*global define: false */
"use strict";

define([ 'blade/object', 'Contacts', 'jquery', 'accounts', 'blade/fn'],
function (object,         Contacts,     $,      accounts,   fn) {

  var bracketRegExp = /<([^>])+>/;

  /**
   * Overrides the formatting of contacts and converting
   * one of those formatted contacts into a user ID.
   */
  return object(Contacts, null, function (parent) {
    return {
      formatContact: function (contact) {
        var value = contact.displayName;
        if (contact.email !== value) {
          value += ' <' + contact.email + '>';
        }

        return value;
      },

      findContact: function (to) {
        return to;
      },

      /**
       * Determines if a to string is already in the contacts array.
       * @param {String} to a plain email address (no name).
       * @returns {Boolean}
       */
      contains: function (to) {
        return this.contacts.some(function (contact) {
          return contact.email === to;
        });
      },

      incorporate: function (contactsText) {
        var acct = this.svcAccount,
              newContacts = [],
              contacts = contactsText.split(',');

        contacts.forEach(fn.bind(this, function (contact) {
          contact = contact.trim();

          var match = bracketRegExp.exec(contact);

          contact = (match && match[1]) || contact;

          if (!this.contains(contact)) {
            newContacts.push({
              displayName: contact,
              email: contact
            });
          }
        }));

        if (newContacts.length) {
          // update storage of manually entered contacts.
          accounts.getData(acct.domain, acct.userid, acct.username,
            'enteredContacts', fn.bind(this, function (storedContacts) {

            storedContacts = storedContacts || [];

            storedContacts = storedContacts.concat(newContacts);
            accounts.setData(acct.domain, acct.userid, acct.username,
                             'enteredContacts', storedContacts);

            // update the master merged list of contacts.
            this.contacts = this.contacts.concat(newContacts);
            this.toStore({
              list: this.contacts
            });
          }));
        }
      },

      getFormattedContacts: function (entries, callback) {
        var data = [],
            acct = this.svcAccount;

        accounts.getData(acct.domain, acct.userid, acct.username,
          'enteredContacts', fn.bind(this, function (storedContacts) {

            // convert server data to the right format.
            entries.forEach(function (entry) {
              if (entry.emails && entry.emails.length) {
                entry.emails.forEach(function (email) {
                  var displayName = entry.displayName ?
                                    entry.displayName : email.value;
                  data.push({
                    displayName: displayName,
                    email: email.value
                  });
                });
              }
            });

            // add in any manually saved email addresses.
            if (storedContacts) {
              data = data.concat(storedContacts);
            }

            callback(data);
          })
        );
      }
    };
  });
});
