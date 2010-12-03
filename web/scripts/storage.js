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
/*global require: false, localStorage: false */
"use strict";

require.def("storage", function () {
  var store = localStorage, type = 'localStorage';

  //Capability detect for localStorage. At least one add-on does weird things
  //with it.
  try {
    store.tempVar = 'temp';
    //Test reading.
    if (store.tempVar === 'temp') {}
    //Test deletion.
    delete store.tempVar;
  } catch (e) {
    //Just use a simple in-memory object. Not as nice, but code will still work.
    store = {};
    type = 'memory';
  }

  function storage() {
    return store;
  }

  storage.type = type;

  return storage;
});