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

/*jslint indent: 2, plusplus: false */
/*global define: false */
"use strict";

define(['blade/jig', 'services'], function (jig, services) {

  var funcs = {
    thumb: function (options) {
      var preview = options.previews && options.previews[0];
      if (!preview) {
        return "";
      }
      if (preview.http_url) {
        return jig.htmlEscape(preview.http_url);
      }
      // Return our data url, this is the thumbnail
      return preview.base64;
    },
    preview: function (options) {
      var preview = options.previews && options.previews[0];
      return preview && preview.http_url;
    },
    preview_base64: function (options) {
      // Strip the URL down to just the base64 content
      var preview = options.previews && options.previews[0];
      return preview && funcs.rawBase64(preview.base64);
    },
    link: function (options) {
      return options.canonicalUrl || options.url;
    },
    cleanLink: function (url) {
      return url ? url.replace(/^https?:\/\//, '').replace(/^www\./, '') : url;
    },
    profilePic: function (photos) {
      //TODO: check for a thumbnail picture, hopefully one that is square.
      return photos && photos[0] && photos[0].value || '/share/i/face2.png';
    },
    serviceName: function (domain) {
      return services.domains[domain].name;
    },
    lastToShareType: function (shareTypes) {
      var i, shareType;
      for (i = shareTypes.length - 1; (shareType = shareTypes[i]); i--) {
        if (shareType.showTo) {
          return shareType;
        }
      }
      return null;
    },
    rawBase64: function (dataUrl) {
      return dataUrl && dataUrl.replace("data:image/png;base64,", "");
    }
  };

  jig.addFn(funcs);

  return funcs;
});