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

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

function _() {
  return; // comment out for verbose debugging
  let msg = Array.join(arguments, " ");
  dump(msg + "\n");
  Cu.reportError(msg);
}
_("?loaded");

__defineGetter__("acDataStorage", function() {
  Cu.import("resource://ffshare/modules/ffshareAutoCompleteData.js");
  return ffshareAutoCompleteData;
});


function FFShareAutoComplete() {
  _("new FFShareAutoComplete");
}

FFShareAutoComplete.prototype = {
  classDescription: "FFShare AutoComplete",
  contractID: "@labs.mozilla.com/f1/form-autocomplete;1",
  classID: Components.ID("{372610e5-5979-3b49-b69f-781ebac2e9d1}"),
  _xpcom_categories: [{category: "form-autocomplete-handler",
                       entry: "f1"}],
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIFormAutoComplete]),

  isShareType: function (name, field) {

    _("isShareType", Array.slice(arguments));

    if (field != null) {
      let className = field.getAttribute('class');
      return (className && className.indexOf('ffshareAutoComplete') !== -1);
    }
    return false;
  },

  findEmails: function findEmails(query, field) {
    _("findEmails", Array.slice(arguments));
    let result = Cc["@mozilla.org/autocomplete/simple-result;1"].
                   createInstance(Ci.nsIAutoCompleteSimpleResult);
    result.setSearchString(query);

    let datadomain = field.getAttribute('autocompletestore');
    if (!datadomain)
      return result;

    //convert the query to only be for things after the comma.
    var parts = query.split(','), previousMatch = '';

    if (parts.length > 1) {
      query = parts[parts.length - 1].trim();
      previousMatch = parts.slice(0, parts.length - 1).join(',') + ', ';
    }

    query = query.toLowerCase();

_("query is now: [" + query + "]");
_("previousMatch is now: " + previousMatch);
_("data domain is: "+datadomain);
    let data = acDataStorage.get(datadomain) || {};
    for (let name in data) {
      var displayNameLower = name.toLowerCase(),
          emailLower = data[name].email.toLowerCase();
      if (displayNameLower.indexOf(query) !== -1 || emailLower.indexOf(query) !== -1) {
        if (emailLower)
          addr =  (displayNameLower === emailLower ? data[name].email : name + '<' + data[name].email + '>');
        else
          addr =  name;
        result.appendMatch(previousMatch + addr + ', ', addr , null, 'ffshare');
      }
    }

    let resultCode = result.matchCount ? "RESULT_SUCCESS" : "RESULT_NOMATCH";
    _("returning autocomplete " +resultCode+ " result with " + result.matchCount + " items");
    result.setSearchResult(Ci.nsIAutoCompleteResult[resultCode]);
    return result;
  },

  autoCompleteSearch: function autoCompleteSearch(name, query, field, prev) {
    _("FFShareAutoComplete search", Array.slice(arguments));

    if (this.isShareType(name, field))
      return this.findEmails(query, field);
    return null;
  }
};

let components = [FFShareAutoComplete];
if (XPCOMUtils.generateNSGetFactory) {
  var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
} else {
  var NSGetModule = XPCOMUtils.generateNSGetModule(components);
}



