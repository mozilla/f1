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
/*global require: false, location: true, window: false, alert: false, setTimeout: false */
"use strict";

require.def("send",
        ["require", "jquery", "blade/fn", "rdapi", "blade/url", "placeholder", "TextCounter"],
function (require,   $,        fn,         rdapi,   url,         placeholder,   TextCounter) {

    var svcOptions = {
            'twitter': true,
            'facebook': true,
            'gmail': true
        },
        hash = location.href.split('#')[1],
        urlArgs, sendData, authDone,
        options = {
            services: null
        },
        tabDom, bodyDom, twitterCounter,
        previewWidth = 90, previewHeight = 70;

    function reauthorize(callback, domain) {
        if (callback) {
            authDone = callback;
        }
        var url = location.protocol + "//" + location.host + "/send/auth.html";
        window.open(url + "?domain=" +
                              (domain || sendData.domain),
                            "Firefox Share OAuth",
                            "dialog=yes, modal=yes, width=800, height=480");
    }

    //Handle communication from the auth window, when it completes.
    window.addEventListener("message", function (evt) {
        //TODO: ideally lock down the domain check on evt.origin.
        if (evt.data === 'authDone') {
            if (authDone) {
                authDone();
                authDone = null;
            }
        }
    }, false);  

    function showStatus(statusId, shouldCloseOrMessage) {
        tabDom.addClass('hidden');
        $('div.status').addClass('hidden');
        $('#' + statusId).removeClass('hidden');
        bodyDom.addClass('status');
        location = '#!resize';

        if (shouldCloseOrMessage === true) {
            setTimeout(function () {
                location = '#!success:' + url.objectToQuery({
                    domain: sendData.domain,
                    username: sendData.username,
                    userid: sendData.userid
                });
            }, 4000);
        } else if (shouldCloseOrMessage) {
            $('#' + statusId + 'Message').text(shouldCloseOrMessage);
        }
    }
    //Make it globally visible for debug purposes
    window.showStatus = showStatus;

    function cancelStatus() {
        $('div.status').addClass('hidden');
        tabDom.removeClass('hidden');
        bodyDom.removeClass('status');
        location = '#!resize';
    }

    function sendMessage() {
        rdapi('send', {
            type: 'POST',
            data: sendData,
            success: function (json) {
                // {'reason': u'Status is a duplicate.', 'provider': u'twitter.com'}
                if (json.error && json.error.reason) {
                    var code = json.error.code;
                    // XXX need to find out what error codes everyone uses
                    if (code === 400 || code ===  401 || code === 403 || code >= 530) {
                        showStatus('statusAuth');
                    } else {
                        showStatus('statusError', json.error.reason);
                    }
                }
                else if (json.error) {
                    showStatus('statusError', json.error.reason);
                } else {
                    showStatus('statusShared', true);
                }
            },
            error: function (xhr, textStatus, err) {
                showStatus('statusError', err);
            }
        });
    }

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

    function updateUserTab(evt, ui) {
        var imageUrl = '',
            userName = '',
            inactive = true,
            domain = '',
            id = ui.panel.id,
            userInfoDom = $(".user-info");

        if (id !== 'debug' && id !== 'settings') {
            imageUrl = $(ui.panel).find("div.user img.avatar").attr("src");
            userName = $(ui.panel).find("div.user .username").text();
            inactive = $(ui.panel).find("div.user").hasClass("inactive");
            domain   = $(ui.panel).find("div.user input[type='hidden'][name='domain']").val();
        }
        $(".user-info img.avatar").attr("src", imageUrl);
        if (!imageUrl) {
            userInfoDom.hide();
        } else {
            userInfoDom.show();
        }
        $(".user-info .status").toggleClass("inactive", inactive);
        $(".user-info .username").text(userName);
        $(".user-info").attr("data-domain", domain);
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
                svcAccount = account.accounts[0],
                photo = account.photos && account.photos[0] && account.photos[0].value,
                serviceDom = $('#' + service);

            if (name) {
                serviceDom.find('.username').text(name);
            }
            if (photo) {
                serviceDom.find('.avatar').attr('src', photo);
            }

            serviceDom.find('input[name="userid"]').val(svcAccount.userid);
            serviceDom.find('input[name="username"]').val(svcAccount.username);
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
        //TODO: HACK, clean this up later.
        updateUserTab(null, {panel: $(selection)[0]});
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
        var thumbImgDom = $('img.thumb'),
            facebookDom = $('#facebook'),
            picture;

        bodyDom = $('body');

        //Debug info on the data that was received.
        $('#debugOutput').val(JSON.stringify(options));
        $('#debugCurrentLocation').val(location.href);

        //Hook up button for share history
        $('#shareHistoryButton').click(function (evt) {
            window.open('history.html');
            location = '#!close';
        });
        $('#statusAuthButton, #statusErrorButton').click(function (evt) {
            cancelStatus(); 
        });
        $('#authOkButton').click(function (evt) {
            reauthorize(sendMessage);
        });

        //Set up tabs.
        tabDom = $("#tabs");
        tabDom.tabs({ fx: { opacity: 'toggle', duration: 200 } });
        tabDom.bind("tabsselect", updateUserTab);

        //Set up the URL in all the message containers
        if (options.url) {
            rdapi('links/shorten', {
                type: 'POST',
                data: {
                    'url': options.canonicalUrl || options.url
                },
                success: function (json) {
                    $(function () {
                        options.shortUrl = json.result.short_url;
                        $('textarea.message').each(function (i, node) {
                            var dom = $(node);
                            //If the message containder doesn't want URLs then respect that.
                            if (dom.hasClass('nourl')) {
                                return true;
                            } else {
                                dom.val(options.shortUrl);
                            }
                            return undefined;
                        });
                    });
                },
                error: function (json) {
                }
            });
            $(".meta .url").text(options.url);
            $(".meta .curl").text(options.canonicalUrl);
        }

        //Set up hidden form fields for facebook
        //TODO: try sending data urls via options.thumbnail if no
        //previews?
        picture = options.previews && options.previews[0];
        if (picture) {
            facebookDom.find('[name="picture"]').val(picture);
        }

        if (options.url) {
            facebookDom.find('[name="link"]').val(options.url);
        }

        if (options.title) {
            facebookDom.find('[name="name"]').val(options.title);
        }

        if (options.description) {
            facebookDom.find('[name="caption"]').val(options.description);
        }

        //For the title in facebook/subject in email, set it to the page title
        if (options.title) {
            $('.title').text(options.title);
        }

        //For pages with built in descriptions add that to the meta information
        if (options.description) {
            $('.description').text(options.description);
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

        //Set up twitter text counter
        twitterCounter = new TextCounter($('#twitter textarea.message'), $('#twitter .counter'), 140);

        //Handle button click for services in the settings.
        $('#settings').delegate('.auth', 'click', function (evt) {
            var node = evt.target,
                domain = node.getAttribute('data-domain');

            reauthorize(function () {
                //After reauthorize, just reload the page, let the account
                //fetching do its work.
                location.reload();
            }, domain);
        });

        //Handle login click for user information area.
        $('ul.nav').delegate('.user-info', 'click', function (evt) {
            var domain = $(this).attr('data-domain');

            reauthorize(function () {
                //After reauthorize, just reload the page, let the account
                //fetching do its work.
                location.reload();
            }, domain);
        });

        $(".messageForm")
            .submit(function (evt) {
                //First clear old errors
                $(".error").addClass("invisible");

                var form = evt.target;

                //If twitter and message is bigger than allowed, do not submit.
                if (form.domain.value === 'twitter.com' && twitterCounter.isOver()) {
                    return false;
                }

                //Make sure all form elements are trimmed and username exists.
                //Then collect the form values into the data object.
                sendData = {};
                $.each(form.elements, function (i, node) {
                    var trimmed = node.value.trim();

                    if (node.getAttribute("placeholder") === trimmed) {
                        trimmed = "";
                    }

                    node.value = trimmed;

                    if (node.value) {
                        sendData[node.name] = node.value;
                    }
                });
                sendData.shorturl = options.shortUrl;

                sendMessage();
                return false;
            })
            .each(function (i, node) {
                placeholder(node);
            });
    });

});
