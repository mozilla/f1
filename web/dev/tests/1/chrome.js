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
/*global define: false, window: false, console: false, localStorage: false,
  location: true */
"use strict";

define(['jquery', 'dispatch'], function ($, dispatch) {

  // debug
  window.addEventListener('message', function (evt) {
    console.log("GOT POSTMESSAGE: ", evt.data, evt);
  }, false);

  var sub = dispatch.sub,
      testWindow, chrome,
      dataStore = (localStorage.chromeTestStore &&
                   JSON.parse(localStorage.chromeTestStore)) || {},
      origin = location.protocol + "//" + location.host,
      panelUrl = '../../1/share/panel/#test';

  // expose the data store for inspection in firebug
  window.dataStore = dataStore;

  if (location.hash === '#settings') {
    document.documentElement.className = 'settings';
    panelUrl = '../../1/settings/#test';
  }


  chrome = {
    saveStore: function () {
      localStorage.chromeTestStore = JSON.stringify(dataStore);
    },

    logStore: function () {
      console.log('Chrome dataStore: ', dataStore);
    },

    clearStore: function () {
      delete localStorage.chromeTestStore;
      dataStore = {};
    },

    loadPanel: function () {
      testWindow.location = panelUrl;
    },

    reloadPanel: function () {
      testWindow.location.reload(true);
    }

  };


  // Helpers that deal with the target window subscriptions.
  function targetPub(topic, data) {
    dispatch.pub(topic, data, testWindow);
  }

  // Listen for the event that the panel will give in test mode.
  sub('registerForTests', function () {

    var subs = {
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

      sizeToContent: function () {
        var rect = testWindow.document.documentElement.getBoundingClientRect(),
            iframe = $('#testFrame')[0];

        iframe.style.width = rect.width + 'px';
        iframe.style.height = rect.height + 'px';
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
        chrome.saveStore();
        targetPub('storeNotifyChange', {
          key: data.key,
          value: data.value
        });
      },

      storeRemove: function (key) {
        delete dataStore[key];
        chrome.saveStore();
        targetPub('storeNotifyChange', {
          key: key,
          value: null
        });
      }
    };

    // register all events.
    testWindow.addEventListener('message', function (evt) {
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
            // by play of topics going through the testWindow.
            console.log("Unhandled topic: " + message.topic, message.data);
          }
        }
      }
    }, false);

  });

  window.addEventListener('load', function (evt) {
    testWindow = $('#testFrame')[0].contentWindow;

    // load the share panel
    chrome.loadPanel();

    // bind some event listeners, these just bind button IDs to trigger
    // the same-named method on this chrome module.
    $('body').delegate('#chromeActions button', 'click', function (evt) {
      var id = evt.target.id;
      if (id && chrome[id]) {
        chrome[id]();
      }

      evt.preventDefault();
    });
  }, false);

  // There is a chance it is already ready (particularly in webkit),
  // so try to grab it now.
  testWindow = $('#testFrame');
  if (testWindow && (testWindow = testWindow[0])) {
    testWindow = testWindow.contentWindow;
    chrome.loadPanel();
  } else {
    testWindow = null;
  }

  // Return a module, then accessible via commandline as
  // require('chrome')
  return chrome;
});
