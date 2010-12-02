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

/*jslint indent: 2 */
/*global require: false, window: false, location: true */
"use strict";

require.def("index",
        ["require", "jquery", "blade/fn", "rdapi", "oauth", "blade/jig", "dispatch",
         "jquery.colorFade", "jquery.textOverflow"],
function (require,   $,        fn,         rdapi,   oauth,   jig,         dispatch) {

  var domains = {
    'twitter.com': {
      type: 'twitter',
      name: 'Twitter',
      serviceUrl: 'http://twitter.com',
      revokeUrl: 'http://twitter.com/settings/connections',
      signOutUrl: 'http://twitter.com/logout'
    },
    'facebook.com': {
      type: 'facebook',
      name: 'Facebook',
      serviceUrl: 'http://facebook.com',
      revokeUrl: 'http://www.facebook.com/editapps.php?v=allowed',
      signOutUrl: 'http://facebook.com'
    },
    'google.com': {
      type: 'gmail',
      name: 'Gmail',
      serviceUrl: 'https://mail.google.com',
      revokeUrl: 'https://www.google.com/accounts/IssuedAuthSubTokens',
      signOutUrl: 'http://google.com/preferences',
      accountLink: function (account) {
        return 'http://google.com/profiles/' + account.username;
      }
    },
    'googleapps.com': {
      isNew: true,
      type: 'googleApps',
      name: 'Google Apps',
      serviceUrl: 'https://mail.google.com',
      revokeUrl: 'https://www.google.com/accounts/IssuedAuthSubTokens',
      signOutUrl: 'http://google.com/preferences'
    },
    'yahoo.com': {
      isNew: true,
      type: 'yahoo',
      name: 'Yahoo!',
      serviceUrl: 'http://mail.yahoo.com', // XXX yahoo doesn't have ssl enabled mail?
      revokeUrl: 'https://api.login.yahoo.com/WSLogin/V1/unlink',
      signOutUrl: 'https://login.yahoo.com/config/login?logout=1'
    }
  },
  domainList = [
    'twitter.com', 'facebook.com', 'google.com', 'googleapps.com', 'yahoo.com'
  ],
  store = localStorage;

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
    domainType: function (account) {
      var domain = domains[account.accounts[0].domain];
      return domain ? domain.type : '';
    },
    domainName: function (account) {
      var domain = domains[account.accounts[0].domain];
      return domain ? domain.name : '';
    }
  });

  function showStatus(statusId, message) {
    $('div.status').addClass('hidden');
    $('#' + statusId).removeClass('hidden');
  
    if (message) {
      $('#' + statusId + ' .message').text(message);
    }
  }

  rdapi('account/get', {
    success: function (json) {
      if (json.error) {
        json = [];
      }

      var html = '';

      //Weed out existing accounts for domains from available domainList,
      //and generate account UI
      json.forEach(function (item) {
        var index = domainList.indexOf(item.accounts[0].domain);
        if (index !== -1) {
          domainList.splice(index, 1);
        }
        html += jig('#accountTemplate', item);
      });

      //Generate UI for each list.
      if (html) {
        $('#existingHeader').removeClass('hidden');
        $('#existing')
          .append(html)
          .removeClass('hidden');

      }

      html = '';
      domainList.forEach(function (domain) {
        var data = domains[domain];
        data.domain = domain;
        html += jig('#addTemplate', domains[domain]);
      });
      if (html) {
        $('#availableHeader').removeClass('hidden');
        $('#available')
          .append(html)
          .removeClass('hidden');
      }

      //Flash the new items.
      $(function () {
        $("li.newItem").animate({ backgroundColor: '#ffff99' }, 200)
          .delay(1000).animate({ backgroundColor: '#fafafa' }, 3000);
      });
    },
    error: function (xhr, textStatus, err) {
      if (xhr.status === 503) {
        showStatus('statusServerBusyClose');
      } else {
        showStatus('statusServerError', err);
      }
    }
  });

  $(function () {

    // resize wrapper
    $(window).bind("load resize", function () {
      var h = $(window).height();
      $("#wrapper").css({ "min-height" : (h) });
    });

    $('body')
      //Wire up the close button
      .delegate('.close', 'click', function (evt) {
        window.close();
      })
      //Handle button click for services in the settings.
      .delegate('.auth', 'click', function (evt) {
        var node = evt.target,
          domain = node.getAttribute('data-domain');

        //Make sure to bring the user back to this service if
        //the auth is successful.
        store.lastSelection = domains[domain].selectionName;

        oauth(domain, function (success) {
          if (success) {
            dispatch.pub('accountsChanged', null, opener);
            //Paranoid that the postMessage will be canceled if reload
            //is called too quickly, so using a setTimeout.
            setTimeout(function () {
              location.reload();
            }, 200);
          } else {
            showStatus('statusOAuthFailed');
          }
        });
      })
      //Hook up remove buttons to remove an account
      .delegate('.remove', 'click', function (evt) {
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
            dispatch.pub('accountsChanged', null, opener);
            //Paranoid that the postMessage will be canceled if reload
            //is called too quickly, so using a setTimeout.
            setTimeout(function () {
              location.reload();
            }, 200);
          },
          error: function (xhr, textStatus, err) {
            showStatus('statusError', err);
          }
        });

        //Remove any cached data
        if (domain === 'google.com' && store.gmailContacts) {
          delete store.gmailContacts;
        }
        if (domains[domain].selectionName === store.lastSelection) {
          delete store.lastSelection;
        }

        evt.preventDefault();
      });

    // create ellipsis for gecko
    $(function () {
      $(".overflow").textOverflow(null, true);
    });
    
    // tabs
    $("#settings").hide();
    
    $("ul#tabs li").click(function () {
      $(this).addClass("selected");
      $(this).siblings().removeClass("selected");
    });

    $("ul#tabs li.manage").click(function () {
      if ($("#manage").is(":hidden")) {
        $("#manage").fadeIn(200);
        $("#manage").siblings().fadeOut(0);
      }
    });
    
    $("ul#tabs li.settings").click(function () {
      if ($("#settings").is(":hidden")) {
        $("#settings").fadeIn(200);
        $("#settings").siblings().fadeOut(0);
      }
    });
  });  
});