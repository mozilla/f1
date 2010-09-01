'use strict';
/*jslint  */
/*global require: false, location: true, window: false */

require.def('hashDispatch', function (object) {

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
