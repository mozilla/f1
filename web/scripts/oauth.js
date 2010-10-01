
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
/*global require: false, window: false, location: false */
"use strict";

require.def("oauth",
function () {
  var authDone, win, lastDomain, lastDomainTime = 0;

  //Handle communication from the auth window, when it completes.
  window.addEventListener("message", function (evt) {
    //TODO: ideally lock down the domain check on evt.origin.
    var status = evt.data;
    if (status) {
      if (status === 'oauth_success') {
        status = true;
      } else {
        status = false;
      }

      //Reset windows
      win = null;
      lastDomain = null;

      if (authDone) {
        authDone(status);
        authDone = null;
      }
    }
  }, false);

  return function oauth(domain, callback) {
    if (callback) {
      authDone = callback;
    }
    var url = location.protocol + "//" + location.host + "/send/auth.html",
        currentTime = (new Date()).getTime();

    //Could have a window handle, but could be closed, so account for it.
    if (win && win.closed) {
      win = null;
    }

    //If got another request for the domain and window has not shown up yet
    //for 5 seconds, or if domain is different, then try window open call.
    //5 seconds is a bit arbitrary, slower systems may have a longer wait,
    //but just trying to reduce the edge cases of seeing multiple windows.
    if ((!win && domain === lastDomain && currentTime > lastDomainTime + 5000) || domain !== lastDomain) {
      lastDomain = domain;
      lastDomainTime = currentTime;
      win = window.open(url + "?domain=" + domain,
        "ffshareOAuth",
        "dialog=yes, modal=yes, width=800, height=480");
      win.focus();
    } else if (win) {
      win.focus();
    }
  };
});
