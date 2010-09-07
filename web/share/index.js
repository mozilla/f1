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
        ["require", "jquery", "blade/fn", "rdapi", "blade/url", "placeholder"],
function (require,   $,        fn,         rdapi,   url,         placeholder) {

    var svcOptions = {
            'twitter': true,
            'facebook': true,
            'gmail': true
        },
        hash = location.href.split('#')[1],
        options = {
            services: null
        },
        twitter, userName;

    if (hash) {
        options = url.queryToObject(hash);
        if (options.services) {
            options.services = JSON.parse(options.services);
        }
        if (options.previews) {
            options.previews = JSON.parse(options.previews);
        }
        if (!options.title) {
            options.title = options.url;
        }
    }

    //TODO: Call linkdrop account API first, to see if that works.

    //Try twitter API if have a twitter name
    twitter = options.services && options.services.Twitter;
    if (twitter && twitter.usernames) {
        userName = twitter.usernames[0];
        $.getJSON('http://api.twitter.com/1/users/show.json?callback=?&screen_name=' +
                  encodeURIComponent(userName), function (json) {
            $('#twitter')
                .find('img.avatar').attr('src', json.profile_image_url).end()
                .find('.username').html(json.name);
        });
    }

    $(function () {
        var tabDom = $("#tabs"),
            selection = '#settings',
            services = options.services,
            param;

        //Set up tabs.
        tabDom.tabs({ fx: { opacity: 'toggle', duration: 200 } });

        //Choose a tab to show. Use the first service found in services.
        //Warning: this is not completely reliable given a for..in loop
        //over an object, which does not guarantee key order across browsers.
        if (services) {
            for (param in services) {
                if (param in svcOptions) {
                    selection = '#' + param;
                }
            }
        }
        tabDom.tabs('select', selection);

        //Set up the URL in all the message containers
        if (options.url) {
            $('.message').val(options.url);
        }

        //For the title in facebook, set it to the page title
        if (options.title) {
            $('#title, #subject').val(options.title);
        }
    });
    

    function reauthorize() {
        var domain = localStorage['X-Send-Domain'];
        var win = window.open("http://127.0.0.1:5000/send/auth.html?domain="+domain,
                            "Firefox Share OAuth",
                            "dialog=yes, modal=yes, width=800, height=480");
    }

    function sendMessage() {
        var domain = localStorage['X-Send-Domain'];
        var message = localStorage['X-Send-Message'];
        rdapi('send', {
            type: 'POST',
            data: {
                domain: domain,
                message: message
            },
            success: function (json) {
                // {'reason': u'Status is a duplicate.', 'provider': u'twitter.com'}
                if (json['error'] && json['error']['reason']) {
                    $("#resultReason").text("Error: "+json['error']['reason']);
                    var code = json['error']['code'];
                    if (code ==  401 || code == 400) {
                        reauthorize();
                    }
                }
                else {
                    $("#resultReason").text("Message Sent");
                    localStorage['X-Send-Domain'] = '';
                    localStorage['X-Send-Message'] = '';
                }
            },
            error: function (xhr, textStatus, err) {
                $("#resultReason").text("XHR Error: "+err)
            }
        });
    }
    window.sendMessage = sendMessage;

    $(function () {

        $(".messageForm")
            .submit(function (evt) {
                //First clear old errors
                $(".error").addClass("invisible");

                var form = evt.target;
    
                //Make sure all form elements are trimmed and username exists.
                $.each(form.elements, function (i, node) {
                    var trimmed = node.value.trim();
                    
                    if (node.getAttribute("placeholder") === trimmed) {
                        trimmed = "";
                    }

                    node.value = trimmed;
                });
   
                localStorage['X-Send-Message'] = form.message.value;
                localStorage['X-Send-Domain'] = form.domain.value;
                sendMessage();
                return false;
            })
            .each(function (i, node) {
                placeholder(node);
            });
    });
});
