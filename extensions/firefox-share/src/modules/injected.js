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

(function () {
  // __API_* strings are replaced in injector.js with specifics from
  // the provider class
  let apibase = '__API_BASE__';
  let fname = '__API_NAME__';
  let api_ns = apibase.split('.');
  let api = this;
  for (let i in api_ns) {
    if (!api[api_ns[i]]) 
      api[api_ns[i]] = {}
    api = api[api_ns[i]]
  }
  api[fname] = this['__API_INJECTED__'];
  delete this['__API_INJECTED__'];
  //dump("injected: "+eval(apibase+'.'+fname)+"\n");
})();
