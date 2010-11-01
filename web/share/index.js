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
         "placeholder", "TextCounter", "AutoComplete", "dispatch", "jquery.textOverflow"],
function (require,   $,    fn,     rdapi,   oauth,   jig,     url,
          placeholder,   TextCounter,   AutoComplete,   dispatch) {

  var svcOptions = {
      'twitter': true,
      'facebook': true,
      'gmail': true
    },
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
        }
      }
    },
    hash = location.href.split('#')[1],
    urlArgs, sendData,
    options = {
      services: null
    },
    tabDom, bodyDom, clickBlockDom, twitterCounter,
    updateTab = true,
    accounts, oldAccounts, gmailDom, autoCompleteWidget, store = localStorage;

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

  function close() {
    dispatch.pub('hide');
  }
  //For debug tab purpose, make it global.
  window.closeShare = close;

  function showError(error) {
    //TODO: make this nicer.
    alert('error.msg');
  }

  function showStatus(statusId, shouldCloseOrMessage) {
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
      }, 4000);
    } else if (shouldCloseOrMessage) {
      $('#' + statusId + 'Message').text(shouldCloseOrMessage);
    }
  }
  //Make it globally visible for debug purposes
  window.showStatus = showStatus;

  function cancelStatus() {
    clickBlockDom.addClass('hidden');
    $('div.status').addClass('hidden');
  }

  function showStatusShared() {
    var domain = (sendData && sendData.domain) || 'twitter.com';
    $('#statusShared').empty().append(jig('#sharedTemplate', {
      title: options.title,
      service: actions[domain].name,
      href: actions[domain].serviceUrl
    })).find('.shareTitle').textOverflow(null, true);
    showStatus('statusShared', true);
  }
  //Make it globally visible for debug purposes
  window.showStatusShared = showStatusShared;

  function sendMessage() {
    showStatus('statusSharing');

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
        }
        else if (json.error) {
          showStatus('statusError', json.error.message);
        } else {
          store.lastSelection = actions[sendData.domain].selectionName;
          showStatusShared();
        }
      },
      error: function (xhr, textStatus, err) {
        if (xhr.status === 403) {
          // XXX check for X-Error header == CSRF. if so, we need to
          // make a get request to get a new CSRF token, and then
          // replay our api call.
          // Using a bad error stand-in for now
          showStatus('statusError', err);
        } else if (xhr.status === 503) {
          showStatus('statusServerBusy');
        } else {
          showStatus('statusError', err);
        }
      }
    });
  }

  function showTabToolTip(domain) {
    var tabClass = actions[domain].tabName,
        tabNode = $('.' + tabClass)[0],
        rect = tabNode.getBoundingClientRect(),
        top = rect.top + 3,
        left = rect.left + rect.width + 7,
        tipDom = $('#tabToolTip');

    setTimeout(function () {
      tipDom.css({
        top: top,
        left: left
      }).fadeIn(200, function () {
        setTimeout(function () {
          tipDom.fadeOut(200);
        }, 5000);
      });
    }, 1000);
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

  function getServiceUserName(serviceName) {
    var service = options.services && options.services[serviceName];
    return (service && service.usernames && service.usernames[0]) || null;
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

  function updateServiceDisplayName(service) {
    var userName = getServiceUserName(service);
    if (userName) {
      $(function () {
        $('#' + service).find('.username').text(userName);
      });
    }
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
  }

  function updateAccounts(accounts, callback) {
    var services = options.services, hasAccount = false,
      userAccounts = {}, twitter, selection, param;

    if ((accounts && accounts.length) || services) {
      //Figure out what accounts we do have
      accounts.forEach(function (account) {
        var name = account.accounts[0].domain;
        if (name) {
          name = name.split('.');
          name = name[name.length - 2];
          if (name === 'google') {
            name = 'gmail';
          }
          userAccounts[name] = account;
          hasAccount = true;
        }
      });
    }

    if (userAccounts.twitter) {
      updateAccountDisplay('twitter', userAccounts.twitter);
    } else {
      //Try twitter API if have a twitter name
      twitter = getServiceUserName('twitter');
      if (twitter) {
        $.getJSON('http://api.twitter.com/1/users/show.json?callback=?&screen_name=' +
              encodeURIComponent(twitter), function (json) {
          $(function () {
            $('#twitter')
              .find('img.avatar').attr('src', json.profile_image_url).end()
              .find('.username').text(json.name);
          });
        });
      }
      updateAccountButton('twitter.com');
    }

    if (userAccounts.facebook) {
      updateAccountDisplay('facebook', userAccounts.facebook);
    } else {
      updateServiceDisplayName('facebook');
      updateAccountButton('facebook.com');
    }

    if (userAccounts.gmail) {
      updateAccountDisplay('gmail', userAccounts.gmail);
      //Make sure we have contacts for auto-complete
      storeGmailContacts(userAccounts.gmail);
    } else {
      updateServiceDisplayName('gmail');
      updateAccountButton('google.com');

      //Make sure there is no cached data hanging around.
      if (store.gmailContacts) {
        delete store.gmailContacts;
        updateAutoComplete();
      }
    }

    if (updateTab) {
      //Choose a tab to show.
      if (hasAccount) {
        if (store.lastSelection) {
          selection = '#' + store.lastSelection;
        } else {
          for (param in userAccounts) {
            if (userAccounts.hasOwnProperty(param)) {
              hasAccount = true;
              if (param in svcOptions) {
                selection = '#' + param;
                break;
              }
            }
          }
        }
      }

      if (!selection) {
        selection = '#settings';
      }
      tabDom.tabs('select', selection);
      //Make the body visible now to the user, now that tabs have been set up.
      //TODO: on first run, just need the tab selection to go without the
      //jQuery animation transition, then this setTimeout can be removed.
      setTimeout(function () {
        bodyDom.removeClass('loading');
        tabDom.removeClass('invisible');
      }, 100);

  
      //TODO: HACK, clean this up later.
      updateUserTab(null, {panel: $(selection)[0]});
    }

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

    if (callback) {
      callback();
    }
  }

  //Set up the URL in all the message containers
  function updateLinks() {
    $('textarea.message').each(function (i, node) {
      var dom = $(node),
          val = dom.val() + '\n';
      //If the message containder doesn't want URLs then respect that.
      if (dom.hasClass('nourl')) {
      } else if (dom.hasClass('short')) {
        dom.val(val + options.shortUrl || options.url);
      } else if (dom.hasClass('urlWithSpace')) {
        dom.val(val + (options.canonicalUrl || options.url) + "\n");
      } else {
        dom.val(val + options.canonicalUrl || options.url);
      }
    });
    $(".meta .url").text(options.url);
    $(".meta .surl").text(options.shortUrl || options.url);


    //Set up twitter text counter
    if (!twitterCounter) {
      twitterCounter = new TextCounter($('#twitter textarea.message'), $('#twitter .counter'), 114);
    }

    //Update counter. If using a short url from the web page itself, it could potentially be a different
    //length than a bit.ly url so account for that.
    //The + 1 is to account for a space before adding the URL to the tweet.
    twitterCounter.updateLimit(options.shortUrl ? (140 - (options.shortUrl.length + 1)) : 114);

    //Make sure placeholder text is updated.
    placeholder();
  }

  function getAccounts(callback) {
    rdapi('account/get', {
      success: function (json) {
        if (json.error) {
          json = [];
        }
        accounts = json;
        updateAccounts(json, callback);

        updateLinks();
      },
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
    
    //Remember the old accounts, so if there is a new one that shows up,
    //show the tooltip for that account.
    oldAccounts = accounts;
    
    //Turn off tab updating
    updateTab = false;

    //Hide the tab buttons, the getAccounts will show the ones available.
    $('.leftTab').addClass('hidden');

    getAccounts(function () {
      //Compare the old accounts with new accounts to see if one was added.
      var oldMap = {}, newMap = {}, domains = [], domain;
      oldAccounts.forEach(function (account) {
        oldMap[account.accounts[0].domain] = true;
        
      });
      accounts.forEach(function (account) {
        domain = account.accounts[0].domain;
        if (!newMap[domain]) {
          newMap[domain] = true;
          domains.push(domain);
        }
      });

      //Find the missing domain from the old map.
      domain = null;
      domains.some(function (d) {
        if (!oldMap[d]) {
          domain = d;
          return true;
        }
        return false;
      });

      if (domain) {
        showTabToolTip(domain);
      }
    });
  }

  if (hash) {
    urlArgs = url.queryToObject(hash);
    if (urlArgs.options) {
      options = JSON.parse(urlArgs.options);
    }
    if (!options.title) {
      options.title = options.url;
    }
    //For now disable guessing on accounts, since it is not reliable.
    //TODO: remove the services stuff completely later, both here and
    //in the extension if cannot get reliable account signed in detection in
    //the browser via the browser cookies.
    options.services = {};
  }

  getAccounts();

  $(function () {
    var thumbImgDom = $('img.thumb'),
      facebookDom = $('#facebook'),
      twitterDom = $('#twitter'),
      picture;

    bodyDom = $('body');
    clickBlockDom = $('#clickBlock');
    gmailDom = $('#gmail');

    //Set the type of system as a class on the UI to show/hide things in
    //dev vs. production
    if (options.system) {
      $(document.documentElement).addClass(options.system);
    }

    //Debug info on the data that was received.
    $('#debugOutput').val(JSON.stringify(options));
    $('#debugCurrentLocation').val(location.href);

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

    //Set up tabs.
    tabDom = $("#tabs");
    tabDom.tabs({ fx: { opacity: 'toggle', duration: 100 } });
    tabDom.bind("tabsselect", updateUserTab);

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
    }

    if (options.title) {
      facebookDom.find('[name="name"]').val(options.title);
      gmailDom.find('[name="message"]').val(options.title);
    }

    if (options.description) {
      facebookDom.find('[name="caption"]').val(options.description);
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
      thumbImgDom.attr('src', options.previews[0]);
    } else {
      thumbImgDom.attr('src', options.thumbnail);
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
