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

/*jslint indent: 2, plusplus: false, nomen: false */
/*global define: false, document: false */
"use strict";

define([ 'blade/object', 'blade/Widget', 'jquery', 'text!./AccountPanel.html',
         'TextCounter', 'storage', 'module', 'placeholder', 'dispatch', 'accounts',
         'AutoComplete', 'rdapi', 'blade/fn', './jigFuncs', 'Select',
         'jquery.textOverflow'],
function (object,         Widget,         $,        template,
          TextCounter,   storage,   module,   placeholder,   dispatch,   accounts,
          AutoComplete,   rdapi,   fn,         jigFuncs,     Select) {

  var store = storage(),
      className = module.id.replace(/\//g, '-');

  //Set up event handlers.
  $(function () {
    $('body')
      .delegate('.' + className + ' form.messageForm', 'submit', function (evt) {
        Widget.closest(module.id, evt, 'onSubmit');
      })
      .delegate('.' + className + ' .shareType2', 'click', function (evt) {
        Widget.closest(module.id, evt, 'selectSecondShareType');
        evt.preventDefault();
      });
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

      strings: {
        shareTypeLabel: 'send to'
      },

      onCreate: function () {
        var name = this.account.displayName,
            userName, savedOptions;

        //Set up the svcAccount property
        this.svcAccount = this.account.accounts[0];
        this.storeId = 'AccountPanel-' + this.svcAccount.domain;

        //Set up memory store for when user switches tabs, their messages for
        //old URLs is retained in case they are doing a composition.
        //This needs to be in onCreate and not
        //on the prototype since each instance should get its own object.
        this.memStore = {};

        //Check for saved data. Only use if the URL
        //and the account match
        savedOptions = store[this.storeId];
        if (savedOptions) {
          savedOptions = JSON.parse(savedOptions);
          if (this.theGameHasChanged(savedOptions)) {
            this.clearSavedData();
            savedOptions = null;
          } else {
            //Mix in the savedOptions with options.
            this.options = object.create(this.options, [savedOptions]);
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

        //Listen for options changes and update the account.
        this.optionsChangedSub = dispatch.sub('optionsChanged', fn.bind(this, function (options) {
          this.options = options;
          this.optionsChanged();
        }));

        //Listen for updates to base63Preview
        this.base64PreviewSub = dispatch.sub('base64Preview', function (dataUrl) {
          $('[name="picture_base64"]', this.bodyNode).val(jigFuncs.rawBase64(dataUrl));
        });
      },

      destroy: function () {
        dispatch.unsub(this.optionsChangedSub);
        dispatch.unsub(this.base64PreviewSub);
        this.select.dom.unbind('change', this.selectChangeFunc);
        delete this.selectChangeFunc;
        this.select.destroy();
        this.select = null;
        parent(this, 'destroy');
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

        if (this.svc.shareTypes.length > 1) {
          //Insert a Select widget if it is desired.
          this.select = new Select({
            name: 'shareType',
            options: this.svc.shareTypes.map(function (item) {
                      return {
                        name: item.name,
                        value: item.type
                      };
                    })
          }, $('.shareTypeSelectSection', this.bodyNode)[0]);

          // Listen to changes in the Select
          this.selectChangeFunc = fn.bind(this, function (evt) {
            this.onShareTypeChange(evt);
          });
          this.select.dom.bind('change', this.selectChangeFunc);
        }

        if (this.svc.textLimit) {
          this.startCounter();
        }
        placeholder(this.bodyNode);

        this.storeContacts();

        //Create ellipsis for anything wanting ... overflow
        $(".overflow", this.node).textOverflow();
      },

      //Tron Legacy soundtrack anyone?
      theGameHasChanged: function (data) {
        //If the account/url has changed the data should no
        //longer be tracked.
        //Convert svcAccount fields to strings because the
        //form data will be in strings, even though the
        //account data can have things like integers, and want
        //string equality operators to stay for linting.
        return data.link !== this.options.url ||
              data.userid !== String(this.svcAccount.userid) ||
              data.domain !== String(this.svcAccount.domain) ||
              data.username !== String(this.svcAccount.username);
      },

      clearSavedData: function () {
        this.memStore = {};
        delete store[this.storeId];

        //Also clear up the form data.
        var root = $(this.bodyNode);
        root.find('[name="to"]').val('');
        root.find('[name="subject"]').val('');
        root.find('[name="message"]').val('');
        placeholder(this.bodyNode);
      },

      saveData: function () {
        var data = this.getFormData();
        store[this.storeId] = JSON.stringify(data);
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

      //The page options have changed, update the relevant HTML bits.
      optionsChanged: function () {
        var root = $(this.bodyNode),
            opts = this.options,
            formLink = jigFuncs.link(opts),
            restoredData = this.memStore[formLink],
            oldData, shareTypeDom;

        //Save off previous form data for old URL.
        oldData = this.getFormData();
        if (oldData.to || oldData.message || oldData.subject) {
          this.memStore[oldData.link] = oldData;
        }

        //Delete memory data for current URL if the account changed.
        if (restoredData && this.theGameHasChanged(restoredData)) {
          restoredData = null;
          delete this.memStore[formLink];
        }

        //Mix in any saved data for the new URL if it was in storage.
        if (restoredData) {
          //Create a temp object so we do not mess with pristine options.
          opts = object.create(opts, [{
            to: restoredData.to,
            subject: restoredData.subject,
            message: restoredData.message,
            shareType: restoredData.shareType
          }]);
        }

        //Update the DOM.
        root.find('[name="picture"]').val(jigFuncs.preview(opts));
        root.find('[name="picture_base64"]').val(jigFuncs.preview_base64(opts));
        root.find('[name="link"]').val(formLink);
        root.find('[name="title"]').val(opts.title);
        root.find('[name="caption"]').val(opts.caption);
        root.find('[name="description"]').val(opts.description);

        //Only set share types if they are available for this type of account.
        shareTypeDom = root.find('[name="shareType"]');
        if (shareTypeDom.length) {
          if (opts.shareType) {
            shareTypeDom.val(opts.shareType);
            this.changeShareType(this.getShareType(opts.shareType));
          } else {
            this.selectFirstShareType();
          }
        }

        root.find('[name="to"]').val(opts.to);
        root.find('[name="subject"]').val(opts.subject);
        root.find('[name="message"]').val(opts.message);

        //Kick the placeholder logic to recompute, to avoid gray text issues.
        placeholder(this.bodyNode);
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

      getShareType: function (shareTypeValue) {
        for (var i = 0, item; (item = this.svc.shareTypes[i]); i++) {
          if (item.type === shareTypeValue) {
            return item;
          }
        }
        return null;
      },

      selectFirstShareType: function () {
        this.select.selectIndex(0);
        this.changeShareType(this.svc.shareTypes[0]);
      },

      selectSecondShareType: function () {
        this.select.selectIndex(1);
        this.changeShareType(this.svc.shareTypes[1]);
      },

      changeShareType: function (shareType) {
        var toSectionDom = $('.toSection', this.bodyNode),
            shareTypeSectionDom = $('.shareTypeSelectSection', this.bodyNode),
            shareType2Dom = $('.shareType2', this.bodyNode),
            toInputDom = $('.toSection input', this.bodyNode);

        //If there is a special to value (like linkedin my connections), drop it in
        toInputDom.val(shareType.specialTo ? shareType.specialTo : '');
        placeholder(toInputDom[0]);

        if (shareType.showTo) {
          toSectionDom.removeClass('hiddenImportant');
          shareTypeSectionDom.addClass('fixedSize');
          shareType2Dom.addClass('hiddenImportant');
          toInputDom.focus();
        } else {
          toSectionDom.addClass('hiddenImportant');
          shareTypeSectionDom.removeClass('fixedSize');
          shareType2Dom.removeClass('hiddenImportant');
        }
      },

      onShareTypeChange: function (evt) {
        var shareType = this.getShareType(this.select.val());
        this.changeShareType(shareType);
      },

      _findContact: function (to, contacts) {
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

      onSubmit: function (evt) {
        //Do not submit the form as-is.
        evt.preventDefault();

        //Make sure all form elements are trimmed and username exists.
        //Then collect the form values into the data object.
        var sendData = this.getFormData(),
            contacts, newrecip, recip, acct, self;

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
            self = this;
            recip.forEach(function (to) {
              acct = self._findContact(to.trim(), contacts);
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
       * Use store to save contacts, but fetch from API
       * server if there is no store copy.
       */
      storeContacts: function () {
        var contacts = this.svc.getContacts(store),
            svcData;
        if (!contacts) {
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
