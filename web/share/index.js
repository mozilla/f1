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
  document: false, setTimeout: false */
"use strict";

require.def("send",
        ["require", "jquery", "blade/fn", "rdapi", "oauth", "blade/jig", "blade/url",
         "placeholder", "TextCounter"],
function (require,   $,    fn,     rdapi,   oauth,   jig,     url,
          placeholder,   TextCounter) {

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
        icon: 'i/twitterIcon.png',
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
        icon: 'i/facebookIcon.png',
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
        icon: 'i/gmailIcon.png',
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
    tabDom, bodyDom, twitterCounter,
    updateTab = true,
    accounts, oldAccounts,
    previewWidth = 90, previewHeight = 70;

  jig.addFn({
    profilePic: function (photos) {
      //TODO: check for a thumbnail picture, hopefully one that is square.
      return photos && photos[0] && photos[0].value || 'i/face2.png';
    },
    serviceName: function (domain) {
      return actions[domain].name;
    }
  });

  function showError(error) {
    //TODO: make this nicer.
    alert('error.msg');
  }

  function showStatus(statusId, shouldCloseOrMessage) {
    tabDom.addClass('hidden');
    $('div.status').addClass('hidden');
    $('#' + statusId).removeClass('hidden');
    bodyDom.addClass('status');
    location = '#!resize';

    if (shouldCloseOrMessage === true) {
      setTimeout(function () {
        location = '#!success:' + url.objectToQuery({
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
    $('div.status').addClass('hidden');
    tabDom.removeClass('hidden');
    bodyDom.removeClass('status');
    location = '#!resize';
  }

  function sendMessage() {
    rdapi('send', {
      type: 'POST',
      data: sendData,
      success: function (json) {
        // {'reason': u'Status is a duplicate.', 'provider': u'twitter.com'}
        if (json.error && json.error.reason) {
          var code = json.error.code;
          // XXX need to find out what error codes everyone uses
          if (code === 400 || code ===  401 || code === 403 || code >= 530) {
            showStatus('statusAuth');
          } else {
            showStatus('statusError', json.error.reason);
          }
        }
        else if (json.error) {
          showStatus('statusError', json.error.reason);
        } else {
          showStatus('statusShared', true);
        }
      },
      error: function (xhr, textStatus, err) {
        showStatus('statusError', err);
      }
    });
  }

  function resizePreview(evt) {
    var imgNode = evt.target,
      width = imgNode.width,
      height = imgNode.height;

    if (height > width) {
      imgNode.height = previewHeight;
    } else {
      imgNode.width = previewWidth;
    }
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
    var services = options.services,
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
    } else {
      updateServiceDisplayName('gmail');
      updateAccountButton('google.com');
    }

    if (updateTab) {
      //Choose a tab to show. Use the first service found in services.
      //Warning: this is not completely reliable given a for..in loop
      //over an object, which does not guarantee key order across browsers.
      if (services) {
        for (param in services) {
          if (param in svcOptions) {
            selection = '#' + param;
            break;
          }
        }
      }
      if (!selection) {
        for (param in userAccounts) {
          if (param in svcOptions) {
            selection = '#' + param;
            break;
          }
        }
      }
      if (!selection) {
        selection = '#settings';
      }
      tabDom.tabs('select', selection);
  
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
            settings = tab.hasClass('settings');
        return !hidden && !settings;
      })
      //Apply the new first and last
      .first().addClass('first').end()
      .last().addClass('last');

    if (callback) {
      callback();
    }
  }

  function getAccounts(callback) {
    rdapi('account/get', {
      success: function (json) {
        if (json.error) {
          json = [];
        }
        accounts = json;
        updateAccounts(json, callback);
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
      picture;

    bodyDom = $('body');

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
      location = '#!close';
    });
    $('#statusAuthButton, #statusErrorButton').click(function (evt) {
      cancelStatus(); 
    });
    $('#authOkButton').click(function (evt) {
      oauth(sendData.domain, sendMessage);
    });

    //Set up tabs.
    tabDom = $("#tabs");
    tabDom.tabs({ fx: { opacity: 'toggle', duration: 100 } });
    tabDom.bind("tabsselect", updateUserTab);

    //Set up the URL in all the message containers
    function updateLinks() {
      $('textarea.message').each(function (i, node) {
        var dom = $(node);
        //If the message containder doesn't want URLs then respect that.
        if (dom.hasClass('nourl')) {
        } else if (dom.hasClass('short')) {
          dom.val(options.shortUrl || options.url);
        } else if (dom.hasClass('includeMeta')) {
          dom.val((options.title || "") + "\n" + (options.canonicalUrl || options.url));
        } else {
          dom.val(options.canonicalUrl || options.url);
        }
      });
      $(".meta .url").text(options.url);
      $(".meta .surl").text(options.shortUrl || options.url);
    }

    if (options.url && !options.shortUrl) {
      rdapi('links/shorten', {
        type: 'POST',
        data: {
          'url': options.canonicalUrl || options.url
        },
        success: function (json) {
          options.shortUrl = json.result.short_url;
          updateLinks();
        },
        error: function (json) {
        }
      });
    } else {
      updateLinks();
    }

    //Set up hidden form fields for facebook
    //TODO: try sending data urls via options.thumbnail if no
    //previews?
    picture = options.previews && options.previews[0];
    if (picture) {
      facebookDom.find('[name="picture"]').val(picture);
    }

    if (options.url) {
      facebookDom.find('[name="link"]').val(options.url);
    }

    if (options.title) {
      facebookDom.find('[name="name"]').val(options.title);
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

    //Remember the thumbnail preview size for later, to adjust the image
    //to fit within the size.
    //previewWidth = parseInt(thumbDivNode.style.width, 10);
    //previewHeight = parseInt(thumbDivNode.style.height, 10);
    thumbImgDom.bind('load', resizePreview);

    //Set preview image for facebook
    if (options.previews && options.previews.length) {
      //TODO: set up all the image previews.
      thumbImgDom.attr('src', options.previews[0]);
    } else {
      thumbImgDom.attr('src', options.thumbnail);
    }

    //Set up twitter text counter
    twitterCounter = new TextCounter($('#twitter textarea.message'), $('#twitter .counter'), 140);

    //Handle button click for services in the settings.
    $('#settings').delegate('.auth', 'click', function (evt) {
      var node = evt.target,
        domain = node.getAttribute('data-domain');

      oauth(domain, function () {
        accountsUpdated();
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
    });

    $("form.messageForm")
      .submit(function (evt) {
        //First clear old errors
        $(".error").addClass("invisible");

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
        sendData.shorturl = options.shortUrl;

        sendMessage();
        return false;
      })
      .each(function (i, node) {
        placeholder(node);
      });
  });

});
