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
/*global location: true, window: false, navigator: false, document: false */
'use strict';

var moz;
(function () {
  var shareUrl = '/share/',
      targetOrigin = location.protocol + "//" + location.host,
      empty = {},
      iframeNode, actions, pageCallback, labs;

  function mixin(target, source, override) {
    //TODO: consider ES5 getters and setters in here.
    for (var prop in source) {
      if (!(prop in empty) && (!(prop in target) || override)) {
        target[prop] = source[prop];
      }
    }
  }

  function notify(topic, data) {
    if (pageCallback) {
      pageCallback(topic, data);
    }
  }

  function onMessage(evt) {
    if (evt.origin === targetOrigin) {
      //Assume pub/sub has JSON data with properties named
      //'topic' and 'data'.
      var message = JSON.parse(evt.data),
          topic = message.topic,
          data = message.data;
      if (actions[topic]) {
        actions[topic](data);
        notify(topic, data);
      }
    }
  }

  actions = {
    shareClose: function (data) {
      window.removeEventListener('message', onMessage, false);
      iframeNode.parentNode.removeChild(iframeNode);
      iframeNode = null;
    },
    shareDone: function (data) {
      actions.shareClose(data);
    }
  };

  //Only do the work if it does not exist.
  //Hmm, some weird things in Firefox 3.6.
  //Wanted to use navigator.mozilla.labs.shareEmbed() or something like that
  //but it does not work across page refreshes.
  if (typeof this.moz === 'undefined' || !moz.labs) {
    if (typeof moz === 'undefined') {
      moz = {};
    }

    labs = moz.labs || (moz.labs = {});

    labs.shareEmbed = function (options, callback) {
      //Do not bother if already showing the iframe.
      if (iframeNode) {
        return;
      }
      pageCallback = callback;

      iframeNode = document.createElement('iframe');
      mixin(iframeNode.style, {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '114px',
        border: 0,
        zIndex: 1000,
        MozTransitionProperty: 'height',
        MozTransitionDuration: '1s',
        WebkitTransitionProperty: 'height',
        WebkitTransitionDuration: '1s'
      }, true);

      iframeNode.src = shareUrl + '#options=' + encodeURIComponent(JSON.stringify(options));
      (document.getElementsByTagName('body')[0] || document.documentElement).appendChild(iframeNode);
      window.addEventListener('message', onMessage, false);
    };
  }

}());
