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

/*jslint plusplus: false */
/*global require: false, location: true, window: false, alert: false */
"use strict";

var linkify = function(text) {
  // linkify full urls
  text = text.replace(/http(s)?:\S+/g, '<a class="link" href="$&" target="_blank">$&</a>');
  // linkify twitter usernames
  text = text.replace(/\@(\w+)/g, '<a class="username" type="twitter" title="twitter.com/$1" href="http://twitter.com/$1" target="_blank">@$1</a>');
  // linkify twitter hash tags
  return text.replace(/\#(\w+)/g, "<a class='tag' type='twitter' title='search twitter.com for tag #$1' href='http://search.twitter.com/search?q=%23$1' target='_blank'>#$1</a>");
}

require.def("history",
        ["require", "jquery", "blade/fn", "rdapi", "blade/jig"],
function (require,   $,        fn,         rdapi,   jig) {

    jig.addFn({getMedium: function(domain) {
        if (domain == 'twitter.com') return 'twitter';
        if (domain == 'facebook.com') return 'facebook';
        if (domain == 'google.com') return 'google';
        }});

    rdapi('history/get', {
        success: function (json) {
            if (json.error) {
                $('#content').append(jig('#error', json.error));
            } else {
                $('#content').append(jig('#history', json));
                $(".body").each(function() {
                  $(this).html(linkify($(this).text()));
                });
           }
        }
    });
});
