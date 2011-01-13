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
/*global define: false, document: false */
"use strict";

define([ 'blade/object', 'blade/Widget', 'jquery', 'text!./AccountPanel.html',
         'TextCounter', 'storage', 'module', 'placeholder', 'dispatch',
         'AutoComplete', 'rdapi', 'blade/fn'],
function (object,         Widget,         $,        template,
          TextCounter,   storage,   module,   placeholder,   dispatch,
          AutoComplete,   rdapi,   fn) {

  var store = storage(),
      className = module.id.replace(/\//g, '-');

  //Set up event handlers.
  $('body').delegate('.' + className + ' form.messageForm', 'submit', function (evt) {
    Widget.closest(module.id, evt, 'onSubmit');
  });

  /**
   * Define the widget.
   * This widget assumes its member variables include the following objects:
   *
   * options: the options for the URL/page being shared.
   * account: the account returned from /account/get
   * svc: The share service config, from services module.
   */
  return object(Widget, null, function (parent) {
    return {
      moduleId: module.id,
      className: className,

      // text counter support
      counter: null,
      urlSize: 26,

      template: template,

      onCreate: function () {
        var name = this.account.displayName,
            userName, savedOptions;

        //Set up the svcAccount property
        this.svcAccount = this.account.accounts[0];

        //Check for saved data. Only use if the URL
        //and the account match
        savedOptions = store['AccountPanel-' + this.svcAccount.domain];
        if (savedOptions) {
          savedOptions = JSON.parse(savedOptions);
          if (savedOptions.url !== this.options.url ||
              savedOptions.userid !== this.svcAccount.userid ||
              savedOptions.domain !== this.svcAccount.domain ||
              savedOptions.username !== this.svcAccount.username) {
            this.clearSavedData();
            savedOptions = null;
          }
        }

        //Set up the photo property
        this.photo = this.account.photos && this.account.photos[0] && this.account.photos[0].value;

        //Set up nicer display name
        // XXX for email services, we should show the email account, but we
        // cannot rely on userid being a 'pretty' name we can display
        userName = this.svcAccount.username;
        if (userName && userName !== name) {
          name = name + " (" + userName + ")";
        }

        this.displayName = name;
      },

      onRender: function () {
        var i, tempNode;
        //Get a handle on the accordion body
        for (i = 0; (tempNode = this.node.childNodes[i]); i++) {
          if (tempNode.nodeType === 1 &&
              tempNode.className.indexOf(this.className) !== -1) {
            this.bodyNode = tempNode;
            break;
          }
        }

        if (this.svc.textLimit) {
          this.startCounter();
        }
        placeholder(this.bodyNode);

        this.storeContacts();
      },

      clearSavedData: function () {
        delete store['AccountPanel-' + this.svcAccount.domain];
      },

      saveData: function () {
        var data = this.getFormData();
        store['AccountPanel-' + this.svcAccount.domain] = JSON.stringify(data);
      },

      validate: function (sendData) {
        return !this.counter || !this.counter.isOver();
      },

      startCounter: function () {
        //Set up text counter
        if (!this.counter) {
          this.counter = new TextCounter($('textarea.message', this.bodyNode),
                                         $('.counter', this.bodyNode),
                                         this.svc.textLimit - this.urlSize);
        }

        // Update counter. If using a short url from the web page itself, it could
        // potentially be a different length than a bit.ly url so account for
        // that. The + 1 is to account for a space before adding the URL to the
        // tweet.
        this.counter.updateLimit(this.options.shortUrl ?
                                 (this.svc.textLimit - (this.options.shortUrl.length + 1)) :
                                 this.svc.textLimit - this.urlSize);
      },

      getFormData: function () {
        var dom = $('form', this.bodyNode),
            data = {};
        //Make sure all form elements are trimmed and username exists.
        //Then collect the form values into the data object.
        $.each(dom[0].elements, function (i, node) {
          var trimmed = node.value.trim();

          if (node.getAttribute("placeholder") === trimmed) {
            trimmed = "";
          }

          node.value = trimmed;

          if (node.value) {
            data[node.name] = node.value;
          }
        });

        return data;
      },

      onSubmit: function (evt) {
        //Do not submit the form as-is.
        evt.preventDefault();

        //Make sure all form elements are trimmed and username exists.
        //Then collect the form values into the data object.
        var sendData = this.getFormData(),
            contacts, newrecip, recip, acct;

        if (!this.validate(sendData)) {
          return;
        }

        if (this.options.shortUrl) {
          sendData.shorturl = this.options.shortUrl;
        } else if (this.svc.shorten) {
          sendData.shorten = true;
        }

        // fixup to addressing if necessary
        if (sendData.to) {
          contacts = this.svc.getContacts(store);
          newrecip = [];
          if (contacts) {
            recip = sendData.to.split(',');
            recip.forEach(function (to) {
              acct = contacts[to.trim()];
              if (acct && !acct.email) {
                newrecip.push(acct.userid ? acct.userid : acct.username);
              }
            });
          }
          if (newrecip.length > 0) {
            sendData.to = newrecip.join(', ');
          }
        }

        //Notify the page of a send.
        $(document).trigger('sendMessage', [sendData]);
      },

      /**
       * Makes sure there is an autocomplete set up with the latest
       * store data.
       */
      updateAutoComplete: function () {
        var toNode = $('[name="to"]', this.bodyNode)[0],
            contacts = this.svc.getContacts(store),
            acdata;

        acdata = {
          domain: this.svcAccount.domain,
          contacts: contacts
        };

        if (!contacts) {
          contacts = {};
        }

        if (!this.svc.autoCompleteWidget) {
          this.svc.autoCompleteWidget = new AutoComplete(toNode);
        }

        dispatch.pub('autoCompleteData', acdata);
      },

      /**
       * Use store to save gmail contacts, but fetch from API
       * server if there is no store copy.
       */
      storeContacts: function () {
        var contacts = this.svc.getContacts(store);
        if (!contacts) {
          rdapi('contacts/' + this.svcAccount.domain, {
            type: 'POST',
            data: {
              username: this.svcAccount.username,
              userid: this.svcAccount.userid,
              startindex: 0,
              maxresults: 500
            },
            success: fn.bind(this, function (json) {
              //Transform data to a form usable by autocomplete.
              if (json && !json.error) {
                var entries = json.result.entry,
                    data = [];

                data = this.svc.getFormattedContacts(entries);

                this.svc.setContacts(store, data);
                this.updateAutoComplete(this.svcAccount.domain);
              }
            })
          });
        } else {
          //This function could be called before window is loaded, or after. In
          //either case, make sure to let the chrome know about it, since chrome
          //listens after the page is loaded (not after just DOM ready)
          this.updateAutoComplete(this.svcAccount.domain);
          //$(window).bind('load', updateAutoComplete);
        }
      }


    };
  });
});
