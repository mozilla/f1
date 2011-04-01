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

/*jslint plusplus: false, indent: 2, nomen: false */
/*global require: false, define: false, location: true, window: false, alert: false,
  document: false, setTimeout: false, localStorage: false, parent: false */
"use strict";

// Allow tests to plug into the page by notify them if this is a test.
if (location.hash === '#test') {
  parent.postMessage(JSON.stringify({topic: 'registerForTests'}),
                     location.protocol + "//" + location.host);
}

require({
  paths: {
    widgets: '../share/panel/scripts/widgets'
  }
});

define([ "require", "jquery", "blade/object", "blade/fn", "rdapi", "oauth",
        "blade/jig", "blade/url", "placeholder", "AutoComplete", "dispatch", "accounts",
         "storage", "services", "widgets/PageInfo",
         "widgets/DebugPanel", "widgets/AccountPanel", "dotCompare",
         "jquery-ui-1.8.7.min", "jquery.textOverflow"],
function (require,   $,        object,         fn,         rdapi,   oauth,
          jig,         url,        placeholder,   AutoComplete,   dispatch,   accounts,
          storage,   services,   PageInfo,
          DebugPanel,           AccountPanel,           dotCompare) {

  var actions = services.domains,
    options, bodyDom, pageInfo, sendData, showNew,
    onFirstShareState = null,
    accountPanels = [],
    store = storage(),
    SHARE_DONE = 0,
    SHARE_START = 1,
    SHARE_ERROR = 2,
    okStatusIds = {
      statusSettings: true,
      statusSharing: true,
      statusShared: true
    },
    // If it has been more than a day,
    // refresh the UI, record a timestamp for it.
    refreshStamp = (new Date()).getTime(),
    //1 day.
    refreshInterval = 1 * 24 * 60 * 60 * 1000;

  function checkBase64Preview() {
    //Ask extension to generate base64 data if none available.
    //Useful for sending previews in email.
    var preview = options.previews && options.previews[0];
    if (accounts.length && preview && preview.http_url && !preview.base64) {
      dispatch.pub('generateBase64Preview', preview.http_url);
    }
  }

  function hide() {
    dispatch.pub('hide');
  }
  window.hideShare = hide;

  function close() {
    dispatch.pub('close');
  }
  //For debug tab purpose, make it global.
  window.closeShare = close;

  function updateChromeStatus(status, statusId, message) {
    dispatch.pub('updateStatus', [status, statusId, message, options.url]);
  }
  window.updateChromeStatus = updateChromeStatus;

  function _showStatus(statusId, shouldCloseOrMessage) {
    if (shouldCloseOrMessage === true) {
      setTimeout(function () {
        dispatch.pub('success', {
          domain: sendData.domain,
          username: sendData.username,
          userid: sendData.userid,
          url: options.url,
          service: services.domains[sendData.domain].name
        });
        $('div.status').addClass('hidden');
      }, 2000);
    } else if (shouldCloseOrMessage) {
      $('#' + statusId + 'Message').text(shouldCloseOrMessage);
    }

    //Tell the extension that the size of the content may have changed.
    dispatch.pub('sizeToContent');
  }

  function showStatus(statusId, shouldCloseOrMessage) {
    $('div.status').addClass('hidden');
    $('#clickBlock').removeClass('hidden');
    $('#' + statusId).removeClass('hidden');

    if (!okStatusIds[statusId]) {
      updateChromeStatus(SHARE_ERROR, statusId, shouldCloseOrMessage);
    }
    _showStatus(statusId, shouldCloseOrMessage);
  }
  //Make it globally visible for debug purposes
  window.showStatus = showStatus;

  function resetStatusDisplay() {
    $('#clickBlock').addClass('hidden');
    $('div.status').addClass('hidden');
    //Be sure form field placeholders are up to date.
    placeholder();
  }

  function cancelStatus() {
    // clear any existing status
    updateChromeStatus(SHARE_DONE);
    resetStatusDisplay();
  }

  function shareStateUpdate(shareState) {
    var now = (new Date()).getTime(),
        status;
    if (now - refreshStamp > refreshInterval) {
      //Force contact with the server via the true argument.
      location.reload(true);
    } else {

      options = shareState.options;
      // TODO: figure out if we can avoid this call if this is just
      // an error update.
      checkBase64Preview();

      if (onFirstShareState) {
        onFirstShareState();
        onFirstShareState = null;
      } else {
        dispatch.pub('optionsChanged', options);

        // just a status update.
        status = null;
        if (shareState && shareState.status) {
          // remove the status number
          status = shareState.status.slice(1);
        }
        if (status && status[0]) {
          _showStatus.apply(null, status);
        } else {
          //clear all status, but if settings config needs to be shown, show it.
          cancelStatus();
          accounts(
            function (accts) {
              if (!accts || !accts.length) {
                showStatus('statusSettings');
              }
            }, function (err) {
              showStatus('statusSettings');
            }
          );
        }

        //Tell the extension that the size of the content may have changed.
        dispatch.pub('sizeToContent');
      }
    }
  }
  dispatch.sub('shareState', shareStateUpdate);

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

  // This method assumes the sendData object has already been set up.
  // You probably want sendMessage, not this call.
  function callSendApi() {
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
          store.set('lastSelection', actions[sendData.domain].type);
          showStatusShared();
          //Be sure to delete sessionRestore data
          accountPanels.forEach(function (panel) {
            panel.clearSavedData();
          });

          // notify on successful send for components that want to do
          // work, like save any new contacts.
          dispatch.pub('sendComplete', sendData);
        }
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
        } else if (xhr.status === 0) {
          showStatus('statusServerError');
        } else {
          showStatus('statusError', err);
        }
      }
    });
  }

  function sendMessage(data) {
    showStatus('statusSharing');

    sendData = data;

    // get any shortener prefs before trying to send.
    store.get('shortenPrefs', function (shortenPrefs) {

      accounts.getService(data.domain, data.userid, data.username,
        function (svcData) {

          var svcConfig = services.domains[data.domain],
              shortenData;

          sendData.account = JSON.stringify(svcData);

          // hide the panel now, but only if the extension can show status
          // itself (0.7.7 or greater)
          updateChromeStatus(SHARE_START);
          hide();

          //First see if a bitly URL is needed.
          if (svcConfig.shorten && shortenPrefs) {
            shortenData = {
              format: 'json',
              longUrl: sendData.link
            };

            // Unpack the user prefs
            shortenPrefs = JSON.parse(shortenPrefs);

            if (shortenPrefs) {
              object.mixin(shortenData, shortenPrefs, true);
            }

            // Make sure the server does not try to shorten.
            delete sendData.shorten;

            $.ajax({
              url: 'http://api.bitly.com/v3/shorten',
              type: 'GET',
              data: shortenData,
              dataType: 'json',
              success: function (json) {
                sendData.shorturl = json.data.url;
                callSendApi();
              },
              error: function (xhr, textStatus, errorThrown) {
                showStatus('statusShortenerError', errorThrown);
              }
            });
          } else {
            callSendApi();
          }
        }
      );
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

    store.get('lastSelection', function (lastSelection) {
      store.get('accountAdded', function (accountAdded) {

        var asyncCount = 0,
            asyncConstructionDone = false,
            accountPanel;

        // Finishes account creation. Actually runs *after* the work done
        // below this function. Need a function callback since AccountPanel
        // construction is async.
        function finishCreate() {
          asyncCount -= 1;

          // Could still be waiting for other async creations. If so, wait.
          if (asyncCount > 0 || !asyncConstructionDone) {
            return;
          }

          // add the account panels now
          accountsDom.append(fragment);

          //Add debug panel if it is allowed.
          if (options.prefs.system === 'dev') {
            debugPanel = new DebugPanel({}, accountsDom[0]);
          }

          checkBase64Preview();

          //If no matching accounts match the last selection clear it.
          if (lastSelectionMatch < 0 && !accountAdded && lastSelection) {
            store.remove('lastSelection');
            lastSelectionMatch = 0;
          }

          // which domain was last active?
          $("#accounts").accordion({ active: lastSelectionMatch });

          //Reset the just added state now that accounts have been configured one time.
          if (accountAdded) {
            store.remove('accountAdded');
          }

          //Inform extension the content size has changed, but use a delay,
          //to allow any reflow/adjustments.
          setTimeout(function () {
            dispatch.pub('sizeToContent');
          }, 100);
        }

        //Figure out what accounts we do have
        accounts.forEach(function (account) {
          // protect against old style account data
          if (typeof(account.profile) === 'undefined') {
            return;
          }

          var domain = account.profile.accounts[0].domain,
              data, PanelCtor;

          if (domain && actions[domain]) {
            //Make sure to see if there is a match for last selection
            if (actions[domain].type === lastSelection) {
              lastSelectionMatch = i;
            }

            data = actions[domain];
            data.domain = domain;

            // Get the contructor function for the panel.
            PanelCtor = require(panelOverlayMap[domain] || 'widgets/AccountPanel');

            accountPanel = new PanelCtor({
              options: options,
              account: account,
              svc: data
            }, fragment);

            // if an async creation, then wait until all are created before
            // proceeding with UI construction.
            if (accountPanel.asyncCreate) {
              asyncCount += 1;
              accountPanel.asyncCreate.then(finishCreate);
            }

            accountPanels.push(accountPanel);
          }

          i++;
        });

        asyncConstructionDone = true;

        // The async creation could have finished if all the data values
        // for the account panels were already cached. If so, then finish
        // out the UI construction.
        if (!asyncCount) {
          finishCreate();
        }
      });
    });
  }

  function updateAccounts(accounts) {
    var panelOverlays = [],
        panelOverlayMap = {},
        //Only do one overlay request per domain. This can be removed
        //when requirejs is updated to 0.23.0 or later.
        processedDomains = {};

    if ((accounts && accounts.length)) {
      //Collect any UI overrides used for AccountPanel based on the services
      //the user has configured.
      accounts.forEach(function (account) {
        // protect against old style account data
        if (typeof(account.profile) === 'undefined') {
          return;
        }

        var domain = account.profile.accounts[0].domain,
            overlays = actions[domain].overlays,
            overlay = overlays && overlays['widgets/AccountPanel'];
        if (overlay && !processedDomains[domain]) {
          panelOverlays.push(overlay);
          panelOverlayMap[domain] = overlay;
          processedDomains[domain] = true;
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
      dispatch.pub('sizeToContent');
    }

  }

  // Set up initialization work for the first share state passing.
  onFirstShareState = function () {
    // Wait until DOM ready to start the DOM work.
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
      dispatch.sub('sendMessage', function (data) {
        sendMessage(data);
      });

      bodyDom = $('body');
      bodyDom
        .delegate('#statusAuthButton, .statusErrorButton', 'click', function (evt) {
          cancelStatus();
        })
        .delegate('.statusErrorCloseButton', 'click', function (evt) {
          cancelStatus();
        })
        .delegate('.statusResetErrorButton', 'click', function (evt) {
          location.reload();
        })
        .delegate('nav .close', 'click', close);

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
    });
  };

  // Trigger a call for the first share state.
  dispatch.pub('panelReady', null);
});
