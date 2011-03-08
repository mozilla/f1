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

/*jslint regexp: false */
/*global define: false, window: false, location: true, navigator: false */
'use strict';

define([ 'require', 'jquery', 'hashDispatch', 'jquery.fancybox-1.3.4'],
function (require,   $,        hashDispatch) {

    $(function () {
        //Goofy test, but just need to weed out big non-Gecko browsers, not
        //a critical check if it goes wrong.
        var supported = !!navigator.buildID,
            version = supported && navigator.userAgent.match(/Firefox\/([^\s]+)/);

        //Do not allow pre-4.0 Firefox browsers. This test is goofy and prone
        //to error, but err on the side of showing the button vs. hiding it,
        //and allow add-on system to kick it out if it will not work.
        if (supported && version) {
            //Convert version to a number
            version = parseFloat(version[1]);

            supported = version > 3.99;
        }

        //Do not show install button for unsupported browsers.
        if (!supported) {
            $('#downloadFF4').hide();
            $('#no36').show();
            $('#info36').show();
            $('#firefox').show();
        }

        //Initialize fancybox for the video
        $('.fancybox').fancybox({
            'type': 'iframe',
            href: 'http://player.vimeo.com/video/19715573?title=0&amp;byline=0&amp;portrait=0&amp;autoplay=true',
            width: 700,
            height: 468,
            autoScale: false,
            autoDimensions: false
        });

        $('body')
            .delegate('#firefox', 'click', function (evt) {
                location = 'http://www.mozilla.com/en-US/firefox/beta/';
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

    });

});
