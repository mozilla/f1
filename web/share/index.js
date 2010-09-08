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
        urlArgs,
        options = {
            services: null
        },
        userName, tabDom,
        previewWidth = 90, previewHeight = 70;

    function resizePreview(evt) {
        var imgNode = evt.target,
            width = imgNode.width,
            height = imgNode.height;

        if (height > width) {
            imgNode.height = previewHeight;
        } else {
            imgNode.width = previewWidth;
        }
    }

    function getServiceUserName(serviceName) {
        var service = options.services && options.services[serviceName];
        return (service && service.usernames && service.usernames[0]) || null;
    }
    
    function updateServiceDisplayName(service) {
        var userName = getServiceUserName(service);
        if (userName) {
            $(function () {
                $('#' + service).find('.username').text(userName);
            });
        }
    }

    function updateAccountDisplay(service, account) {
        $(function () {
            var name = account.displayName,
                photo = account.photos && account.photos[0] && account.photos[0].value,
                serviceDom = $('#' + service);

            if (name) {
                serviceDom.find('.username').text(name);
            }
            if (photo) {
                serviceDom.find('.avatar').attr('src', photo);
            }
            serviceDom.find('div.user').removeClass('inactive');
        });
    }

    function updateAccounts(accounts) {
        var services = options.services,
            userAccounts = {}, twitter, selection, param;

        if ((accounts && accounts.length) || services) {
            //Figure out what accounts we do have
            accounts.forEach(function (account) {
                var name = account.accounts[0].domain;
                if (name) {
                    name = name.split('.');
                    name = name[name.length - 2];
                    if (name === 'google') {
                        name = 'gmail';
                    }
                    userAccounts[name] = account;
                }
            });
    
            if (userAccounts.twitter) {
                updateAccountDisplay('twitter', userAccounts.twitter);
            } else {
                //Try twitter API if have a twitter name
                twitter = getServiceUserName('twitter');
                if (twitter) {
                    $.getJSON('http://api.twitter.com/1/users/show.json?callback=?&screen_name=' +
                              encodeURIComponent(twitter), function (json) {
                        $(function () {
                            $('#twitter')
                                .find('img.avatar').attr('src', json.profile_image_url).end()
                                .find('.username').text(json.name);
                        });
                    });
                }
            }
    
            if (userAccounts.facebook) {
                updateAccountDisplay('facebook', userAccounts.facebook);
            } else {
                updateServiceDisplayName('facebook');
            }
    
            if (userAccounts.gmail) {
                updateAccountDisplay('gmail', userAccounts.gmail);
            } else {
                updateServiceDisplayName('gmail');
            }
        }

        //Choose a tab to show. Use the first service found in services.
        //Warning: this is not completely reliable given a for..in loop
        //over an object, which does not guarantee key order across browsers.
        if (services) {
            for (param in services) {
                if (param in svcOptions) {
                    selection = '#' + param;
                    break;
                }
            }
        }
        if (!selection) {
            for (param in userAccounts) {
                if (param in svcOptions) {
                    selection = '#' + param;
                    break;
                }
            }
        }
        if (!selection) {
            selection = '#settings';
        }
        tabDom.tabs('select', selection);
    }

    if (hash) {
        urlArgs = url.queryToObject(hash);
        if (urlArgs.options) {
            options = JSON.parse(urlArgs.options);
        }
        if (!options.title) {
            options.title = options.url;
        }
    }

    //TODO: Call linkdrop account API first, to see if that works.
    rdapi('account/get', {
        success: function (json) {
            if (json.error) {
                json = [];
            }
            updateAccounts(json);
        }
    });

    $(function () {
        var services = options.services,
            param,
            thumbDivNode = $('div.thumb')[0],
            thumbImgDom = $('img.thumb');

        //Debug info on the data that was received.
        $('#debugOutput').val(JSON.stringify(options));

        //Hook up button for share history
        $('#shareHistoryButton').click(function (evt) {
            window.open('history.html');
        })

        //Set up tabs.
        tabDom = $("#tabs");
        tabDom.tabs({ fx: { opacity: 'toggle', duration: 200 } });

        //Set up the URL in all the message containers
        if (options.url) {
            $('textarea.message').each(function (i, node) {
                var dom = $(node);
                //If the message containder prefers canonical URLs then use them.
                if (dom.hasClass('canonical')) {
                    dom.val(options.canonicalUrl || options.url);
                } else {
                    dom.val(options.url);
                }
            });
        }

        //For the title in facebook/subject in email, set it to the page title
        if (options.title) {
            $('.title').text(options.title);
        }

        //Remember the thumbnail preview size for later, to adjust the image
        //to fit within the size.
        //previewWidth = parseInt(thumbDivNode.style.width, 10);
        //previewHeight = parseInt(thumbDivNode.style.height, 10);
        thumbImgDom.bind('load', resizePreview);

        //Set preview image for facebook
        if (options.previews && options.previews.length) {
            //TODO: set up all the image previews.
            thumbImgDom.attr('src', options.previews[0]);
        } else {
            thumbImgDom.attr('src', options.thumbnail);
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
        var to = localStorage['X-Send-To'];
        var subject = localStorage['X-Send-Subject'];
        rdapi('send', {
            type: 'POST',
            data: {
                domain: domain,
                message: message,
                to: to,
                subject: subject
            },
            success: function (json) {
                // {'reason': u'Status is a duplicate.', 'provider': u'twitter.com'}
                if (json['error'] && json['error']['reason']) {
                    $("#resultReason").text("Error: "+json['error']['reason']);
                    var code = json['error']['code'];
                    if (code ==  401 || code == 400 || code == 530) {
                        reauthorize();
                    }
                }
                else if (json['error'])
                    $("#resultReason").text("Error: "+json['error']['reason']);
                else {
                    $("#resultReason").text("Message Sent");
                    $('#tabs').addClass('hidden');
                    $('#statusSent').removeClass('hidden');
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
                localStorage['X-Send-To'] = form.to.value;
                localStorage['X-Send-Subject'] = form.subject.value;
                sendMessage();
                return false;
            })
            .each(function (i, node) {
                placeholder(node);
            });
    });
});
