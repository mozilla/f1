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
/*global define: false, window: false, location: true, navigator: false */
'use strict';

define([ 'require', 'jquery', 'hashDispatch', 'jquery.fancybox-1.3.4'],
function (require,   $,        hashDispatch) {

    $(function () {
        //Goofy test, but just need to weed out big non-Gecko browsers, not
        //a critical check if it goes wrong.
        var isGecko = !!navigator.buildID;



        //Do not show install button for non-Gecko browsers. Even for Gecko
        //browsers, the install may not work for all browser, but let AMO
        //handle that notification.
        if (!isGecko) {
            $('#download').hide();
            $('#firefox').show();
        }

        //Initialize fancybox for the video
        $('.fancybox').fancybox({
            'type': 'iframe',
            href: 'http://player.vimeo.com/video/17619444?title=0&amp;byline=0&amp;portrait=0&amp;autoplay=true',
            width: 700,
            height: 468,
            autoScale: false,
            autoDimensions: false
        });

        $('body')
            .delegate('#firefox', 'click', function (evt) {
                location = 'http://getfirefox.com';
            })
            .delegate('.downloadXpi', 'click', function (evt) {
                //For dev and staging, use local XPI
                var href = location.href;
                if (href.indexOf('staging') !== -1 ||
                    href.indexOf('linkdrop') !== -1) {
                    location = '/ffshare.xpi';
                } else {
                    location = 'https://addons.mozilla.org/services/install.php?addon_id=252539&addon_name=F1%20by%20Mozilla%20Labs&src=external-f1home';
                }
                evt.preventDefault();
            });

        $(window)
            .bind('load resize', function () {
                var h = $('button.download').height();
                $('button.download').css({ 'margin-top' : (-h / 2) });
            });
    });

});
