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

/*jslint */
/*global require: false, window: false, location: false */
'use strict';

require.def(['require', 'jquery', 'hashDispatch'],
    function (require,   $,        hashDispatch) {

    function bounceOut(/* Decimal? */n) {
        //From dojo easing functions.
        // summary:
        //        An easing function that 'bounces' near the end of an Animation
        var s = 7.5625,
            p = 2.75,
            l; 
        if (n < (1 / p)) {
            l = s * Math.pow(n, 2);
        } else if (n < (2 / p)) {
            n -= (1.5 / p);
            l = s * Math.pow(n, 2) + .75;
        } else if (n < (2.5 / p)) {
            n -= (2.25 / p);
            l = s * Math.pow(n, 2) + .9375;
        } else {
            n -= (2.625 / p);
            l = s * Math.pow(n, 2) + .984375;
        }
        return l;
    }

    function bounceIn(/* Decimal? */n) {
        // summary: 
        //        An easing function that 'bounces' near the beginning of an Animation
        return (1 - bounceOut(1 - n)); // Decimal
    }

    function bounceInOut(/* Decimal? */n) {
        // summary: 
        //        An easing function that 'bounces' at the beginning and end of the Animation
        if (n < 0.5) {
            return bounceIn(n * 2) / 2;
        }
        return (bounceOut(n * 2 - 1) / 2) + 0.5; // Decimal
    }

    $(function () {
        var installedDom = $('#installed'),
            installClose = $('#installClose'),
            //x = 1153;
            x = window.buttonX;

        //If this is after an install, then show the "click the button" UI.
        if (x) {
            //TODO: fix this hardcoded 23px offset. Need to make it half the width
            //of the arrow, but cannot dynamically ask for it because it is hidden
            //so has no width. Would need to take it out of DOM, show it, then get
            //width.
            x = x - 23;
            installedDom.fadeIn(500);
            installClose.css({'position': 'fixed', left: x, top: 100});
            
            //Animate up to the top
            installClose.animate({
                top: 0
            }, 2000, bounceIn);
        }

        //Allow closing the installed area thing.
        $('body')
            .delegate('#download', 'click', function (evt) {
                $('#installFrame').attr('src', '../share-0.1-dev.xpi')
                                  .ready(function () {
                                    $("#allow_helper").fadeIn("slow").delay(10 * 1000).fadeOut("slow");
                                });
            });

        $(window).bind('load resize', function () {
            var h = $('button.download').height();
            $('button.download').css({ 'margin-top' : (-h / 2) });
        });
    });

});
