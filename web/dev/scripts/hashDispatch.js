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

'use strict';
/*jslint nomen: false */
/*global define: false, location: true, window: false */

define([], function () {

    /**
     * Registers an object to receive hash changes. Expects the object
     * to have property names that match the hash values.
     * It will call the actions object immediately if the current hash
     * matches a method on the object.
     *
     * @param {Object} actions the object that has property names that
     * map to hash values and values for the properties are functions
     * to be called. The name '_default' is used for any default action
     * (one that corresponds to no hash value). A name of '_catchAll' is
     * used to catch hash changes that do not map to a specific named
     * action on the actions object.
     */
    return function hashDispatch(actions) {

        function hashUpdated() {
            var hash = (location.href.split('#')[1] || '_default'),
                arg, index;
            //Only use the part of the hash before a colon to find the action
            index = hash.indexOf(':');
            if (index !== -1) {
                arg = hash.substring(index + 1, hash.length);
                hash = hash.substring(0, index);
            }

            if (hash in actions) {
                actions[hash](arg);
            } else if (actions._catchAll) {
                actions._catchAll(hash, arg);
            }
        }

        hashUpdated();
        window.addEventListener('hashchange', hashUpdated, false);
    };
});
