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
/*global define: false, location: true, window: false, alert: false,
  document: false, setTimeout: false, localStorage: false */
"use strict";

define([ "require", "jquery", "blade/fn", "rdapi", "oauth", "blade/jig", "blade/url",
         "placeholder", "TextCounter", "dispatch", "accounts",
         "storage", "services", "blade/object", "../settings/index",
         "jschannel",
         "jquery-ui-1.8.6.custom.min", "jquery.textOverflow"],
function (require,   $,        fn,         rdapi,   oauth,   jig,         url,
          placeholder,   TextCounter,   dispatch,   accounts,
          storage,   services,   object, settings,
          jschannel) {

  var result = {},
    actions = services.domains,
    options = {},
    showStatus,
    tabDom, bodyDom, clickBlockDom, timer,
    tabSelection, accountCache, showNew,
    sendData = {},
    store = storage();

  options.prefs = {}; // misplaced...
  result['options'] = options;


  result['bindAppService'] = function(loader) {
    // Bind the OWA messages
    // XXX - for debugging, when we load this up in a regular window...
    try {
      var chan = Channel.build({window: window.parent, origin: "*", scope: "openwebapps_conduit"});
      chan.bind("confirm", function(t, args) {
        // XXX - callers use of jschannel means errors here are silenced by
        // a later error caused by the error :)
        try {
          // don't return yet...
          t.delayReturn();
          var form = $("form[name=sendForm]")[0];
          submitForm(form);
        } catch (e) {
          console.log("Error submitting form: " + e);
          throw e;
        }
      });
      chan.bind("link.send", function(t, args) {
        options = args;
        // misplaced options stuff...
        options.prefs = {};
        options.prefs.system = 'prod';
        loader();
      });
    } catch(e) {
      // thrown by jschannel...
      if (e !== 'target window is same as present window -- not allowed') {
        throw e;
      }
      console.log("ignoring error setting up channel - hopefully you are debugging!");
      $(function () {loader();});
    }
  }

  function submitForm(form) {
    var svc, contacts, recip, acct, newrecip;
    //Make sure all form elements are trimmed and username exists.
    //Then collect the form values into the data object.
    sendData = {};
    $.each(form.elements, function (i, node) {
      var trimmed = node.value.trim();

      if (node.getAttribute("placeholder") === trimmed) {
        trimmed = "";
      }

      node.value = trimmed;

      if (node.value) {
        sendData[node.name] = node.value;
      }
    });
    svc = services.domains[sendData.domain];

    if (options.shortUrl) {
      sendData.shorturl = options.shortUrl;
    } else if (svc.shorten) {
      sendData.shorten = true;
    }

    var selectShareType = $("#selectShareType")[0]; // WTF - isn't this a single-select???
    sendData.shareType = selectShareType.options[selectShareType.selectedIndex].value;
    // fixup to addressing if necessary
    if (sendData.to) {
      contacts = svc.getContacts(store);
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

    sendMessage();
    return false;
  }

  //Add some old methods to services.
  object.mixin(services.svcBaseProto, {
    validate: function (sendData) {
      if (this.counter) {
        return !this.counter || !this.counter.isOver();
      }
      return true;
    },
    startCounter: function (data) {
      if (this.textLimit < 1) {
        return;
      }
      //Set up text counter
      if (!this.counter) {
        this.counter = new TextCounter($('#' + this.type + ' textarea.message'),
                                       $('#' + this.type + ' .counter'),
                                       this.textLimit - urlSize);
      }
      // Update counter. If using a short url from the web page itself, it could
      // potentially be a different length than a bit.ly url so account for
      // that. The + 1 is to account for a space before adding the URL to the
      // tweet.
      this.counter.updateLimit(data.shortUrl ?
                               (this.textLimit - (data.shortUrl.length + 1)) :
                               this.textLimit - urlSize);
    },
    getFormData: function () {
      var dom = $('#' + this.type);
      return {
        to: dom.find('[name="to"]').val().trim() || '',
        subject: dom.find('[name="subject"]').val().trim() || '',
        message: dom.find('textarea.message').val().trim() || '',
        picture: dom.find('[name="picture"]').val().trim() || '',
        canonicalUrl: dom.find('[name="link"]').val().trim() || '',
        title: dom.find('[name="title"]').val().trim() || '',
        description: dom.find('[name="description"]').val().trim() || '',
        shortUrl: (dom.find('[name="surl"]').val() || "").trim()
      };
    },
    setFormData: function (data) {
      var dom = $('#' + this.type),
          picture;

      if (data.to) {
        dom.find('[name="to"]').val(data.to);
      }
      if (data.subject) {
        dom.find('[name="subject"]').val(data.subject);
      }
      if (data.message) {
        dom.find('textarea.message').val(data.message);
      }
      if (data.previews && data.previews.length) {
        dom.find('[name="picture"]').val(data.previews[0]);
      }
      if (data.canonicalUrl || data.url) {
        dom.find('[name="link"]').val(data.canonicalUrl || data.url);
      }
      if (data.title) {
        dom.find('[name="title"]').val(data.title);
      }
      if (data.description) {
        dom.find('[name="description"]').val(data.description);
      }
      if (data.shortUrl) {
        dom.find('[name="surl"]').val(data.shortUrl);
      }
      this.startCounter(data);
    }
  });

  jig.addFn({
    profilePic: function (photos) {
      //TODO: check for a thumbnail picture, hopefully one that is square.
      return photos && photos[0] && photos[0].value || 'i/face2.png';
    },
    serviceName: function (domain) {
      return actions[domain].name;
    }
  });

  function escapeHtml(text) {
    return text ? text.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : text;
  }

  showStatus = function (statusId, shouldCloseOrMessage) {
    $('div.status').addClass('hidden');
    clickBlockDom.removeClass('hidden');
    $('#' + statusId).removeClass('hidden');

    if (shouldCloseOrMessage === true) {
      setTimeout(function () {
        dispatch.pub('success', {
          domain: sendData.domain,
          username: sendData.username,
          userid: sendData.userid
        });
      }, 2000);
    } else if (shouldCloseOrMessage) {
      $('#' + statusId + 'Message').text(shouldCloseOrMessage);
    }
  };

  //Make it globally visible for debug purposes
  window.showStatus = showStatus;

  function cancelStatus() {
    clickBlockDom.addClass('hidden');
    $('div.status').addClass('hidden');
    //Be sure form field placeholders are up to date.
    placeholder();
  }

  function showStatusShared() {
    var sendDomain = sendData.domain,
        siteName = options.siteName,
        url = options.url || "",
        doubleSlashIndex = url.indexOf("//") + 2;
    $('#statusShared').empty().append(jig('#sharedTemplate', {
      domain: siteName || url.slice(doubleSlashIndex, url.indexOf("/", doubleSlashIndex)),
      service: actions[sendDomain].name,
      href: actions[sendDomain].serviceUrl
    })).find('.shareTitle').textOverflow(null, true);
    showStatus('statusShared', true);
  }
  //Make it globally visible for debug purposes
  window.showStatusShared = showStatusShared;

  function reAuth() {
    //First, save form state so their message can be recovered after
    //binding accounts.
    var data = {
      "link": sendData.link,
      "domain": sendData.domain,
      "formData": actions[sendData.domain].getFormData()
    };
    store.sessionRestore = JSON.stringify(data);
    showStatus('statusAuth');
  }

  function sendMessage() {
    showStatus('statusSharing');

    //Allow for data validation before sending.
    if (!actions[sendData.domain].validate(sendData)) {
      showStatus('statusToError');
      return;
    }

    var svcData = accounts.getService(sendData.domain, sendData.userid, sendData.username);
    sendData.account = JSON.stringify(svcData);

    rdapi('send', {
      type: 'POST',
      data: sendData,
      success: function (json) {
        // {'message': u'Status is a duplicate.', 'provider': u'twitter.com'}
        if (json.error && json.error.status) {
          var code = json.error.status;
          // XXX need to find out what error codes everyone uses
          // oauth+smtp will return a 535 on authentication failure
          if (code ===  401 || code === 535) {
            reAuth();
          } else {
            showStatus('statusError', json.error.message);
          }
        } else if (json.error) {
          showStatus('statusError', json.error.message);
        } else {
          showStatusShared();
        }

        //Be sure to delete sessionRestore data
        delete store.sessionRestore;
      },
      error: function (xhr, textStatus, err) {
        if (xhr.status === 403) {
          //header error will be "CSRF" if missing CSRF token. This usually
          //means we lost all our cookies, or the server lost our session.
          //We could get more granular, to try to distinguish CSRF missing
          //token from just missing other cookine info, but in practice,
          //it is hard to see how that might happen -- either all the cookies
          //are gone or they are all there.
          //var headerError = xhr.getResponseHeader('X-Error');
          reAuth();
        } else if (xhr.status === 503) {
          showStatus('statusServerBusy');
        } else {
          showStatus('statusError', err);
        }
      }
    });
  }

  /**
   * Makes sure there is an autocomplete set up with the latest
   * store data.
   */
  function updateAutoComplete(serviceName) {
    var svc = services.domains[serviceName],
        toNode = $('#' + svc.type).find('[name="to"]')[0],
        contacts = svc.getContacts(store),
        acdata;
    if (!contacts) {
      contacts = [];
    }

    //Autocomplete data for old extension is just an array. So it can only
    //have one list, not a list per service. Too bad, but will just have
    //to live with it until this UI is retired. So only do this if the
    //domain is gmail, just trying to pick a common default one.
    if (serviceName === 'google.com') {
      dispatch.pub('autoCompleteData', contacts);
    }
  }

  /**
   * Use store to save gmail contacts, but fetch from API
   * server if there is no store copy.
   */
  function storeContacts(serviceName, account) {
    var svcAccount = account,
        svc = services.domains[svcAccount.domain],
        contacts = svc.getContacts(store),
        svcData;
    if (!contacts) {
      svcData = accounts.getService(svcAccount.domain, svcAccount.userid, svcAccount.username);
      rdapi('contacts/' + svcAccount.domain, {
        type: 'POST',
        data: {
          username: svcAccount.username,
          userid: svcAccount.userid,
          startindex: 0,
          maxresults: 500,
          account: JSON.stringify(svcData)
        },
        success: function (json) {
          //Transform data to a form usable by autocomplete.
          if (json && !json.error) {
            var entries = json.result.entry,
                data = [];

            data = svc.get36FormattedContacts(entries);
            svc.setContacts(store, data);
            updateAutoComplete(svcAccount.domain);
          }
        }
      });
    } else {
      //This function could be called before window is loaded, or after. In
      //either case, make sure to let the chrome know about it, since chrome
      //listens after the page is loaded (not after just DOM ready)
      updateAutoComplete(svcAccount.domain);
      //$(window).bind('load', updateAutoComplete);
    }
  }

  function updateAccounts(accounts, thisDomain) {
    var userAccounts = {}, selection,
        sessionRestore = store.sessionRestore,
        act;

    var actob = null;
    // find the account we need.
    if (accounts && accounts.length) {
      accounts.forEach(function (account) {
        var name = account.domain;
        if (name && actions[name] && name==thisDomain) {
          actob = account;
          return;
        }
      });
    }
    if (actob) {
        updateAccountDisplay(act, actob);
        storeContacts(act, actob);
      // show the send form.
      selection = "#sendDiv";
      $("#tabs").tabs('select', selection);
    }
    return !!actob;
  }

  function updateAccountDisplay(service, account) {
    $(function () {
      // XXX - what happened to displayName???
      var name = (account.profile ? account.profile.displayName : '') || '',
        svcAccount = account,
        photo = account.profile && account.profile.photos &&
                account.profile.photos[0] && account.profile.photos[0].value,
        serviceDom = $('#sendDiv'),
        username;

      // XXX for email services, we should show the email account, but we
      // cannot rely on userid being a 'pretty' name we can display
      username = svcAccount.username;
      if (username && username !== name) {
        name = name + " <" + username + ">";
      }

      //Add the tab as an option
//      $('.' + service + 'Tab').removeClass('hidden');

      if (name) {
        $(".user-info .username").text(name);
      }
      if (photo) {
        serviceDom.find('.avatar').attr('src', photo);
        $(".user-info .avatar").attr('src', photo);
      }

      serviceDom.find('input[name="userid"]').val(svcAccount.userid);
      serviceDom.find('input[name="username"]').val(svcAccount.username);
      serviceDom.find('div.user').removeClass('inactive');
    });
  }

  result['setupCommonUI'] = function(thisDomain) {
    var thumbImgDom,
      sessionRestore = store.sessionRestore,
      tabSelectionDom, tabhtml = '', panelhtml = '',
      svc, url;

    thumbImgDom = $('img.thumb');
    tabDom = $('#shareTabs');
    bodyDom = $('body');
    clickBlockDom = $('#clickBlock');

    //Set the type of system as a class on the UI to show/hide things in
    //dev vs. production
    if (options.prefs.system) {
      $(document.documentElement).addClass(options.prefs.system);
    }

    //Debug info on the data that was received.
    if (options.prefs.system === 'dev') {
      $('#debugOutput').val(JSON.stringify(options));
      $('#debugCurrentLocation').val(location.href);
    }

    //Hook up button for share history
    bodyDom
      .delegate('#statusAuthButton, .statusErrorButton', 'click', function (evt) {
        cancelStatus();
      })
      .delegate('.statusErrorCloseButton', 'click', function (evt) {
        close();
      })
      .delegate('.statusResetErrorButton', 'click', function (evt) {
        location.reload();
      })
      .delegate('.nav .close', 'click', close);

    $('#authOkButton').click(function (evt) {
      oauth(sendData.domain, false, function (success) {
        if (success) {
          accounts.clear();
          accounts();
        } else {
          showStatus('statusOAuthFailed');
        }
      });
    });

    //Set up default handler for account changes triggered from other
    //windows, or updates to expired cache.
    accounts.onChange();

    //Only bother with localStorage enabled storage.
    if (storage.type === 'memory') {
      showStatus('statusEnableLocalStorage');
      return;
    }

    //Fetch the accounts.
    accounts(function (json) {
        accountCache = json;

        tabSelection = "#sendDiv";
        if (updateAccounts(accountCache, thisDomain)) {
          //Set up HTML so initial jquery UI tabs will not flash away from the selected
          //tab as we show it. Done for performance and to remove a flash of tab content
          //that is not the current tab.
//          $('.' + tabSelection.slice(1) + 'Tab').addClass('ui-tabs-selected ui-state-active');
          tabSelectionDom = $(tabSelection);
          tabSelectionDom.removeClass('ui-tabs-hide');

          //Set up jQuery UI tabs.
          tabDom.tabs({ fx: { opacity: 'toggle', duration: 100 } });
          //Make the tabs visible now to the user, now that tabs have been set up.
          tabDom.removeClass('invisible');
          bodyDom.removeClass('loading');
        } else {
          showStatus('statusSettings');
        }
      },
      //Error handler for account fetch
      function (xhr, textStatus, err) {
        if (xhr.status === 503) {
          showStatus('statusServerBusyClose');
        } else {
          showStatus('statusServerError', err);
        }
      }
    );

    //If the message containder doesn't want URLs then respect that.
    //However, skip this if session restore is involved.
    if (sessionRestore) {
      sessionRestore = JSON.parse(sessionRestore);
    }

    //For the title in facebook/subject in email, set it to the page title
    if (options.title) {
      $('.title').text(options.title);
    }

    //For pages with built in descriptions add that to the meta information
    if (options.description) {
      $('.description').text(options.description);
    }

    //Set preview image for facebook
    if (options.previews && options.previews.length) {
      //TODO: set up all the image previews.
      // XXX: we might not want to default to the base64 as that won't be sent/used by Facebook
      url = escapeHtml(options.previews[0]);
      thumbImgDom.attr('src', url);
    } else if (options.thumbnail) {
      thumbImgDom.attr('src', escapeHtml(options.thumbnail));
    }

    //Create ellipsis for thumbnail section
    //$('.title').textOverflow(null, true);
    //$('.description').textOverflow(null, true);
    //$('.url').textOverflow(null, true);
    //$('.surl').textOverflow(null, true);
  };

  return result;
});
