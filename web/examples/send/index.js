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
        ["require", "jquery", "blade/fn", "rdapi", "placeholder", "blade/url"],
function (require,   $,        fn,         rdapi,   placeholder,   url) {

    var validHashRegExp = /^\w+$/;

    function onHashChange() {
        var value = location.hash.split("#")[1],
            start, end;

        value = value || "send";

        if (validHashRegExp.test(value)) {
            $(".section").each(function (i, node) {
                node = $(node);
                if (node.hasClass(value)) {
                    end = node;
                } else if (!node.hasClass("hidden")) {
                    start = node;
                }
            });
        }
        if (value==="auth_failure") {
            reauthorize();
        } else if (value==="auth_success") {
            // XXX should we automatically resend?
            var domain = localStorage['X-Send-Domain'];
            var message = localStorage['X-Send-Message'];
            var radio = document.messageForm.domain;
            for(var i = 0; i < radio.length; i++) {
                if(radio[i].value==domain) {
                    radio[i].checked = true;
                }
            }
            document.messageForm.message.value = message;
            sendMessage();
        }

        //Animate!
        if (start) start.addClass("hidden");
        if (end) end.removeClass("hidden")
    }

    //Set up hashchange listener
    window.addEventListener("hashchange", onHashChange, false);

    function reauthorize() {
        document.authForm.domain.value = localStorage['X-Send-Domain']
        document.authForm.submit()
        console.log("submitted auth form...")
    }

    function sendMessage() {
        var domain = localStorage['X-Send-Domain'];
        var message = localStorage['X-Send-Message'];
        rdapi('send', {
            type: 'POST',
            data: {
                domain: domain,
                message: message,
                to: localStorage['X-Send-To'],
                subject: localStorage['X-Send-Subject']
            },
            success: function (json) {
                // {'reason': u'Status is a duplicate.', 'provider': u'twitter.com'}
                $("#resultMsg").removeClass("hidden")
                if (json['error'] && json['error']['reason']) {
                    $("#resultReason").text("Error: "+json['error']['reason']);
                    var code = json['error']['code']
                    if (code == 400 || code ==  401 || code == 403 || code >= 530) {
                        reauthorize();
                    }
                }
                else {
                    $("#resultReason").text("Message Sent");
                    localStorage['X-Send-Domain'] = '';
                    localStorage['X-Send-Message'] = '';
                    localStorage['X-Send-To'] = '';
                    localStorage['X-Send-Subject'] = '';
                }
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
    
                //Make sure all form elements are trimmed and username exists.
                $.each(form.elements, function (i, node) {
                    var trimmed = node.value.trim();
                    
                    if (node.getAttribute("placeholder") === trimmed) {
                        trimmed = "";
                    }

                    node.value = trimmed;
                });
   
                localStorage['X-Send-To'] = form.to.value;
                localStorage['X-Send-Subject'] = form.subject.value;
                localStorage['X-Send-Message'] = form.message.value;
                var radio = form.domain;
                for(var i = 0; i < radio.length; i++) {
                    if(radio[i].checked) {
                        localStorage['X-Send-Domain'] = radio[i].value;
                    }
                }
                sendMessage();
                return false;
            })
            .each(function (i, node) {
                placeholder(node);
            });

        //Make sure we set up initial state
        onHashChange();
    });
});
