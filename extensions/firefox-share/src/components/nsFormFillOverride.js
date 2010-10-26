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

__defineGetter__("FAC", function() {
  _("get standard FormAutoComplete (FAC)");
  delete this.FAC;
  return this.FAC = Components.classesByID["{c11c21b2-71c9-4f87-a0f8-5e13f50495fd}"].
    getService(Ci.nsIFormAutoComplete);
});


function FFShareAutoComplete() {
  _("new FFShareAutoComplete");
}

FFShareAutoComplete.prototype = {
  classDescription: "FFShare AutoComplete",
  contractID: "@mozilla.org/satchel/form-autocomplete;1",
  classID: Components.ID("{a7685da4-c42a-ed4b-ae53-2f19ac6164a3}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIFormAutoComplete]),

  isShareType: function (name, field) {

    _("isShareType", Array.slice(arguments));

    if (field != null) {
      let className = field.getAttribute('class');
      return (className && className.indexOf('ffshareAutoComplete') !== -1);
    }
    return false;
  },

  findPeople: function findPeople(query) {
    _("findPeople", Array.slice(arguments));

    let result = Cc["@mozilla.org/autocomplete/simple-result;1"].
      createInstance(Ci.nsIAutoCompleteSimpleResult);
    result.setSearchString(query);

    let data = "Some Thing <something@example.com>";
    _("appending match for " + data);
    result.appendMatch("something@example.com", data, null, null);

    result.appendMatch("something1@example.com", '1' + data, null, null);

    result.appendMatch("something2@example.com", '2' + data, null, null);

    result.appendMatch("something3@example.com", '3' + data, null, null);

    let resultCode = result.matchCount ? "RESULT_SUCCESS" : "RESULT_NOMATCH";
    _("returning autocomplete " +resultCode+ " result with " + result.matchCount + " items");
    result.setSearchResult(Ci.nsIAutoCompleteResult[resultCode]);
    return result;
  },

  autoCompleteSearch: function autoCompleteSearch(name, query, field, prev) {
    _("autocomplete search", Array.slice(arguments));

    if (this.isShareType(name, field))
      return this.findPeople(query);

    // Use the base form autocomplete for non-people searches
    return FAC.autoCompleteSearch(name, query, field, prev);
  }
};

let components = [FFShareAutoComplete];
if (XPCOMUtils.generateNSGetFactory) {
  var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
} else {
  var NSGetModule = XPCOMUtils.generateNSGetModule(components);
}



