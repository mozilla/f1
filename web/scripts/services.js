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
/*global require: false, window: false, location: true, localStorage: false,
  opener: false, setTimeout: false */

'use strict';

require.def('services',
        ['rdapi', "blade/url"],
function (rdapi,   url) {

  var options = url.queryToObject(location.href.split('#')[1] || '') || {},
  showNew = options.show === 'new',
  svcs = {
    showNew: showNew,
    domains: {
      'linkedin.com': {
        type: 'linkedin',
        name: 'LinkedIn',
        tabName: 'linkedinTab',
        icon: 'i/linkedinIcon.png',
        serviceUrl: 'http://linkedin.com',
        revokeUrl: 'http://linkedin.com/settings/connections',
        signOutUrl: 'http://linkedin.com/logout',
        accountLink: function (account) {
          return 'http://linkedin.com/' + account.username;
        },
        validate: function (sendData) {
          return true;
        },
        getFormData: function () {
          var message = $('#linkedin').find('textarea.message').val().trim() || '';
          return {
            message: message
          };
        },
        restoreFormData: function (data) {
          if (data.message) {
            $('#linkedin').find('textarea.message').val(data.message);
          }
        },
        clearCache: function(store) {
            
        }
      },
      'twitter.com': {
        name: 'Twitter',
        tabName: 'twitterTab',
        type: 'twitter',
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
        },
        clearCache: function(store) {
            
        }
      },
      'facebook.com': {
        name: 'Facebook',
        tabName: 'facebookTab',
        type: 'facebook',
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
        },
        clearCache: function(store) {
            
        }
      },
      'google.com': {
        name: 'Gmail',
        tabName: 'gmailTab',
        type: 'gmail',
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
        },
        clearCache: function(store) {
          if (store.gmailContacts)
            delete store.gmailContacts;
        }
      },
      'googleapps.com': {
        name: 'Google Apps',
        tabName: 'googleAppsTab',
        type: 'googleapps',
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
        },
        clearCache: function(store) {
            
        }
      },
      'yahoo.com': {
        name: 'Yahoo!',
        tabName: 'yahooTab',
        type: 'yahoo',
        icon: 'i/yahooIcon.png',
        serviceUrl: 'http://mail.yahoo.com', // XXX yahoo doesn't have ssl enabled mail?
        revokeUrl: 'https://api.login.yahoo.com/WSLogin/V1/unlink',
        signOutUrl: 'https://login.yahoo.com/config/login?logout=1',
        accountLink: function (account) {
          return 'http://profiles.yahoo.com/' + account.username;
        },
        validate: function (sendData) {
          if (!sendData.to || !sendData.to.trim()) {
            showStatus('statusToError');
            return false;
          }
          return true;
        },
        getFormData: function () {
          var dom = $('#yahoo'),
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
          var dom = $('#yahoo');
          if (data.to) {
            dom.find('[name="to"]').val(data.to);
          }
          if (data.subject) {
            dom.find('[name="subject"]').val(data.subject);
          }
          if (data.message) {
            dom.find('textarea.message').val(data.message);
          }
        },
        clearCache: function(store) {
            
        }
      }
    },
    domainList: []
  };

  for (var i in svcs.domains) {
    svcs.domainList.push(i);
  }
  
  return svcs;
});
