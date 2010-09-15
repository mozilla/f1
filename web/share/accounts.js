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
/*global require: false */
"use strict";

require.def("disconnect",
        ["require", "jquery", "blade/fn", "rdapi", "blade/jig"],
function (require,   $,        fn,         rdapi,   jig) {

    var actions = {
        'twitter.com': {
            signOut: function (userId, userName) {
                //
                
            }
        },
        'facebook.com': {
            signOut: function (userId, userName) {
                
            }
        }
    };

    jig.addFn({
        getMedium: function (domain) {
            if (domain === 'twitter.com') {
                return 'twitter';
            }
            if (domain === 'facebook.com') {
                return 'facebook';
            }
            if (domain === 'google.com') {
                return 'google';
            }
            return '';
        },
        profilePic: function (photos) {
            //TODO: check for a thumbnail picture, hopefully one that is square.
            return photos && photos[0] && photos[0].value || 'i/face2.png';
        }
    });

    rdapi('account/get', {
        success: function (json) {
            $(function () {
                if (json.error) {
                    $('#notifications').append(jig('#error', json.error));
                } else {
                    //Sort accounts by type.
                    var accounts = {};
                    json.forEach(function (account) {
                        var domain = account.accounts[0].domain,
                            domainObj = accounts[domain] || (accounts[domain] = []);
                        domainObj.push(account);
                    });
                    $('#statuses').append(jig('#accounts', accounts));
                }
            });
        }
    });

    $(function () {
        $('body')
            .delegate('button[data-domain]', 'click', function (evt) {
                var buttonNode = evt.target;
                    domain = buttonNode.getAttribute('data-domain'),
                    username = buttonNode.getAttribute('data-username'),
                    userid = buttonNode.getAttribute('data-userid');

                actions[domain].signOut(userid, username);
           });
    });
    
});
