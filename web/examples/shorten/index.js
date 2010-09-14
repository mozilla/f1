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

require.def("shorten",
        ["require", "jquery", "blade/fn", "rdapi", "placeholder", "blade/url"],
function (require,   $,        fn,         rdapi,   placeholder,   url) {
    function sendMessage(url) {
        rdapi('links/shorten', {
            type: 'POST',
            data: {
                url: url,
            },
            success: function (json) {
                rdapi('links/sign', {
                    type: 'POST',
                    data: {
                        'shorturl': json['result']['short_url'],
                        'from': "jn.rlly@gmail.com",
                        'to': "david.ascher@gmail.com",
                    },
                    success: function(json) {
                    },
                    error: function(json) {
                    }
                });
                $(".success").removeClass("hidden")
                var short_url = json.result['short_url'];
                $("#short").html("<span>short URL is: <a href='" + short_url + "'>" + short_url + "</a>");
            },
            error: function (xhr, textStatus, err) {
                $("#resultMsg").removeClass("hidden")
                $("#resultReason").text("XHR Error: "+err)
            }
        }); 
    }

    $(function () {

        $("#messageForm")
            .submit(function (evt) {
                //First clear old errors
                $(".error").addClass("invisible");
                var form = evt.target;
                var url = form.url.value;
                sendMessage(url);
                return false;
            });
    });
});
