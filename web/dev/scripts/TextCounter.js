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

require.def('TextCounter',
        ['jquery', 'blade/object', 'blade/fn'],
function ($,        object,         fn) {

    return object(null, null, {
        init: function (node, countNode, limit) {
            this.dom = $(node);
            this.domPlaceholderText = this.dom[0].getAttribute('placeholder') || '';
            this.countDom = $(countNode);
            this.limit = limit;
            this.dom.bind('keyup', fn.bind(this, 'checkCount'));
            this.checkCount();
        },

        checkCount: function () {
            var value = this.dom[0].value,
                count;

            if (value.trim() === this.domPlaceholderText) {
                value = '';
            }

            count = this.limit - value.length;
            if (count < 0) {
                this.countDom.addClass("TextCountOver");
            } else {
                this.countDom.removeClass("TextCountOver");
            }
            this.countDom.text(count === this.limit ? '' : count);            
        },

        updateLimit: function (limit) {
            this.limit = limit;
            this.checkCount();
        },

        isOver: function () {
            return this.dom[0].value.length > this.limit;
        }
    });
});
