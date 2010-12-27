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
/*global require: false, location: true, window: false, alert: false,
  document: false, setTimeout: false, localStorage: false */
"use strict";

require.def("index",
        ["require", "jquery", "blade/fn", "rdapi", "oauth", "blade/jig", "blade/url",
         "placeholder", "TextCounter", "AutoComplete", "dispatch", "accounts",
         "storage", "services",
         "jquery-ui-1.8.6.custom.min", "jquery.textOverflow"],
function (require,   $,        fn,         rdapi,   oauth,   jig,         url,
          placeholder,   TextCounter,   AutoComplete,   dispatch,   accounts,
          storage,   services) {

  var showStatus,
    actions = services.domains,
    hash = location.href.split('#')[1],
    urlArgs, sendData, prop,
    options = {},
    tabDom, bodyDom, clickBlockDom, twitterCounter, timer,
    updateTab = true, tabSelection, accountCache, showNew,
    gmailDom, yahooDom, linkedinDom, autoCompleteWidget, store = storage();

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

  function close() {
    dispatch.pub('hide');
  }
  //For debug tab purpose, make it global.
  window.closeShare = close;

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
    var sendDomain = (sendData && sendData.domain) || 'twitter.com',
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

  function handleCaptcha(detail, error) {
    $('#captchaImage').attr('src', detail.imageurl);
    if (error) {
      $('#captchaMsg').text(error.message);
    }
    $('#captchaSound').attr('src', detail.audiourl);
    showStatus('statusCaptcha', false);
  }
  window.handleCaptcha = handleCaptcha;

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
      return;
    }

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
          } else if (json.error.code === 'Client.HumanVerificationRequired') {
            handleCaptcha(json.error.detail);
          } else if (json.error.code === 'Client.WrongInput') {
            handleCaptcha(json.error.detail, json.error);
          } else {
            showStatus('statusError', json.error.message);
          }
        } else if (json.error) {
          showStatus('statusError', json.error.message);
        } else {
          store.lastSelection = actions[sendData.domain].type;
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
  function updateAutoComplete() {
    var toNode = gmailDom.find('[name="to"]')[0],
        data = store.gmailContacts;

    if (data) {
      data = JSON.parse(data);
    } else {
      data = [];
    }

    if (!autoCompleteWidget) {
      autoCompleteWidget = new AutoComplete(toNode);
    }

    dispatch.pub('autoCompleteData', data);
  }

  /**
   * Use store to save gmail contacts, but fetch from API
   * server if there is no store copy.
   */
  function storeGmailContacts(account) {
    if (!store.gmailContacts) {
      var svcAccount = account.accounts[0];

      rdapi('contacts/' + svcAccount.domain, {
        type: 'POST',
        data: {
          username: svcAccount.username,
          userid: svcAccount.userid,
          startindex: 0,
          maxresults: 500
        },
        success: function (json) {
          //Transform data to a form usable by autocomplete.
          if (json && !json.error) {
            var entries = json.result.entry,
                data = [];

            entries.forEach(function (entry) {
              if (entry.emails && entry.emails.length) {
                entry.emails.forEach(function (email) {
                  data.push({
                    displayName: entry.displayName,
                    email: email.value
                  });
                });
              }
            });

            store.gmailContacts = JSON.stringify(data);
            updateAutoComplete();
          }
        }
      });
    } else {
      //This function could be called before window is loaded, or after. In
      //either case, make sure to let the chrome know about it, since chrome
      //listens after the page is loaded (not after just DOM ready)
      updateAutoComplete();
      $(window).bind('load', updateAutoComplete);
    }
  }

  function updateUserTab(evt, ui) {
    var imageUrl = '',
      userName = '',
      inactive = true,
      domain = '',
      id = ui.panel.id,
      userInfoDom = $(".user-info");

    if (id !== 'debug') {
      imageUrl = $(ui.panel).find("div.user img.avatar").attr("src");
      userName = $(ui.panel).find("div.user .username").text();
      inactive = $(ui.panel).find("div.user").hasClass("inactive");
      domain   = $(ui.panel).find("div.user input[type='hidden'][name='domain']").val();
    }
    $(".user-info img.avatar").attr("src", imageUrl);
    if (!imageUrl) {
      userInfoDom.hide();
    } else {
      userInfoDom.show();
    }
    $(".user-info .status").toggleClass("inactive", inactive);
    $(".user-info .username").text(userName);
    $(".user-info").attr("data-domain", domain);
  }

  function updateAccountDisplay(service, account) {
    $(function () {
      var name = account.displayName,
        svcAccount = account.accounts[0],
        photo = account.photos && account.photos[0] && account.photos[0].value,
        serviceDom = $('#' + service);

      //Add the tab as an option
      $('.' + service + 'Tab').removeClass('hidden');

      if (name) {
        serviceDom.find('.username').text(name);
      }
      if (photo) {
        serviceDom.find('.avatar').attr('src', photo);
      }

      serviceDom.find('input[name="userid"]').val(svcAccount.userid);
      serviceDom.find('input[name="username"]').val(svcAccount.username);
      serviceDom.find('div.user').removeClass('inactive');
    });
  }

  function determineTab() {
    var selection, selectionName, name;

    if (store.lastSelection) {
      selection = '#' + store.lastSelection;
    } else {
      if (accountCache && accountCache.length) {
        name = accountCache[0].accounts[0].domain;
        if (actions[name]) {
          selectionName = actions[name].type;
          if (selectionName) {
            selection = '#' + selectionName;
          }
        }
      }
    }

    return selection;
  }

  function updateFirstLastTab() {
    //Apply first and end classes to whatever tabs are shown.
    $('.ui-tabs-nav > li')
      //Reset the tabs
      .removeClass('first')
      .removeClass('last')
      //Only grab non-hidden tabs.
      .filter(function (i) {
        var tab = $(this),
            hidden = tab.hasClass('hidden'),
            debugTab = tab.hasClass('debugTab');
        return !hidden && !debugTab;
      })
      //Apply the new first and last
      .first().addClass('first').end()
      .last().addClass('last');
  }

  function updateAccounts(accounts) {
    var hasLastSelectionMatch = false,
        userAccounts = {}, selection,
        sessionRestore = store.sessionRestore;

    if ((accounts && accounts.length)) {
      //Figure out what accounts we do have
      accounts.forEach(function (account) {
        var name = account.accounts[0].domain;
        if (name && actions[name]) {
          //Make sure to see if there is a match for last selection
          if (!hasLastSelectionMatch) {
            hasLastSelectionMatch = actions[name].type === store.lastSelection;
          }
          name = name.split('.');
          name = name[name.length - 2];
          if (name === 'google') {
            name = 'gmail';
          }
          userAccounts[name] = account;
        }
      });
    }

    //If no matching accounts match the last selection clear it.
    if (!hasLastSelectionMatch && !store.accountAdded && store.lastSelection) {
      delete store.lastSelection;
    }

    //Reset the just added state now that accounts have been configured one time.
    if (store.accountAdded) {
      delete store.accountAdded;
    }

    for (var act in userAccounts) {
      updateAccountDisplay(act, userAccounts[act]);
    }

    if (userAccounts.gmail) {
      //Make sure we have contacts for auto-complete
      storeGmailContacts(userAccounts.gmail);
    } else {
      //Make sure there is no cached data hanging around.
      if (store.gmailContacts) {
        delete store.gmailContacts;
        updateAutoComplete();
      }
    }

    //Session restore, do after form setting above.
    if (sessionRestore) {
      sessionRestore = JSON.parse(sessionRestore);

      //If this share is for a different URL, dump the sessionRestore
      if (options.link !== sessionRestore.link) {
        sessionRestore = null;
        delete store.sessionRestore;
      }

      if (sessionRestore) {
        actions[sessionRestore.domain].restoreFormData(sessionRestore.formData);
        //Make sure placeholder text is updated.
        placeholder();
      }
    }

    if (updateTab) {
      //Choose a tab to show.
      selection = determineTab();
      tabDom.tabs('select', selection);

      //Update the profile pic/account name text for the tab.
      updateUserTab(null, {panel: $(selection)[0]});
    }

    updateFirstLastTab();
  }

  if (hash) {
    urlArgs = url.queryToObject(hash);
    if (urlArgs.options) {
      options = JSON.parse(urlArgs.options);
    }
  }
  options.prefs = options.prefs || {};
  if (!options.title) {
    options.title = options.url;
  }
  if (!options.prefs.system) {
    options.prefs.system = 'prod';
  }

  //Save the extension version in the localStorage, for use in
  //other pages like settings.
  if (options.version) {
    store.extensionVersion = options.version;
  }

  //Save the preferences in localStorage, for use in
  //other ppages like setting.
  if (options.prefs) {
    for (prop in options.prefs) {
      if (options.prefs.hasOwnProperty(prop)) {
        store['prefs.' + prop] = options.prefs[prop];
      }
    }
  }

  //For the "new items" link, only show it for x number of days after showing it.
  //NOTE: when updating for newer releases, delete the old value from the
  //storage.
  timer = store.newTimerV2;
  if (!timer) {
    store.newTimerV1 = (new Date()).getTime();
    showNew = true;
  } else {
    timer = JSON.parse(timer);
    //If time since first seen is greater than three days, hide the new link.
    if ((new Date()).getTime() - timer < (3 * 24 * 60 * 60 * 1000)) {
      showNew = true;
    }
  }

  $(function () {
    var thumbImgDom = $('img.thumb'),
      facebookDom = $('#facebook'),
      twitterDom = $('#twitter'),
      appsDom = $('#googleapps'),
      picture,
      sessionRestore = store.sessionRestore,
      tabSelectionDom;

    bodyDom = $('body');
    clickBlockDom = $('#clickBlock');
    gmailDom = $('#gmail');
    yahooDom = $('#yahoo');
    linkedinDom = $('#linkedin');

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

    //Show the new link if appropriate.
    if (showNew) {
      $('#newLink').removeClass('hidden');
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
      oauth(sendData.domain, function (success) {
        if (success) {
          accounts.clear();
          accounts();
        } else {
          showStatus('statusOAuthFailed');
        }
      });
    });

    $('#captchaButton').click(function (evt) {
      cancelStatus();
      clickBlockDom.removeClass('hidden');
      sendData.HumanVerification = $('#captcha').attr('value');
      sendData.HumanVerificationImage = $('#captchaImage').attr('src');
      sendMessage();
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

        //No need to update tab since that will be done inline below.
        updateTab = false;
        updateAccounts(accountCache);
        updateTab = true;

        tabSelection = determineTab();

        //Set up HTML so initial jquery UI tabs will not flash away from the selected
        //tab as we show it. Done for performance and to remove a flash of tab content
        //that is not the current tab.
        if (tabSelection) {
          $('.' + tabSelection.slice(1) + 'Tab').addClass('ui-tabs-selected ui-state-active');
          tabSelectionDom = $(tabSelection);
          tabSelectionDom.removeClass('ui-tabs-hide');

          //Update the profile pic/account name text for the tab.
          updateUserTab(null, {panel: tabSelectionDom[0]});

          //Set up jQuery UI tabs.
          tabDom = $("#tabs");
          tabDom.tabs({ fx: { opacity: 'toggle', duration: 100 } });
          tabDom.bind("tabsselect", updateUserTab);
          //Make the tabs visible now to the user, now that tabs have been set up.
          tabDom.removeClass('invisible');
          bodyDom.removeClass('loading');

          //Make sure first/last tab styles are set up accordingly.
          updateFirstLastTab();
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

    //Set up hidden form fields for facebook
    //TODO: try sending data urls via options.thumbnail if no
    //previews?
    picture = options.previews && options.previews[0];
    if (picture) {
      facebookDom.find('[name="picture"]').val(picture);
      linkedinDom.find('[name="picture"]').val(picture);
    }

    //We default to using the canonical URL instead of the URL shown in the address
    //bar as this should be the better URL to share.
    //TODO: We might want to do some minimal checking of this URL in a future
    //UI so we warn people of a major difference and allow them to choose the URL
    if (options.canonicalUrl || options.url) {
      twitterDom.find('[name="link"]').val(options.canonicalUrl || options.url);
      facebookDom.find('[name="link"]').val(options.canonicalUrl || options.url);
      gmailDom.find('[name="link"]').val(options.canonicalUrl || options.url);
      yahooDom.find('[name="link"]').val(options.canonicalUrl || options.url);
      linkedinDom.find('[name="link"]').val(options.canonicalUrl || options.url);
      appsDom.find('[name="link"]').val(options.canonicalUrl || options.url);
    }

    if (options.title) {
      facebookDom.find('[name="name"]').val(options.title);
      gmailDom.find('[name="title"]').val(options.title);
      yahooDom.find('[name="title"]').val(options.title);
      linkedinDom.find('[name="title"]').val(options.title);
      appsDom.find('[name="title"]').val(options.title);
    }

    if (options.description) {
      facebookDom.find('[name="caption"]').val(options.description);
      gmailDom.find('[name="description"]').val(options.description);
      yahooDom.find('[name="description"]').val(options.description);
      linkedinDom.find('[name="description"]').val(options.description);
      appsDom.find('[name="description"]').val(options.description);
    }

    //If the message containder doesn't want URLs then respect that.
    //However, skip this if session restore is involved.
    if (sessionRestore) {
      sessionRestore = JSON.parse(sessionRestore);
    }

    //Set up twitter text counter
    if (!twitterCounter) {
      twitterCounter = new TextCounter($('#twitter textarea.message'), $('#twitter .counter'), 114);
    }

    //Update counter. If using a short url from the web page itself, it could potentially be a different
    //length than a bit.ly url so account for that.
    //The + 1 is to account for a space before adding the URL to the tweet.
    twitterCounter.updateLimit(options.shortUrl ? (140 - (options.shortUrl.length + 1)) : 114);


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
      thumbImgDom.attr('src', escapeHtml(options.previews[0]));
    } else {
      thumbImgDom.attr('src', escapeHtml(options.thumbnail));
    }

    //Create ellipsis for thumbnail section
    $('.title').textOverflow(null, true);
    $('.description').textOverflow(null, true);
    $('.url').textOverflow(null, true);
    $('.surl').textOverflow(null, true);

    $("form.messageForm")
      .submit(function (evt) {

        var form = evt.target;

        //If twitter and message is bigger than allowed, do not submit.
        if (form.domain.value === 'twitter.com' && twitterCounter.isOver()) {
          return false;
        }

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

        if (sendData.domain === 'twitter.com') {
          if (options.shortUrl) {
            sendData.shorturl = options.shortUrl;
          } else {
            sendData.shorten = true;
          }
        }

        sendMessage();
        return false;
      })
      .each(function (i, node) {
        placeholder(node);
      });
  });

});
