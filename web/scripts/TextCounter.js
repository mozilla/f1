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
