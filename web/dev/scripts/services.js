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
/*global define: false, window: false, location: true, localStorage: false,
  opener: false, setTimeout: false */

'use strict';

define([ 'rdapi', "blade/url", "TextCounter"],
function (rdapi,   url,         TextCounter) {

  var options = url.queryToObject(location.href.split('#')[1] || '') || {},
  showNew = options.show === 'new';

  function svcBase(name, options) {
    if (!name) {
        return;
    }
    this.name = name;
    this.type = name.replace(/\s/g,'').toLowerCase();
    this.tabName = this.type+'Tab';
    this.icon = 'i/'+this.type+'Icon.png';
    this.shorten = false;
    this.autoCompleteWidget = null;

    // set options
    this.features = {
      counter: false,
      direct: false,
      subject: false
    }

    for (var i in options) {
      this[i] = options[i];
    }
  }
  svcBase.constructor = svcBase;
  svcBase.prototype = {
    clearCache: function(store) {
      delete store[this.type+'Contacts'];
    },
    getContacts: function(store) {
      if (store[this.type+'Contacts'])
        return JSON.parse(store[this.type+'Contacts']);
      return null;
    },
    setContacts: function(store, contacts) {
      store[this.type+'Contacts'] = JSON.stringify(contacts);
    },
    getFormattedContacts: function(entries) {
      var data = {};
      entries.forEach(function (entry) {
        if (entry.accounts && entry.accounts.length) {
          entry.accounts.forEach(function (account) {
            data[entry.displayName] = {
              email: '',
              userid: account.userid,
              username: account.username
            };
          });
        }
      });
      return data;
    }
  };

  /* common functionality for email based services */
  function emailSvcBase() {
    svcBase.constructor.apply(this, arguments);
    this.features.direct = true;
    this.features.subject = true;
  };
  emailSvcBase.prototype = new svcBase();
  emailSvcBase.constructor = emailSvcBase;
  emailSvcBase.prototype.validate = function (sendData) {
    if (!sendData.to || !sendData.to.trim()) {
      showStatus('statusToError');
      return false;
    }
    return true;
  };
  emailSvcBase.prototype.getFormattedContacts = function(entries) {
    var data = {};
    entries.forEach(function (entry) {
      if (entry.emails && entry.emails.length) {
        entry.emails.forEach(function (email) {
          var displayName = entry.displayName ? entry.displayName : email.value;
          data[displayName] = {
              email: email.value,
              userid: null,
              username: null
            };
        });
      }
    });
    return data;
  }

  var svcs = {
    showNew: showNew,
    domains: {
      'twitter.com': new svcBase('Twitter', {
        features: {
          direct: true,
          subject: false,
          counter: true
        },
        textLimit: 140,
        shorten: true,
        serviceUrl: 'http://twitter.com',
        revokeUrl: 'http://twitter.com/settings/connections',
        signOutUrl: 'http://twitter.com/logout',
        accountLink: function (account) {
          return 'http://twitter.com/' + account.username;
        }
      }),
      'facebook.com': new svcBase('Facebook', {
        features: {
          direct: true,
          subject: false,
          counter: true
        },
        textLimit: 420,
        serviceUrl: 'http://facebook.com',
        revokeUrl: 'http://www.facebook.com/editapps.php?v=allowed',
        signOutUrl: 'http://facebook.com',
        accountLink: function (account) {
          return 'http://www.facebook.com/profile.php?id=' + account.userid;
        }
      }),
      'google.com': new emailSvcBase('Gmail', {
        serviceUrl: 'https://mail.google.com',
        revokeUrl: 'https://www.google.com/accounts/IssuedAuthSubTokens',
        signOutUrl: 'http://google.com/preferences',
        accountLink: function (account) {
          return 'http://google.com/profiles/' + account.username;
        }
      }),
      'googleapps.com': new emailSvcBase('Google Apps', {
        icon: 'i/gmailIcon.png',
        serviceUrl: 'https://mail.google.com',
        revokeUrl: 'https://www.google.com/accounts/IssuedAuthSubTokens',
        signOutUrl: 'http://google.com/preferences',
        accountLink: function (account) {
          return 'http://google.com/profiles/' + account.username;
        }
      }),
      'yahoo.com': new emailSvcBase('Yahoo', {
        name: 'Yahoo!',
        serviceUrl: 'http://mail.yahoo.com', // XXX yahoo doesn't have ssl enabled mail?
        revokeUrl: 'https://api.login.yahoo.com/WSLogin/V1/unlink',
        signOutUrl: 'https://login.yahoo.com/config/login?logout=1',
        accountLink: function (account) {
          return 'http://profiles.yahoo.com/' + account.username;
        }
      }),
      'linkedin.com': new svcBase('LinkedIn', {
        features: {
          direct: true,
          subject: true,
          counter: false
        },
        serviceUrl: 'http://linkedin.com',
        revokeUrl: 'http://linkedin.com/settings/connections',
        signOutUrl: 'http://linkedin.com/logout',
        accountLink: function (account) {
          return 'http://linkedin.com/' + account.username;
        }
      })
    },
    domainList: []
  };

  for (var i in svcs.domains) {
    svcs.domainList.push(i);
  }

  return svcs;
});
