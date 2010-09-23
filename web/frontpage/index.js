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

    $(function () {
        //If this is after an install, then show the "click the button" UI.
        var hash = location.href.split('#')[1],
            installedDom = $('#installed');
        if (hash === 'installed') {
            installedDom.fadeIn(2000);
        }

        //Allow closing the installed area thing.
        $('body').delegate('#installClose', 'click', function (evt) {
            installedDom.fadeOut(2000);
        });

        $(window).bind('load resize', function () {
            var h = $('button.download').height();
            $('button.download').css({ 'margin-top' : (-h / 2) });
        });
    });

});
