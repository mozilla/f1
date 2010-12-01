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
/*global require: false */
"use strict";

require.def("index",
        ["require", "jquery", "blade/fn", "rdapi", "oauth", "blade/jig",
         "jquery.colorFade", "jquery.textOverflow"],
function (require,   $,        fn,         rdapi,   oauth,   jig) {


  var domainList = [
        'twitter.com', 'facebook.com', 'google.com', 'googleapps.com', 'yahoo.com'
      ],
      domains = {
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
          type: 'googleapps',
          name: 'Google Apps',
          serviceUrl: 'https://mail.google.com',
          revokeUrl: 'https://www.google.com/accounts/IssuedAuthSubTokens',
          signOutUrl: 'http://google.com/preferences'
        },
        'yahoo.com': {
          medium: 'yahoo',
          name: 'Yahoo!',
          serviceUrl: 'http://mail.yahoo.com', // XXX yahoo doesn't have ssl enabled mail?
          revokeUrl: 'https://api.login.yahoo.com/WSLogin/V1/unlink',
          signOutUrl: 'https://login.yahoo.com/config/login?logout=1'
        }
      };

  function showStatus(statusId, message) {
//TODO
    $('div.status').addClass('hidden');
    clickBlockDom.removeClass('hidden');
    $('#' + statusId).removeClass('hidden');
  
    if (message) {
      $('#' + statusId + 'Message').text(message);
    }
  }



  rdapi('account/get', {
    success: function (json) {
      if (json.error) {
        json = [];
      }

      //Generate the page.
      
///>>> I am here.
    },
    error: function (xhr, textStatus, err) {
      if (xhr.status === 503) {
        showStatus('statusServerBusyClose');
      } else {
        showStatus('statusServerError', err);
      }
    }
  });





    $(document).ready(function($) {
        
        // resize wrapper
        $(window).bind("load resize", function(){
            var h = $(window).height();
            $("#wrapper").css({ "min-height" : (h) });
        });
        
        // flash new stuff yellow
        $(function() {
            $("ul.add").animate( { backgroundColor: '#ffff99' }, 200)
                .delay(1000).animate( { backgroundColor: '#fafafa' }, 3000);
        });
        
        // create ellipsis for gecko
        $(function() {
            $(".overflow").textOverflow(null,true);
        });
        
        // tabs
        $("#settings").hide();
        
        $("ul#tabs li").click(function() {
            $(this).addClass("selected");
            $(this).siblings().removeClass("selected");
        });
    
        $("ul#tabs li.manage").click(function() {
            if ($("#manage").is(":hidden")) {
                $("#manage").fadeIn(200);
                $("#manage").siblings().fadeOut(0);
            }
            else {
                $("#manage").noop();
            }
        });
        
        $("ul#tabs li.settings").click(function() {
            if ($("#settings").is(":hidden")) {
                $("#settings").fadeIn(200);
                $("#settings").siblings().fadeOut(0);
            }
            else {
                $("#settings").noop();
            }
        });
    
        // done!
    });  
/*
  <div id="settings" class="ui-tabs-hide">
    <div class="hbox messageForm">
      <ul class="boxFlex">
        <li>
          <h1><span class="accountIcon twitterIcon"></span> Twitter</h1>
          <span data-domain="twitter.com"></span>
        </li>
        <li>
          <h1><span class="accountIcon facebookIcon"></span> Facebook</h1>
          <span data-domain="facebook.com"></span>
        </li>
        <li class="gmailSettings">
          <h1><span class="accountIcon gmailIcon"></span> Gmail</h1>
          <span data-domain="google.com"></span>
        </li>
        <li class="googleappsSettings">
          <h1><span class="accountIcon gmailIcon"></span> Google Apps</h1>
          <span data-domain="googleapps.com"></span>
        </li>
        <li class="yahooSettings">
          <h1><span class="accountIcon yahooIcon"></span> Yahoo!</h1>
          <span data-domain="yahoo.com"></span>
        </li>
      </ul>

      <div class="config">
        <ul>
            <li><input type="checkbox" id="bookmark"> <label for="bookmark">Bookmark shared links</label></li>
            <li><input type="checkbox" id="signature"> <label for="signature">Include F1 email signature</label></li>
            <li><input type="checkbox" id="shortcut"> <label for="shortcut">Enable keyboard shortcut (F1)</label></li>
        </ul>
      </div>
    </div>
  </div>


  function updateAccountButton(domain) {
    $('#settings span[data-domain="' + domain + '"]').empty().append(jig('#addAccountTemplate', domain));

    //Also be sure the account tab is hidden.
    $('.' + actions[domain].tabName).addClass('hidden');
  }


      //Replace the Add button in settings tab to show the user instead
      $('#settings span[data-domain="' + svcAccount.domain + '"]').empty().append(jig('#accountTemplate', account));



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
*/
});
