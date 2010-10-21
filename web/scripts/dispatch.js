/*jslint plusplus: false, indent: 2 */
/*global require: false, location: false, window: false */
"use strict";

/**
 * A module that handles dispatching pub/sub topics, where the underlying
 * dispatch is done by postMessage. This allows for chrome extensions
 * to participate in the pub/sub via postMessage without having to
 * participate in this particular module.
 */
require.def('dispatch',
    ['jquery'],
function ($,    object,     fn) {

  var origin = location.protocol + "//" + location.host;

  return {
    sub: function (topic, callback) {
      var func = function (evt) {
        //Make sure message is from this page.
        if (evt.origin === origin) {
          //Assume pub/sub has JSON data with properties named
          //'topic' and 'data'.
          var message = JSON.parse(evt.data),
            pubTopic = message.topic;
          if (pubTopic && pubTopic === topic) {
            callback(message.data);
          }
        }
      };

      //Should find window.addEventListener in the browser.
      window.addEventListener('message', func, false);

      //return the created function to allow unsubscribing
      return func;
    },

    unsub: function (func) {
      //Should find window.removeEventListener in the browser.
      window.removeEventListener('message', func, false);
    },

    pub: function (topic, data) {
      window.postMessage(JSON.stringify({
        topic: topic,
        data: data
      }), origin);
    }
  };
});
