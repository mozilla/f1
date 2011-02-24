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
/*global require: false, define: false, window: false, location: true,
 localStorage: false, opener: false, setTimeout: false */
'use strict';

define([ 'storage', 'dispatch', 'rdapi', 'services'],
function (storage,   dispatch,   rdapi,   services) {

    return {
        discover: function discoverService(domain, ok, fail) {
            $.ajax({
                url: '/api/account/discovery',
                type: 'POST',
                data: {
                  domain: domain
                },
                dataType: 'json',
                success: function (resp) {
                    if (ok) {
                        ok(resp)
                    }
                },
                error: function (xhr, textStatus, errorThrown) {
                  if (fail) {
                    fail(xhr, textStatus, errorThrown);
                  }
                }
            });
        }
    };
});