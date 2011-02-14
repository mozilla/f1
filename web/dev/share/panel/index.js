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
/*global require: false, define: false, location: true, window: false, alert: false,
  document: false, setTimeout: false, localStorage: false */
"use strict";

require({
  paths: {
    widgets: '../share/panel/scripts/widgets'
  }
});

define([ "require", "jquery", "blade/fn", "rdapi", "oauth", "blade/jig", "blade/url",
         "placeholder", "AutoComplete", "dispatch", "accounts",
         "storage", "services", "shareOptions", "widgets/PageInfo", "rssFeed",
         "widgets/DebugPanel", "widgets/AccountPanel",
         "jquery-ui-1.8.7.min", "jquery.textOverflow"],
function (require,   $,        fn,         rdapi,   oauth,   jig,         url,
          placeholder,   AutoComplete,   dispatch,   accounts,
          storage,   services,   shareOptions,   PageInfo,           rssFeed,
          DebugPanel,           AccountPanel) {

  var showStatus,
    actions = services.domains,
    options = shareOptions(),
    bodyDom, timer, pageInfo, sendData, showNew,
    accountPanels = [],
    hashReload = false,
    store = storage();

  function close() {
    dispatch.pub('close');
  }
  //For debug tab purpose, make it global.
  window.closeShare = close;

  showStatus = function (statusId, shouldCloseOrMessage) {
    $('div.status').addClass('hidden');
    $('#clickBlock').removeClass('hidden');
    $('#' + statusId).removeClass('hidden');

    if (shouldCloseOrMessage === true) {
      setTimeout(function () {
        dispatch.pub('success', {
          domain: sendData.domain,
          username: sendData.username,
          userid: sendData.userid
        });
        $('div.status').addClass('hidden');
      }, 2000);
    } else if (shouldCloseOrMessage) {
      $('#' + statusId + 'Message').text(shouldCloseOrMessage);
      hashReload = true;
    }

    //Tell the extension that the size of the content may have changed.
    dispatch.pub('sizeToContent');
  };

  //Make it globally visible for debug purposes
  window.showStatus = showStatus;

  function cancelStatus() {
    $('#clickBlock').addClass('hidden');
    $('div.status').addClass('hidden');
    //Be sure form field placeholders are up to date.
    placeholder();
  }

  function showStatusShared() {
    // if no sendData, we're in debug mode, default to twitter to show the
    // panel for debugging
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
    //Save form state so their message can be recovered after
    //binding accounts.
    accountPanels.forEach(function (panel) {
      panel.saveData();
    });
    showStatus('statusAuth');
  }

  function checkBase64Preview() {
    //Ask extension to generate base64 data if none available.
    //Useful for sending previews in email.
    var preview = options.previews && options.previews[0];
    if (accounts.length && preview && preview.http_url && !preview.base64) {
      dispatch.pub('generateBase64Preview', preview.http_url);
    }
  }

  function sendMessage(data) {
    showStatus('statusSharing');

    sendData = data;

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
        accountPanels.forEach(function (panel) {
          panel.clearSavedData();
        });
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
   * Shows the accounts after any AccountPanel overlays have been loaded.
   */
  function displayAccounts(accounts, panelOverlayMap) {
    var lastSelectionMatch = 0,
        accountsDom = $('#accounts'),
        fragment = document.createDocumentFragment(),
        debugPanel,
        i = 0;

    $('#shareui').removeClass('hidden');

    //Figure out what accounts we do have
    accounts.forEach(function (account) {
      var domain = account.accounts[0].domain,
          data, PanelCtor;

      if (domain && actions[domain]) {
        //Make sure to see if there is a match for last selection
        if (actions[domain].type === store.lastSelection) {
          lastSelectionMatch = i;
        }

        data = actions[domain];
        data.domain = domain;

        // Get the contructor function for the panel.
        PanelCtor = require(panelOverlayMap[domain] || 'widgets/AccountPanel');

        accountPanels.push(new PanelCtor({
          options: options,
          account: account,
          svc: data
        }, fragment));
      }

      i++;
    });

    // add the account panels now
    accountsDom.append(fragment);

    //Add debug panel if it is allowed.
    if (options.prefs.system === 'dev') {
      debugPanel = new DebugPanel({}, accountsDom[0]);
    }

    checkBase64Preview();

    //If no matching accounts match the last selection clear it.
    if (lastSelectionMatch < 0 && !store.accountAdded && store.lastSelection) {
      delete store.lastSelection;
      lastSelectionMatch = 0;
    }

    // which domain was last active?
    $("#accounts").accordion({ active: lastSelectionMatch });

    //Reset the just added state now that accounts have been configured one time.
    if (store.accountAdded) {
      delete store.accountAdded;
    }

    //Inform extension the content size has changed.
    dispatch.pub('sizeToContent');
  }

  function updateAccounts(accounts) {
    var panelOverlays = [],
        panelOverlayMap = {};

    if ((accounts && accounts.length)) {
      //Collect any UI overrides used for AccountPanel based on the services
      //the user has configured.
      accounts.forEach(function (account) {
        var domain = account.accounts[0].domain,
            overlays = actions[domain].overlays,
            overlay = overlays && overlays['widgets/AccountPanel'];
        if (overlay) {
          panelOverlays.push(overlay);
          panelOverlayMap[domain] = overlay;
        }
      });

      if (panelOverlays.length) {
        require(panelOverlays, function () {
          displayAccounts(accounts, panelOverlayMap);
        });
      } else {
        displayAccounts(accounts, panelOverlayMap);
      }
    } else {
      showStatus('statusSettings');

      //Clean up storage
      services.domainList.forEach(function (domain) {
        delete store[services.domains[domain].type + 'Contacts'];
      });

      dispatch.pub('sizeToContent');
    }

  }

  //For the "new items" link, only show it for x number of days after showing it.
  //NOTE: when updating for newer releases, delete the old value from the
  //storage.
  delete store.newTimerV1;
  delete store.newTimerV2;
  timer = store.newTimerV3;
  if (!timer) {
    store.newTimerV3 = (new Date()).getTime();
    showNew = true;
  } else {
    timer = JSON.parse(timer);
    //If time since first seen is greater than three days, hide the new link.
    if ((new Date()).getTime() - timer < (3 * 24 * 60 * 60 * 1000)) {
      showNew = true;
    }
  }

  $(function () {
    //Set the type of system as a class on the UI to show/hide things in
    //dev vs. production
    if (options.prefs.system) {
      $(document.documentElement).addClass(options.prefs.system);
    }
    if (options.ui === 'sidebar') {
      $("#panelHeader").text('');
      $("#closeLink").addClass('hidden');
    }

    //Show the new link if appropriate.
    if (showNew) {
      $('#newLink').removeClass('hidden');
    }

    //Listen to sendMessage events from the AccountPanels
    $(document).bind('sendMessage', function (evt, data) {
      sendMessage(data);
    });

    bodyDom = $('body');
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
      .delegate('nav .close', 'click', close);

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
      $('#clickBlock').removeClass('hidden');
      sendData.HumanVerification = $('#captcha').attr('value');
      sendData.HumanVerificationImage = $('#captchaImage').attr('src');
      sendMessage(sendData);
    });

    //Set up default handler for account changes triggered from other
    //windows, or updates to expired cache.
    accounts.onChange();

    //Only bother with localStorage enabled storage.
    if (storage.type === 'memory') {
      showStatus('statusEnableLocalStorage');
      return;
    }

    //Show the page info at the top.
    pageInfo = new PageInfo({
      options: options
    }, $('.sharebox')[0], 'prepend');

    //Fetch the accounts.
    accounts(
      updateAccounts,

      //Error handler for account fetch
      function (xhr, textStatus, err) {
        if (xhr.status === 503) {
          showStatus('statusServerBusyClose');
        } else {
          showStatus('statusServerError', err);
        }
      }
    );

    // watch for hash changes, update options and trigger
    // update event. However, if it has been more than a day,
    // refresh the UI.
    var refreshStamp = (new Date()).getTime(),
        //1 day.
        refreshInterval = 1 * 24 * 60 * 60 * 1000;

    window.addEventListener("hashchange", function () {
      var now = (new Date()).getTime();
      if (hashReload || now - refreshStamp > refreshInterval) {
        //Force contact with the server via the true argument.
        location.reload(true);
        hashReload = false;
      } else {
        options = shareOptions();
        dispatch.pub('optionsChanged', options);
        checkBase64Preview();

        //Check that accounts are still available, but do it in the
        //background.
        accounts();
      }
    }, false);

    //Get the most recent feed item, not important to do it last.
    rssFeed(function (title, link) {
      $('#rssLink').attr('href', link).text(title);
    });

  });
});
