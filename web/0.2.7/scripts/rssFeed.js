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
/*global define: false, window: false, document: false */
"use strict";

define([], function () {

  var masterCallback;

  //Callback handler for JSONP feed response from Google.
  window.onRssFeedLoad = function (x, data) {
    var title, link, i, entry;
    if (data && data.feed && data.feed.entries) {
      for (i = 0; (entry = data.feed.entries[i]); i++) {
        if (entry.categories && entry.categories.indexOf('Sharing') !== -1) {
          link = entry.link;
          title = entry.title;
          break;
        }
      }
    }

    if (link && masterCallback) {
      masterCallback(title, link);
    }
  };

  /**
   * Fetches RSS feed and gives back the title and link for the first
   * "Sharing" category RSS feed entry. Calls the callback with the
   * string values for title and link as function arguments.
   * Only calls the callback if there is a match found.
   * @param {Function} callback
   */
  function rssFeed(callback) {
    masterCallback = callback;

    //Fetch the feed.
    var node = document.createElement("script");
    node.charset = "utf-8";
    node.async = true;
    node.src = 'http://www.google.com/uds/Gfeeds?v=1.0&callback=onRssFeedLoad&context=' +
              '&output=json&' +
              'q=http%3A%2F%2Fmozillalabs.com%2Fmessaging%2Ffeed%2F';
    document.getElementsByTagName('head')[0].appendChild(node);
  }

  return rssFeed;
});
