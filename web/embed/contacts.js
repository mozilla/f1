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
  document: false, setTimeout: false, localStorage: false, parent: false,
  self: false */
"use strict";

require.def('contacts',
        ['jquery', 'dispatch', 'blade/url', 'rdapi', 'accounts', 'oauth', 'blade/jig'],
function ($,        dispatch,   url,         rdapi,   accounts,   oauth,   jig) {
  var store = localStorage,
      options = url.queryToObject(location.href.split('#')[1] || ''),
      targetOrigin = options.origin,
      acct;

  function showStatus(id) {
    alert(id);
  }

  function fetchContacts() {
    rdapi('contacts/' + acct.domain, {
      type: 'POST',
      data: {
        username: acct.username,
        userid: acct.userid,
        startindex: 0,
        maxresults: 500
      },
      success: function (json) {
        dispatch.pub('contacts/receive', json.result.entry, parent, targetOrigin);
      },
      error: function () {
        dispatch.pub('contacts/error', { tryLater: true }, parent, targetOrigin);
      }
    });
  }

  function contactKey() {
    return ['contacts', acct.domain, acct.userid, acct.username, targetOrigin].join('/');
  }

  function main() {
    //Hide all sections.
    $('.section').addClass('hidden');

    //Is user signed in?
    accounts.fetch(
      function (accts) {
        var svcAccount, key;

        if (accts && accts.length) {
          accts.some(function (a) {
            return a.providerName === 'Google' && (svcAccount = a);
          });
        }

        //If no account or no google account, need to prompt for it.
        if (!svcAccount) {
          dispatch.pub('contacts/auth', null, parent, targetOrigin);
          dispatch.pub('contacts/auth');
          return;
        }

        acct = svcAccount.accounts[0];
        key = contactKey();

        //Site is not allowed, prompt user to allow.
        if (!store[key]) {
          dispatch.pub('contacts/allow', null, parent, targetOrigin);
          dispatch.pub('contacts/allow', svcAccount);
          return;
        }

        fetchContacts();
      },
      //Error
      function (err) {
        dispatch.pub('contacts/error', { tryLater: true }, parent, targetOrigin);
      }
    );
  }

  dispatch.sub('contacts/auth', function () {
    $('#auth').removeClass('hidden');
  });

  dispatch.sub('contacts/allow', function (acct) {
    $('#existing').html(jig('#accountTemplate', acct));
    $('#allowDomain').html(targetOrigin);
    $('#allow').removeClass('hidden');
  });

  $(function () {
    //Bind button events.
    $('body')
      .delegate('button.auth[data-domain="google.com"]', 'click', function (evt) {
        oauth('google.com', function (success) {
          if (success) {
            main();
          } else {
            showStatus('statusOAuthFailed');
          }
        });
      })
      .delegate('button.remove[data-domain="google.com"]', 'click', function (evt) {
        var buttonNode = evt.target,
            domain = buttonNode.getAttribute('data-domain'),
            userName = buttonNode.getAttribute('data-username'),
            userId = buttonNode.getAttribute('data-userid');

        //Clear up allow state
        delete store[contactKey()];

        rdapi('account/signout', {
          data: {
            domain: domain,
            userid: userId,
            username: userName
          },
          success: function () {
            main();
          },
          error: function (xhr, textStatus, err) {
            showStatus('statusError', err);
          }
        });

        evt.preventDefault();
      })
      .delegate('#allowYes', 'click', function (evt) {
        store[contactKey()] = true;
        fetchContacts();
      })
      .delegate('#allowNo', 'click', function (evt) {
        dispatch.pub('contacts/close', null, parent, targetOrigin);
      });

    main();
  });
});
