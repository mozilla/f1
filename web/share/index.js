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

require.def("send",
        ["require", "jquery", "blade/fn", "rdapi", "oauth", "blade/jig", "blade/url",
         "placeholder", "TextCounter", "AutoComplete", "dispatch",
         "jquery-ui-1.8.6.custom.min", "jquery.textOverflow"],
function (require,   $,        fn,         rdapi,   oauth,   jig,         url,
          placeholder,   TextCounter,   AutoComplete,   dispatch) {

  var showStatus,
    actions = {
      'twitter.com': {
        medium: 'twitter',
        name: 'Twitter',
        tabName: 'twitterTab',
        selectionName: 'twitter',
        icon: 'i/twitterIcon.png',
        serviceUrl: 'http://twitter.com',
        revokeUrl: 'http://twitter.com/settings/connections',
        signOutUrl: 'http://twitter.com/logout',
        accountLink: function (account) {
          return 'http://twitter.com/' + account.username;
        },
        validate: function (sendData) {
          return true;
        },
        getFormData: function () {
          var message = $('#twitter').find('textarea.message').val().trim() || '';
          return {
            message: message
          };
        },
        restoreFormData: function (data) {
          if (data.message) {
            $('#twitter').find('textarea.message').val(data.message);
          }
        }
      },
      'facebook.com': {
        medium: 'facebook',
        name: 'Facebook',
        tabName: 'facebookTab',
        selectionName: 'facebook',
        icon: 'i/facebookIcon.png',
        serviceUrl: 'http://facebook.com',
        revokeUrl: 'http://www.facebook.com/editapps.php?v=allowed',
        signOutUrl: 'http://facebook.com',
        accountLink: function (account) {
          return 'http://www.facebook.com/profile.php?id=' + account.userid;
        },
        validate: function (sendData) {
          return true;
        },
        getFormData: function () {
          var message = $('#facebook').find('textarea.message').val().trim() || '';
          return {
            message: message
          };
        },
        restoreFormData: function (data) {
          if (data.message) {
            $('#facebook').find('textarea.message').val(data.message);
          }
        }
      },
      'google.com': {
        medium: 'google',
        name: 'Gmail',
        tabName: 'gmailTab',
        selectionName: 'gmail',
        icon: 'i/gmailIcon.png',
        serviceUrl: 'https://mail.google.com',
        revokeUrl: 'https://www.google.com/accounts/IssuedAuthSubTokens',
        signOutUrl: 'http://google.com/preferences',
        accountLink: function (account) {
          return 'http://google.com/profiles/' + account.username;
        },
        validate: function (sendData) {
          if (!sendData.to || !sendData.to.trim()) {
            showStatus('statusToError');
            return false;
          }
          return true;
        },
        getFormData: function () {
          var dom = $('#gmail'),
              to = dom.find('[name="to"]').val().trim() || '',
              subject = dom.find('[name="subject"]').val().trim() || '',
              message = dom.find('textarea.message').val().trim() || '';
          return {
            to: to,
            subject: subject,
            message: message
          };
        },
        restoreFormData: function (data) {
          var dom = $('#gmail');
          if (data.to) {
            dom.find('[name="to"]').val(data.to);
          }
          if (data.subject) {
            dom.find('[name="subject"]').val(data.subject);
          }
          if (data.message) {
            dom.find('textarea.message').val(data.message);
          }
        }
      },
      'googleapps.com': {
        medium: 'googleapps',
        name: 'Google Apps',
        tabName: 'googleappsTab',
        selectionName: 'googleapps',
        icon: 'i/gmailIcon.png',
        serviceUrl: 'https://mail.google.com',
        revokeUrl: 'https://www.google.com/accounts/IssuedAuthSubTokens',
        signOutUrl: 'http://google.com/preferences',
        accountLink: function (account) {
          return 'http://google.com/profiles/' + account.username;
        },
        validate: function (sendData) {
          if (!sendData.to || !sendData.to.trim()) {
            showStatus('statusToError');
            return false;
          }
          return true;
        },
        getFormData: function () {
          var dom = $('#googleapps'),
              to = dom.find('[name="to"]').val().trim() || '',
              subject = dom.find('[name="subject"]').val().trim() || '',
              message = dom.find('textarea.message').val().trim() || '';
          return {
            to: to,
            subject: subject,
            message: message
          };
        },
        restoreFormData: function (data) {
          var dom = $('#googleapps');
          if (data.to) {
            dom.find('[name="to"]').val(data.to);
          }
          if (data.subject) {
            dom.find('[name="subject"]').val(data.subject);
          }
          if (data.message) {
            dom.find('textarea.message').val(data.message);
          }
        }
      }
    },
    hash = location.href.split('#')[1],
    urlArgs, sendData,
    options = {},
    tabDom, bodyDom, clickBlockDom, twitterCounter,
    updateTab = true, accountCache, tabSelection,
    gmailDom, autoCompleteWidget, store = localStorage;

  //Capability detect for localStorage. At least on add-on does weird things
  //with it, so even a concern in Gecko-only code.
  try {
    store.tempVar = 'temp';
    if (store.tempVar === 'temp') {
    }
    delete store.tempVar;
  } catch (e) {
    //Just use a simple in-memory object. Not as nice, but code will still work.
    store = {};
  }

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

  function showError(error) {
    //TODO: make this nicer.
    alert('error.msg');
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
    var sendDomain = (sendData && sendData.domain) || 'twitter.com',
        url = options.url || "",
        doubleSlashIndex = url.indexOf("//") + 2;
    $('#statusShared').empty().append(jig('#sharedTemplate', {
      domain: url.slice(doubleSlashIndex, url.indexOf("/", doubleSlashIndex)),
      service: actions[sendDomain].name,
      href: actions[sendDomain].serviceUrl
    })).find('.shareTitle').textOverflow(null, true);
    showStatus('statusShared', true);
  }
  //Make it globally visible for debug purposes
  window.showStatusShared = showStatusShared;

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
            showStatus('statusAuth');
          } else {
            showStatus('statusError', json.error.message);
          }
        } else if (json.error) {
          showStatus('statusError', json.error.message);
        } else {
          store.lastSelection = actions[sendData.domain].selectionName;
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

          //First, save form state so their message can be recovered after
          //binding accounts.
          var data = {
            "link": sendData.link,
            "domain": sendData.domain,
            "formData": actions[sendData.domain].getFormData()
          };
          store.sessionRestore = JSON.stringify(data);
          showStatus('statusCookiePukeError');
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

    if (id !== 'debug' && id !== 'settings') {
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

      //Replace the Add button in settings tab to show the user instead
      $('#settings span[data-domain="' + svcAccount.domain + '"]').empty().append(jig('#accountTemplate', account));
    });
  }

  function updateAccountButton(domain) {
    $('#settings span[data-domain="' + domain + '"]').empty().append(jig('#addAccountTemplate', domain));

    //Also be sure the account tab is hidden.
    $('.' + actions[domain].tabName).addClass('hidden');
  }

  function determineTab() {
    var selection = '#settings', selectionName;

    if (store.lastSelection) {
      selection = '#' + store.lastSelection;
    } else {
      if (accountCache && accountCache.length) {
        var name = accountCache[0].accounts[0].domain;
        if (actions[name]) {
            selectionName = actions[accountCache[0].accounts[0].domain].selectionName;
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
      //Only grab non-hidden and non-settings tabs.
      .filter(function (i) {
        var tab = $(this),
            hidden = tab.hasClass('hidden'),
            settings = tab.hasClass('settings'),
            debugTab = tab.hasClass('debugTab');
        return !hidden && !settings && !debugTab;
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
            hasLastSelectionMatch = actions[name].selectionName === store.lastSelection;
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

    if (userAccounts.twitter) {
      updateAccountDisplay('twitter', userAccounts.twitter);
    } else {
      updateAccountButton('twitter.com');
    }

    if (userAccounts.facebook) {
      updateAccountDisplay('facebook', userAccounts.facebook);
    } else {
      updateAccountButton('facebook.com');
    }

    if (userAccounts.gmail) {
      updateAccountDisplay('gmail', userAccounts.gmail);
      //Make sure we have contacts for auto-complete
      storeGmailContacts(userAccounts.gmail);
    } else {
      updateAccountButton('google.com');

      //Make sure there is no cached data hanging around.
      if (store.gmailContacts) {
        delete store.gmailContacts;
        updateAutoComplete();
      }
    }

    if (userAccounts.googleapps) {
      updateAccountDisplay('googleapps', userAccounts.googleapps);
      //Make sure we have contacts for auto-complete
      //storeGmailContacts(userAccounts.googleapps);
    } else {
      updateAccountButton('googleapps.com');

      //Make sure there is no cached data hanging around.
      //if (store.gmailContacts) {
      //  delete store.gmailContacts;
      //  updateAutoComplete();
      //}
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

  function onGetAccounts(json) {
    if (json.error) {
      json = [];
    }

    //Store the JSON for the next page load.
    accountCache = json;
    store.accountCache = JSON.stringify(json);

    updateAccounts(json);
  }

  function getAccounts(onSuccess) {
    rdapi('account/get', {
      success: onSuccess || onGetAccounts,
      error: function (xhr, textStatus, err) {
        if (xhr.status === 503) {
          showStatus('statusServerBusyClose');
        } else {
          showStatus('statusServerError', err);
        }
      }
    });
  }

  function accountsUpdated() {
    //The accounts were updated in the settings page.
    //Update the account display to reflect the choices appropriately.

    //Turn off tab updating
    updateTab = false;

    //Hide the tab buttons, the getAccounts will show the ones available.
    $('.leftTab').addClass('hidden');

    getAccounts();
  }

  if (hash) {
    urlArgs = url.queryToObject(hash);
    if (urlArgs.options) {
      options = JSON.parse(urlArgs.options);
    }
    if (!options.title) {
      options.title = options.url;
    }
    if (!options.system) {
      options.system = 'prod';
    }
  }

  $(function () {
    var thumbImgDom = $('img.thumb'),
      facebookDom = $('#facebook'),
      twitterDom = $('#twitter'),
      picture,
      sessionRestore = store.sessionRestore,
      tabSelectionDom;

    bodyDom = $('body');
    clickBlockDom = $('#clickBlock');
    var gmailDom = $('#gmail');
    var appsDom = $('#googleapps');

    //Set the type of system as a class on the UI to show/hide things in
    //dev vs. production
    if (options.system) {
      $(document.documentElement).addClass(options.system);
    }

    //Debug info on the data that was received.
    if (options.system === 'dev') {
      $('#debugOutput').val(JSON.stringify(options));
      $('#debugCurrentLocation').val(location.href);
    }

    //Hook up button for share history
    $('#shareHistoryButton').click(function (evt) {
      window.open('history.html');
      close();
    });
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
          sendMessage();
        } else {
          showStatus('statusOAuthFailed');
        }
      });
    });

    //Use cached account info to speed up startup, but then
    //call API service to be sure data is up to date.
    accountCache = (store.accountCache && JSON.parse(store.accountCache)) || [];
    
    //No need to update tab since that will be done inline below.
    updateTab = false;
    onGetAccounts(accountCache);
    updateTab = true;

    getAccounts(function (json) {

      //If json differs from accountCache, then save and reload
      var same = json.length === accountCache.length;
      if (same) {
        same = !json.some(function (account, i) {
          return account.identifier !== accountCache[i].identifier;
        });
      }

      if (!same) {
        onGetAccounts(json);
      }
    });

    //Set up HTML so initial jquery UI tabs will not flash away from the selected
    //tab as we show it. Done for performance and to remove a flash of tab content
    //that is not the current tab.
    tabSelection = determineTab();
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

    //Set up hidden form fields for facebook
    //TODO: try sending data urls via options.thumbnail if no
    //previews?
    picture = options.previews && options.previews[0];
    if (picture) {
      facebookDom.find('[name="picture"]').val(picture);
    }

    if (options.url) {
      twitterDom.find('[name="link"]').val(options.url);
      facebookDom.find('[name="link"]').val(options.url);
      gmailDom.find('[name="link"]').val(options.url);
      appsDom.find('[name="link"]').val(options.url);
    }

    if (options.title) {
      facebookDom.find('[name="name"]').val(options.title);
      gmailDom.find('[name="title"]').val(options.title);
      appsDom.find('[name="title"]').val(options.title);
    }

    if (options.description) {
      facebookDom.find('[name="caption"]').val(options.description);
      gmailDom.find('[name="description"]').val(options.description);
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

    //Handle button click for services in the settings.
    $('#settings').delegate('.auth', 'click', function (evt) {
      var node = evt.target,
        domain = node.getAttribute('data-domain');

      //Make sure to bring the user back to this service if
      //the auth is successful.
      store.lastSelection = actions[domain].selectionName;
      //Mark that this account was just added, so that on reload,
      //the auto-cleanup of lastSelection does not occur right away.
      store.accountAdded = true;

      oauth(domain, function (success) {
        if (success) {
          location.reload();
        } else {
          showStatus('statusOAuthFailed');
        }
      });
    });

    //In settings, hook up remove buttons to remove an account
    bodyDom.delegate('.accountRemove', 'click', function (evt) {
      var buttonNode = evt.target,
          domain = buttonNode.getAttribute('data-domain'),
          userName = buttonNode.getAttribute('data-username'),
          userId = buttonNode.getAttribute('data-userid');

      rdapi('account/signout', {
        data: {
          domain: domain,
          userid: userId,
          username: userName
        },
        success: function () {
          accountsUpdated();
        },
        error: function (xhr, textStatus, err) {
          showError({
            message: err
          });
        }
      });

      //Remove any cached data
      if (domain === 'google.com' && store.gmailContacts) {
        delete store.gmailContacts;
      }
      if (actions[domain].selectionName === store.lastSelection) {
        delete store.lastSelection;
      }

      evt.preventDefault();
    });

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
