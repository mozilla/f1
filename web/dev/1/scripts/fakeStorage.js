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
/*global define: false, localStorage: false, location: false, console: false,
  window: false */
"use strict";

/**
 * This module sets up a localStorage storage provider, to allow dev/testing
 * the UI without needing the chrome storage. It is only loaded if the
 * page that includes it explicitly loads it, currently done by setting
 * the URL fragment ID to #test.
 */

define(['dispatch'], function (dispatch) {

  var sub = dispatch.sub,
    dataStore = (localStorage.chromeTestStore &&
                 JSON.parse(localStorage.chromeTestStore)) || {},
    origin = location.protocol + "//" + location.host,
    subs;

  // Helpers that deal with the target window subscriptions.
  function targetPub(topic, data) {
    dispatch.pub(topic, data);
  }

  function saveStore() {
    localStorage.chromeTestStore = JSON.stringify(dataStore);
  }

  subs = {
    panelReady: function () {
      targetPub('shareState', {
        status: 0,
        open: true,
        options: {
          version: '0.7.2',
          title: 'Firefox web browser',
          description: 'All about firefox',
          medium: null,
          source: null,
          url: 'http://www.mozilla.com/en-US/firefox/fx/',
          canonicalUrl: null,
          shortUrl: null,
          previews: [{
            http_url: 'http://mozcom-cdn.mozilla.net/img/firefox-100.jpg'
          }],
          siteName: '',
          prefs: {
            system: 'dev',
            bookmarking: true,
            use_accel_key: true
          }
        }
      });
    },

    storeGet: function (key) {
      var value = dataStore[key];
      //JSON wants null.
      if (value === undefined) {
        value = null;
      }
      targetPub('storeGetReturn', {
        key: key,
        value: value
      });
    },

    storeSet: function (data) {
      dataStore[data.key] = data.value;
      saveStore();
      targetPub('storeNotifyChange', {
        key: data.key,
        value: data.value
      });
    },

    storeRemove: function (key) {
      delete dataStore[key];
      saveStore();
      targetPub('storeNotifyChange', {
        key: key,
        value: null
      });
    }
  };

  // register all events.
  window.addEventListener('message', function (evt) {
    if (evt.origin === origin) {
      var message;
      try {
        message = JSON.parse(evt.data);
      } catch (e) {
        console.error('Could not JSON parse: ' + evt.data);
      }

      if (message && message.topic) {
        if (subs[message.topic]) {
          subs[message.topic](message.data);
        } else {
          // actually quite a few of these, uncomment if you want a play
          // by play of topics going through the window.
          //console.log("Unhandled topic: " + message.topic, message.data);
        }
      }
    }
  }, false);

});
