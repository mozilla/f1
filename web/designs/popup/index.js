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
         "placeholder", "AutoComplete", "dispatch", "accounts",
         "storage", "services",
         "jquery-ui-1.8.7.min", "jquery.textOverflow"],
function (require,   $,        fn,         rdapi,   oauth,   jig,         url,
          placeholder,   AutoComplete,   dispatch,   accounts,
          storage,   services) {

  var showStatus,
    actions = services.domains,
    hash = location.href.split('#')[1],
    urlArgs, sendData, prop,
    options = {},
    tabDom, bodyDom, timer,
    updateTab = true, tabSelection, accountCache, showNew,
    store = storage();

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
    $('#clickBlock').removeClass('hidden');
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
  function updateAutoComplete(serviceName) {
    var svc = services.domains[serviceName];
    var toNode = $('#'+svc.type).find('[name="to"]')[0],
        contacts = svc.getContacts(store);
    if (!contacts) {
        contacts = {};
    }

    if (!svc.autoCompleteWidget) {
      svc.autoCompleteWidget = new AutoComplete(toNode);
    }
    var acdata = {
        domain: serviceName,
        contacts: contacts
    }
    dispatch.pub('autoCompleteData', acdata);
  }

  /**
   * Use store to save gmail contacts, but fetch from API
   * server if there is no store copy.
   */
  function storeContacts(serviceName, account) {
    var svcAccount = account.accounts[0];
    var svc = services.domains[svcAccount.domain];
    var contacts = svc.getContacts(store);
    if (!contacts) {
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

            data = svc.getFormattedContacts(entries);

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

  function updateAccountDisplay(service, account) {
    $(function () {
      var name = account.displayName,
        svcAccount = account.accounts[0],
        photo = account.photos && account.photos[0] && account.photos[0].value,
        serviceDom = $('#' + service);

      // XXX for email services, we should show the email account, but we
      // cannot rely on userid being a 'pretty' name we can display
      var username = svcAccount.username;
      if (username && username != name) {
        name = name + " <" + username + ">";
      }

      //Add the tab as an option
      $('.' + service).removeClass('hidden');

      if (name) {
        $('.' + service).find('.username').text(name);
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

  function updateAccounts(accounts) {
    var hasLastSelectionMatch = false,
        userAccounts = {}, selection,
        sessionRestore = store.sessionRestore;

    if ((accounts && accounts.length)) {
      //Figure out what accounts we do have
      var panelhtml='';
      accounts.forEach(function (account) {
        var domain = account.accounts[0].domain;
        if (domain && actions[domain]) {
          //Make sure to see if there is a match for last selection
          if (!hasLastSelectionMatch) {
            hasLastSelectionMatch = actions[domain].type === store.lastSelection;
          }
          userAccounts[actions[domain].type] = account;

          var data = actions[domain];
          data.domain = domain;
          panelhtml += jig('#panelsTemplate', data);

        }
      });
      // add the account panels now
      $('#accounts').append(panelhtml);
      // update the dom content of the panels
      accounts.forEach(function (account) {
          var domain = account.accounts[0].domain;
          actions[domain].setFormData(options);

          updateAccountDisplay(actions[domain].type, account);
          storeContacts(actions[domain].type, account);

      });
    } else {
    $("#accounts").accordion();
      showStatus('statusSettings');
      return;
    }
    $("#accounts").accordion();

    //If no matching accounts match the last selection clear it.
    if (!hasLastSelectionMatch && !store.accountAdded && store.lastSelection) {
      delete store.lastSelection;
    }

    //Reset the just added state now that accounts have been configured one time.
    if (store.accountAdded) {
      delete store.accountAdded;
    }

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

    if (options.shortUrl) {
      $('.surl').text(options.shortUrl);
    }

    if (options.url) {
      $('.url').text(options.url);
    }

    //Create ellipsis for thumbnail section
    $('.title').textOverflow(null, true);
    //$('.description').textOverflow(null, true);
    $('.url').textOverflow(null, true);
    $('.surl').textOverflow(null, true);

    $("form.messageForm")
      .submit(function (evt) {

        var form = evt.target;

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
        var svc = services.domains[sendData.domain];

        if (options.shortUrl) {
          sendData.shorturl = options.shortUrl;
        } else if (svc.shorten) {
          sendData.shorten = true;
        }
        
        // fixup to addressing if necessary
        if (sendData.to) {
            var contacts = svc.getContacts(store);
            var newrecip = []
            if (contacts) {
                var recip = sendData.to.split(',');
                recip.forEach(function(to) {
                    var acct = contacts[to.trim()];
                    if (acct && !acct.email)
                        newrecip.push(acct.userid ? acct.userid : acct.username);
                })
            }
            if (newrecip.length > 0) {
                sendData.to = newrecip.join(', ');
            }
        }

        sendMessage();
        return false;
      })
      .each(function (i, node) {
        placeholder(node);
      });
      
    //Session restore, do after form setting above.
    if (sessionRestore) {
      sessionRestore = JSON.parse(sessionRestore);

      //If this share is for a different URL, dump the sessionRestore
      if (options.link !== sessionRestore.link) {
        sessionRestore = null;
        delete store.sessionRestore;
      }

      if (sessionRestore) {
        actions[sessionRestore.domain].setFormData(sessionRestore.formData);
        //Make sure placeholder text is updated.
        placeholder();
      }
    }

    if (updateTab) {
      //Choose a tab to show.
      //selection = determineTab();
      //tabDom.tabs('select', selection);

      //Update the profile pic/account name text for the tab.
      //updateUserTab(null, {panel: $(selection)[0]});
    }

  } // end updateAccounts

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

    //Debug info on the data that was received.
    if (options.prefs.system === 'dev') {
      $('#debugOutput').val(JSON.stringify(options));
      $('#debugCurrentLocation').val(location.href);
    } else {
      $('#debugpanel').remove();
      $('#debugging').remove();
    }

  $(function () {
    var thumbImgDom, picture,
      sessionRestore = store.sessionRestore,
      tabSelectionDom;

    thumbImgDom = $('img.thumb');
    bodyDom = $('body');

    //Set the type of system as a class on the UI to show/hide things in
    //dev vs. production
    if (options.prefs.system) {
      $(document.documentElement).addClass(options.prefs.system);
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
      $('#clickBlock').removeClass('hidden');
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
        /*
        if (tabSelection) {
          $('.' + tabSelection.slice(1) + 'Tab').addClass('ui-tabs-selected ui-state-active');
          tabSelectionDom = $(tabSelection);
          tabSelectionDom.removeClass('ui-tabs-hide');

          //Update the profile pic/account name text for the tab.
          //updateUserTab(null, {panel: tabSelectionDom[0]});

          //Set up jQuery UI tabs.
          tabDom = $("#tabs");
          tabDom.tabs({ fx: { opacity: 'toggle', duration: 100 } });
          tabDom.bind("tabsselect", updateUserTab);
          //Make the tabs visible now to the user, now that tabs have been set up.
          tabDom.removeClass('invisible');
          bodyDom.removeClass('loading');

        } else {
          //showStatus('statusSettings');
        }
        */
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

    //Set preview image for facebook
    if (options.previews && options.previews.length) {
      //TODO: set up all the image previews.
      thumbImgDom.attr('src', escapeHtml(options.previews[0]));
    } else {
      thumbImgDom.attr('src', escapeHtml(options.thumbnail));
    }
    // watch for has changes, reload if we do, this should be fixed up to be
    // better than doing a reload
    window.addEventListener("hashchange", function () {
        location.reload();
    }, false);
  });

});
