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

require.def("send",
        ["require", "jquery", "blade/fn", "rdapi", "blade/url"],
function (require,   $,        fn,         rdapi,   url) {

    var hash = location.href.split('#')[1],
        options = {
            services: {}
        };

    if (hash) {
        options = url.queryToObject(hash);
        if (options.services) {
            options.services = JSON.parse(options.services);
        }
    }

    //TODO: Call linkdrop account API first, to see if that works.
    
    //Try twitter API if have a twitter name
    var twitter = options.services.Twitter;
    if (twitter && twitter.usernames) {
        var userName = twitter.usernames[0];
        $.getJSON('http://api.twitter.com/1/users/show.json?callback=?&screen_name=' +
                  encodeURIComponent(userName), function (json) {
            $('#twitter')
                .find('img.avatar').attr('src', json.profile_image_url).end()
                .find('.username').html(json.name);
        });
    }

    $(document).ready(function() {
        $("#tabs").tabs({ fx: { opacity: 'toggle', duration: 200 } });

        $('.message').val(location.href);
    });
});
