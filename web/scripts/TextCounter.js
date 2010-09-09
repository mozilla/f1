/*jslint plusplus: false */
/*global require: false */
"use strict";

require.def('TextCounter',
        ['jquery', 'blade/object', 'blade/fn'],
function ($,        object,         fn) {

    return object(null, null, {
        init: function (node, countNode, limit) {
            this.dom = $(node);
            this.countDom = $(countNode);
            this.limit = limit;
            this.dom.bind('keyup', fn.bind(this, 'checkCount'));
            this.checkCount();
        },

        checkCount: function () {
            var count = this.limit - this.dom[0].value.length;
            if (count < 0) {
                this.countDom.addClass("TextCountOver");
            } else {
                this.countDom.removeClass("TextCountOver");
            }
            this.countDom.text(count === this.limit ? '' : count);            
        },

        isOver: function () {
            return this.dom[0].value.length > this.limit;
        }
    });
});
