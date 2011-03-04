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
/*global require: false, define: false, window: false, setTimeout: false */
"use strict";

define([ 'jquery', 'blade/object', 'blade/fn', 'module', 'dispatch',
         'text!AutoCompleteRefresh.html'],
function ($,        object,         fn,         module,   dispatch,
          refreshHtml) {

  function split(val) {
    return val.split(/,\s*/);
  }

  function extractLast(term) {
    return split(term).pop();
  }

  return object(null, null, {
    className: module.id.replace('/', '-'),

    refreshShowing: false,
    askRefresh: true,

    init: function (node, contactService) {
      this.dom = $(node);
      this.attachedWidget = false;
      this.acOptions = [];

      // Listen for changes to the contacts.
      contactService.notify(fn.bind(this, this.attachAutoComplete));

      this.contactService = contactService;

      dispatch.sub('optionsChanged', fn.bind(this, function (data) {
        // allow refetching contacts when a new page is shared.
        this.askRefresh = true;
      }));
    },

    /**
     * Updates the formatted autocomplete options and binds the
     * autocomplete widget, but only on the first call.
     */
    attachAutoComplete: function (contactService, contactList) {
      contactList = contactList || [];
      this.acOptions = [];

      // Update the acOptions with formatted contact values.
      contactList.forEach(fn.bind(this, function (contact) {
        this.acOptions.push(contactService.formatContact(contact));
      }));

      if (!this.attachedWidget) {

        this.attachedWidget = true;

        // jQuery UI autocomplete setup from the jQuery UI demo page
        this.dom
          // don't navigate away from the field on tab when selecting an item,
          // or when tabbing to the refresh contacts button.
          .bind("keydown", fn.bind(this, function (event) {
            if (event.keyCode === $.ui.keyCode.TAB &&
                (this.dom.data("autocomplete").menu.active || this.refreshShowing)) {
              event.preventDefault();

              if (this.refreshShowing) {
                this.focusingOnRefresh = true;
                this.refreshDom.find('button').focus();
              }
            } else if (event.keyCode === $.ui.keyCode.ESCAPE && this.refreshShowing) {
              this.askRefresh = false;
              this.hideRefresh();
            }
          }))
          .bind('blur', fn.bind(this, function (event) {
            // be sure to close down the refresh UI if open, but do it
            // on a timeout to allow button clicks in the UI. A bit hacky
            // since it is a timing related thing.
            if (this.refreshShowing && !this.focusingOnRefresh) {
              setTimeout(fn.bind(this, function () {
                this.hideRefresh();
                this.focusingOnRefresh = false;
              }), 500);
            }
          }))
          .autocomplete({
            minLength: 0,
            source: fn.bind(this, function (request, response) {
              // delegate back to autocomplete, but extract the last term
              var filtered = $.ui.autocomplete.filter(this.acOptions, extractLast(request.term));

              // give the user the option to refresh the contacts
              // if no matches.
              if (!filtered.length && this.askRefresh) {
                setTimeout(fn.bind(this, this.showRefresh), 0);
              } else if (this.refreshShowing) {
                this.hideRefresh();
              }

              response(filtered);
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
              if (!this.relatedWidth) {
                this.determineRelatedWidth();
              }

              this.dom.autocomplete('widget').width(this.relatedWidth);
            })
          });
      }

      // account for a previous search waiting on a refresh.
      if (this.waitingSearch) {
        this.dom.autocomplete('search', this.waitingSearch);
        this.dom.focus();
        delete this.waitingSearch;
        this.hideSpinner();
      }
    },

    determineRelatedWidth: function () {
      // Make sure to set the size of the autocomplete to not be bigger
      // than the input area it is bound to.
      var widthNode = this.dom[0];
      while (widthNode && (this.relatedWidth = widthNode.getBoundingClientRect().width) <= 0) {
        widthNode = widthNode.parentNode;
      }
    },

    hideRefresh: function () {
      this.refreshDom.hide();
    },

    /**
     * Shows UI to allow refreshing the contacts list.
     */
    showRefresh: function () {
      if (!this.relatedWidth) {
        this.determineRelatedWidth();
      }

      if (!this.refreshDom) {
        this.refreshDom = $(refreshHtml)
          .css({
            width: this.relatedWidth + 'px'
          })
          .insertAfter(this.dom[0])
            .find('button')
            .bind('click', fn.bind(this, function (evt) {
              evt.preventDefault();
              this.waitingSearch = this.dom.val().trim();
              this.showSpinner();
              this.askRefresh = false;
              this.contactService.fetch();
              this.hideRefresh();
            }))
            .bind('blur', fn.bind(this, function (evt) {
              this.hideRefresh();
            }))
            .end();
      }

      this.refreshDom.show();

      this.refreshShowing = true;
    },

    hideSpinner: function () {
      this.spinnerDom.hide();
    },

    showSpinner: function () {
      if (!this.spinnerDom) {
        this.spinnerDom = $('<div class="AutoCompleteSpinner"></div>')
                            .appendTo(this.dom[0].parentNode);
      }
      this.spinnerDom.show();
    }
  });
});
