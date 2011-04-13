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

/*jslint indent: 2, plusplus: false */
/*global define: false, window: false, location: true, localStorage: false,
  opener: false, setTimeout: false, setInterval: false, document: false */
"use strict";

// Allow tests to plug into the page by notify them if this is a test.
if (location.hash === '#test') {
  parent.postMessage(JSON.stringify({topic: 'registerForTests'}),
                     location.protocol + "//" + location.host);
}

define([ "require", "jquery", "blade/fn", "rdapi", "oauth", "blade/jig",
         "dispatch", "storage", "accounts", "blade/url",
         "services", "placeholder", "jquery.textOverflow"],
function (require,   $,        fn,         rdapi,   oauth,   jig,
          dispatch,   storage,   accounts,   url,
          services,   placeholder) {
  var store = storage(),
      existingAccounts = {};

  jig.addFn({
    domainType: function (account) {
      var domain = services.domains[account.accounts[0].domain];
      return domain ? domain.type : '';
    },
    domainName: function (account) {
      var domain = services.domains[account.accounts[0].domain];
      return domain ? domain.name : '';
    },
    accountName: function (displayName, account) {
      return account.username && account.username !== displayName ? displayName + ", " + account.username : displayName;
    }
  });

  function clearStatus() {
    $('div.status').addClass('hidden');
  }

  function showStatus(statusId, message) {
    clearStatus();
    $('#' + statusId).removeClass('hidden');

    if (message) {
      $('#' + statusId + ' .message').text(message);
    }
  }

  //Set up knowledge of accounts and changes.
  accounts.onChange();
  accounts(function (json) {
      $(function () {
        var html = '';

        json.forEach(function (account) {
          // protect against old style account data
          if (typeof(account.profile) === 'undefined') {
            return;
          }
          html += jig('#accountTemplate', account.profile);

          // remember which accounts already have an entry
          existingAccounts[account.profile.accounts[0].domain] = true;
        });

        //Generate UI for each list.
        if (html) {
          $('#existingHeader').removeClass('hidden');
          $('#existing')
            .append(html)
            .removeClass('hidden');
        }

        html = '';
        services.domainList.forEach(function (domain) {
          var data = services.domains[domain];
          data.domain = domain;
          data.enableSignOut = !data.forceLogin && existingAccounts[domain];
          html += jig('#addTemplate', services.domains[domain]);
        });

        if (html) {
          $('#availableHeader').removeClass('hidden');
          $('#available')
            .append(html)
            .removeClass('hidden');
        }
      });
    }
  );

  $(function () {

    $('body')
      //Handle button click for services in the settings.
      .delegate('#addForm', 'submit', function (evt) {
        evt.preventDefault();

        var node = evt.target,
          domain = $('#available').val(),
          selectionName;

        // If the default option selected which has no domain value is
        // used, just return without doing anything.
        if (!domain) {
          return;
        }

        selectionName = services.domains[domain].type;

        clearStatus();

        oauth(domain, existingAccounts[domain], function (success) {
          if (success) {
            //Make sure to bring the user back to this service if
            //the auth is successful.
            store.set('lastSelection', selectionName);
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

        try {
          clearStatus();
          accounts.remove(domain, userId, userName);
        } catch (e) {
          // clear out account storage
          accounts.clear();
        }
        evt.preventDefault();
      });

    // create ellipsis for gecko
    $(function () {
      $(".overflow").textOverflow(null, true);
    });
  });
});
