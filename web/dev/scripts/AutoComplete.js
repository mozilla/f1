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

define([ 'jquery', 'blade/object', 'blade/fn', 'rdapi', 'storage', 'accounts'],
function ($,        object,         fn,         rdapi,   storage,   accounts) {

  var store = storage();

  function split(val) {
    return val.split(/,\s*/);
  }

  function extractLast(term) {
    return split(term).pop();
  }

  return object(null, null, {
    init: function (node, svc, svcAccount) {
      this.dom = $(node);
      this.svc = svc;
      this.svcAccount = svcAccount;

      // Fetch the contacts for use in the autocomplete
      this.configureContacts();
    },

    findContact: function (to, contacts) {
      var acct = contacts[to.trim()], un, c;
      if (acct) {
        return acct;
      }

      for (un in contacts) {
        if (contacts.hasOwnProperty(un)) {
          c = contacts[un];
          if (c.userid === to) {
            return c;
          }
          if (c.username === to) {
            return c;
          }
        }
      }
      return null;
    },

    /**
     * Converts the to text in an autocomplete to real IDs understood by the
     * back-end API calls.
     * @param {String} toText a comma-separated list of contacts.
     * @returns {String} a comma-separated list of ID-based contacts.
     */
    convert: function (toText) {
      var contacts = this.svc.getContacts(store),
          newrecip = [],
          result = '',
          recip, self;

      if (contacts) {
        recip = toText.split(',');
        self = this;
        recip.forEach(function (to) {
          var acct = self.findContact(to.trim(), contacts);
          if (acct && !acct.email) {
            newrecip.push(acct.userid ? acct.userid : acct.username);
          }
        });
      }
      if (newrecip.length > 0) {
        result = newrecip.join(', ');
      }

      return result;
    },

    /**
     * Makes sure there is an autocomplete set up with the latest
     * store data.
     */
    attachAutoComplete: function () {
      var acOptions = [],
          acFormat = this.svc.acformat;

      if (this.contacts) {
        this.contacts.forEach(function (contact) {
          var optionValue = '';
          acFormat.forEach(function (prop, i) {
            optionValue += (i > 0 ? ' ' : '') + contact[prop];
          });
          acOptions.push(optionValue);
        });
      }

      // jQuery UI autocomplete setup from the jQuery UI demo page
      this.dom
        // don't navigate away from the field on tab when selecting an item
        .bind("keydown", function (event) {
          if (event.keyCode === $.ui.keyCode.TAB &&
              $(this).data("autocomplete").menu.active) {
            event.preventDefault();
          }
        })
        .autocomplete({
          minLength: 0,
          source: function (request, response) {
            // delegate back to autocomplete, but extract the last term
            response($.ui.autocomplete.filter(acOptions, extractLast(request.term)));
          },
          focus: function () {
            // prevent value inserted on focus
            return false;
          },
          select: function (event, ui) {
            var terms = split(this.value);
            // remove the current input
            terms.pop();
            // add the selected item
            terms.push(ui.item.value);
            // add placeholder to get the comma-and-space at the end
            terms.push("");
            this.value = terms.join(", ");
            return false;
          }
        });
    },

    /**
     * Use store to save contacts, but fetch from API
     * server if there is no store copy.
     */
    configureContacts: function () {
      var svcData;
      this.contacts = this.svc.getContacts(store);
      if (!this.contacts) {
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
            //Transform data to a form usable by autocomplete.
            if (json && !json.error) {
              var entries = json.result.entry;

              this.contacts = this.svc.getFormattedContacts(entries);
              this.svc.setContacts(store, this.contacts);
              this.attachAutoComplete();
            }
          })
        });
      } else {
        this.attachAutoComplete();
      }
    }
  });
});
