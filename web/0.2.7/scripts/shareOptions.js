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

/*jslint indent: 2 */
/*global define: false, location: false */
"use strict";

define(['storage', 'blade/url'], function (storage, url) {
  var cache = {};

  function shareOptions(str) {
    str = str ||
          (typeof location !== 'undefined' && location.href.split('#')[1]) ||
          '';

    //If a cached value is available, return that, since the cached
    //options value may have properties added/adjusted by the other modules.
    if (cache[str]) {
      return cache[str];
    }

    var options = {},
        store = storage(),
        urlArgs, prop;

    if (str) {
      urlArgs = url.queryToObject(str);
      if (urlArgs.options) {
        options = JSON.parse(urlArgs.options);
      }
    }

    options.prefs = options.prefs || {};

    if (!options.title) {
      options.title = options.url;
    }

    if (!options.prefs.system) {
      options.prefs.system = 'prod';
    }

    //Save the extension version in the localStorage, for use in
    //other pages like settings.
    if (options.version) {
      store.extensionVersion = options.version;
    }

    //Save the preferences in localStorage, for use in
    //other ppages like setting.
    if (options.prefs) {
      for (prop in options.prefs) {
        if (options.prefs.hasOwnProperty(prop)) {
          store['prefs.' + prop] = options.prefs[prop];
        }
      }
    }

    cache[str] = options;

    return options;
  }

  return shareOptions;
});
