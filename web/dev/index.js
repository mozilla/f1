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
/*global require: false, window: false, location: true, navigator: false */
'use strict';

define(['require', 'jquery', 'hashDispatch'],
    function (require,   $,        hashDispatch) {

    $(function () {
        //Goofy test, but just need to weed out big non-Gecko browsers, not
        //a critical check if it goes wrong.
        var isGecko = !!navigator.buildID;

        $(window).bind('buttonX', function () {
          //If this is after an install, then show the "click the button" UI.
            var x = window.buttonX;
            if (x) {
                //TODO: fix this hardcoded 8px offset. Need to make it half the width
                //of the arrow, but cannot dynamically ask for it because it is hidden
                //so has no width. Would need to take it out of DOM, show it, then get
                //width.
                x = x - 8;
                $('#installed').fadeIn(500);
                $('#shareArrow').css({left: x});
            }
        });

        $(window).bind('hideInstalled', function () {
            //Once a person clicks on the toolbar button for the first time we
            // should get a hideInstalled event
            $('#installed').fadeOut("fast");
        });

        //Do not show install button for non-Gecko browsers. Even for Gecko
        //browsers, the install may not work for all browser, but let AMO
        //handle that notification.
        if (!isGecko) {
            $('#download').hide();
            $('#firefox').show();
        }

        $('body')
            .delegate('#firefox', 'click', function (evt) {
                location = 'http://getfirefox.com';
            });

        $(window).bind('load resize', function () {
            var h = $('button.download').height();
            $('button.download').css({ 'margin-top' : (-h / 2) });
        });
    });

});
