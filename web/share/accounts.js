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
/*global require: false, location: false */
"use strict";

require.def("disconnect",
        ["require", "jquery", "blade/fn", "rdapi", "oauth", "blade/jig"],
function (require,   $,        fn,         rdapi,   oauth,   jig) {

    var accounts = {},
        actions = {
            'twitter.com': {
                medium: 'twitter',
                name: 'Twitter',
                icon: 'i/twitterIcon.png',
                revokeUrl: 'http://twitter.com/settings/connections',
                signOutUrl: 'http://twitter.com/logout'
            },
            'facebook.com': {
                medium: 'facebook',
                name: 'Facebook',
                icon: 'i/facebookIcon.png',
                revokeUrl: 'http://www.facebook.com/editapps.php?v=allowed',
                signOutUrl: 'http://facebook.com'
            },
            'google.com': {
                medium: 'google',
                name: 'Gmail',
                icon: 'i/gmailIcon.png',
                revokeUrl: 'https://www.google.com/accounts/IssuedAuthSubTokens',
                signOutUrl: 'http://google.com/preferences'
            }
        },
        //An ordered list of services, used to show all the services supported
        services = ['twitter.com', 'facebook.com', 'google.com'];

    jig.addFn({
        serviceName: function(domain) {
            return actions[domain].name;
        },
        serviceIcon: function (domain) {
            return actions[domain].icon;
        },
        accounts: function(service) {
            return accounts[service];
        },
        getMedium: function (domain) {
            return actions[domain].medium;
        },
        profilePic: function (photos) {
            //TODO: check for a thumbnail picture, hopefully one that is square.
            return photos && photos[0] && photos[0].value || 'i/face2.png';
        },
        signOutUrl: function (domain) {
            return actions[domain].signOutUrl;
        },
        revokeUrl: function (domain) {
            return actions[domain].revokeUrl;
        }
    });

    function showError(error) {
        $('#notifications').append(jig('#error', error));
    }

    function signOut(domain, userId, userName) {
        rdapi('account/signout', {
            data: {
                domain: domain,
                userid: userId,
                username: userName
            },
            success: function () {
                location.reload();
            },
            error: function (xhr, textStatus, err) {
                showError({
                    message: err
                });
            }
        });
    }

    rdapi('account/get', {
        success: function (json) {
            $(function () {
                if (json.error) {
                    showError(json.error);
                } else {
                    //Sort accounts by type.
                    json.forEach(function (account) {
                        var domain = account.accounts[0].domain,
                            domainObj = accounts[domain] || (accounts[domain] = []);
                        domainObj.push(account);
                    });
                    $('#accounts').append(jig('#service', services));
                }
            });
        }
    });

    $(function () {
        $('body')
            .delegate('.close', 'click', function (evt) {
                window.close();
            })
            .delegate('.connectButton', 'click', function (evt) {
                var buttonNode = evt.target,
                    domain = buttonNode.getAttribute('data-domain');
                    oauth(domain, function () {
                        location.reload();
                    });
            })
            .delegate('.disconnectButton', 'click', function (evt) {
                var buttonNode = evt.target,
                    domain = buttonNode.getAttribute('data-domain'),
                    username = buttonNode.getAttribute('data-username'),
                    userid = buttonNode.getAttribute('data-userid');

                signOut(domain, userid, username);
            });

        //Tell our opener of changes. Basically, any change reloads this page,
        //so just notify the opener every time page loads. May need to work
        //out some flow issues if this is the very first load.
        var opener = window.opener;
        if (opener) {
            //TODO: ideally lock down the domain be location.hostname, but
            //a problem for 127 addresses?
            opener.postMessage('accountsUpdated', '*');
        }
    });

});
