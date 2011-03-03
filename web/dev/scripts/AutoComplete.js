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

define([ 'jquery', 'blade/object', 'blade/fn'],
function ($,        object,         fn) {

  function split(val) {
    return val.split(/,\s*/);
  }

  function extractLast(term) {
    return split(term).pop();
  }

  return object(null, null, {
    init: function (node, contacts) {
      this.dom = $(node);
      this.attachedWidget = false;
      this.acOptions = [];

      // Listen for changes to the contacts.
      contacts.notify(fn.bind(this, this.attachAutoComplete));
    },

    /**
     * Updates the formatted autocomplete options and binds the
     * autocomplete widget, but only on the first call.
     */
    attachAutoComplete: function (contactService, contactList) {
      var relatedWidth, widthNode;

      contactList = contactList || [];

      // Update the acOptions with formatted contact values.
      contactList.forEach(fn.bind(this, function (contact) {
        this.acOptions.push(contactService.formatContact(contact));
      }));

      if (!this.attachedWidget) {

        this.attachedWidget = true;

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
            source: fn.bind(this, function (request, response) {
              // delegate back to autocomplete, but extract the last term
              response($.ui.autocomplete.filter(this.acOptions, extractLast(request.term)));
            }),
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
            },
            open: fn.bind(this, function (event, ui) {
              // Set the width of the autocomplete once shown.
              if (!relatedWidth) {
                // Make sure to set the size of the autocomplete to not be bigger
                // than the input area it is bound to.
                widthNode = this.dom[0];
                while (widthNode && (relatedWidth = widthNode.getBoundingClientRect().width) <= 0) {
                  widthNode = widthNode.parentNode;
                }
              }

              this.dom.autocomplete('widget').width(relatedWidth);
            })
          });
      }
    }
  });
});
