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
  delete this.ffshareAutoCompleteData;
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

  findEmails: function findEmails(query) {
    _("findEmails", Array.slice(arguments));

    let result = Cc["@mozilla.org/autocomplete/simple-result;1"].
                   createInstance(Ci.nsIAutoCompleteSimpleResult);
    result.setSearchString(query);

    //convert the query to only be for things after the comma.
    var parts = query.split(','), previousMatch = '';

    if (parts.length > 1) {
      query = parts[parts.length - 1].trim();
      previousMatch = parts.slice(0, parts.length - 1).join(',') + ', ';
    }

    query = query.toLowerCase();

_("query is now: [" + query + "]");
_("previousMatch is now: " + previousMatch);

    let data = acDataStorage.get();

    data.forEach(function (item) {
      var displayNameLower = item.displayName.toLowerCase(),
          emailLower = item.email.toLowerCase();

      if (displayNameLower.indexOf(query) !== -1 || emailLower.indexOf(query) !== -1) {
        result.appendMatch(previousMatch + item.email + ', ',
                           (displayNameLower === emailLower ? item.email : item.displayName + '<' + item.email + '>'), null, 'ffshare');
      }
    });

    let resultCode = result.matchCount ? "RESULT_SUCCESS" : "RESULT_NOMATCH";
    _("returning autocomplete " +resultCode+ " result with " + result.matchCount + " items");
    result.setSearchResult(Ci.nsIAutoCompleteResult[resultCode]);
    return result;
  },

  autoCompleteSearch: function autoCompleteSearch(name, query, field, prev) {
    _("FFShareAutoComplete search", Array.slice(arguments));

    if (this.isShareType(name, field))
      return this.findEmails(query);
    return null;
  }
};

let components = [FFShareAutoComplete];
if (XPCOMUtils.generateNSGetFactory) {
  var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
} else {
  var NSGetModule = XPCOMUtils.generateNSGetModule(components);
}



