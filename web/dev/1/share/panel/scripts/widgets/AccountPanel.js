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
         'require', 'AutoComplete', 'rdapi', 'blade/fn', './jigFuncs', 'Select',
         'jquery.textOverflow'],
function (object,         Widget,         $,        template,
          TextCounter,   storage,   module,   placeholder,   dispatch,   accounts,
          require,   AutoComplete,   rdapi,   fn,         jigFuncs,     Select) {

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

      // The module name for the Contacts module
      contactsName: 'Contacts',

      strings: {
        shareTypeLabel: 'send to'
      },

      onCreate: function () {
        var profile = this.account.profile,
            name = profile.displayName,
            userName, savedOptions;

        //Set up the svcAccount property
        this.svcAccount = profile.accounts[0];
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
        this.photo = profile.photos && profile.photos[0] && profile.photos[0].value;

        //Set up nicer display name
        // XXX for email services, we should show the email account, but we
        // cannot rely on userid being a 'pretty' name we can display
        userName = this.svcAccount.username;
        if (userName && userName !== name) {
          name = name + " (" + userName + ")";
        }

        this.displayName = name;

        // Figure out what module will handle contacts.
        this.contactsName = (this.svc.overlays &&
                                this.svc.overlays[this.contactsName]) ||
                                this.contactsName;

        //Listen for options changes and update the account.
        this.optionsChangedSub = dispatch.sub('optionsChanged', fn.bind(this, function (options) {
          this.options = options;
          this.optionsChanged();
        }));

        //Listen for updates to base64Preview
        this.base64PreviewSub = dispatch.sub('base64Preview', fn.bind(this, function (dataUrl) {
          $('[name="picture_base64"]', this.bodyNode).val(jigFuncs.rawBase64(dataUrl));
        }));

        // listen for successful send, and if so, update contacts list, if
        // the send matches this account.
        this.sendCompleteSub = dispatch.sub('sendComplete', fn.bind(this, function (data) {
          var acct = this.svcAccount;
          if (data.to && acct.domain === data.domain &&
              acct.userid === data.userid &&
              acct.username === data.username) {
            this.contacts.incorporate(data.to);
          }
        }));
      },

      destroy: function () {
        dispatch.unsub(this.optionsChangedSub);
        dispatch.unsub(this.base64PreviewSub);
        dispatch.unsub(this.sendCompleteSub);
        this.select.dom.unbind('change', this.selectChangeFunc);
        delete this.selectChangeFunc;
        this.select.destroy();
        this.select = null;
        parent(this, 'destroy');
      },

      onRender: function () {
        var i, tempNode, acNode;

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
            value: this.options.shareType,
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

          // Update the display that is linked to the select.
          if (this.options.shareType) {
            this.changeShareType(this.getShareType(this.options.shareType));
          }
        }

        if (this.svc.textLimit) {
          this.startCounter();
        }
        placeholder(this.bodyNode);

        // Set up autocomplete and contacts used for autocomplete.
        // Since contacts can have a different
        // format/display per service, allow for service overrides.
        acNode = $('[name="to"]', this.bodyNode)[0];
        if (acNode) {
          require([this.contactsName], fn.bind(this, function (Contacts) {
            this.contacts = new Contacts(this.svc, this.svcAccount);
            this.autoComplete = new AutoComplete(acNode, this.contacts);
          }));
        }

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
        return data.link !== jigFuncs.link(this.options) ||
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
        if (this.svc.textLimit) {
          root.find('.counter').html('');
        }

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
        this.updateCounter();
      },

      updateCounter: function () {
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
            oldData;

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
        root.find('[name="medium"]').val(opts.medium);
        root.find('[name="source"]').val(opts.source);

        //Only set share types if they are available for this type of account.
        if (this.select) {

          if (opts.shareType) {
            this.select.val(opts.shareType);
            this.changeShareType(this.getShareType(opts.shareType));
          } else {
            this.selectFirstShareType();
          }
        }

        root.find('[name="to"]').val(opts.to);
        root.find('[name="subject"]').val(opts.subject);
        root.find('[name="message"]').val(opts.message);

        // update text limit for the text counter, if enabled.
        if (this.counter) {
          this.updateCounter();
        }

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

      onSubmit: function (evt) {
        //Do not submit the form as-is.
        evt.preventDefault();

        //Make sure all form elements are trimmed and username exists.
        //Then collect the form values into the data object.
        var sendData = this.getFormData();

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
          sendData.to = this.contacts.convert(sendData.to);
        }

        //Notify the page of a send.
        dispatch.pub('sendMessage', sendData);
      }
    };
  });
});
