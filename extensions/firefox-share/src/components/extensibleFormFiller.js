/*
 * This component overrides the satchel form autocomplete service
 * it implements support for allowing multiple components, registered to the
 * xpcom category "form-autocomplete-handler" to opt to handle an
 * autocomplete request.  If none do, it falls back to the original handler.
 *
 * This override is a bit hacky, should be a part of the internal satchel
 * implementation.  Since at least two labs projects (contacts and linkdrop)
 * want to provide autocomplete this had to be done to allow both to work
 * if both were installed.
 *
 * This file is currently duplicated in the contacts addon.
 */


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
_("?loaded FormAutocomplete");

__defineGetter__("FAC", function() {
  _("get FAC");
  delete this.FAC;
  return this.FAC = Components.classesByID["{c11c21b2-71c9-4f87-a0f8-5e13f50495fd}"].
    getService(Ci.nsIFormAutoComplete);
});

function FormAutocomplete() {
  _("new PAC FormAutocomplete");
  
    // Check who is registered in "form-autocomplete-handler" category.
    _("   Gather handlers registered");
    this.handlers = [];
    let foundEntriesCount = 0;
    let catMan = Cc["@mozilla.org/categorymanager;1"].
                 getService(Ci.nsICategoryManager);
    let entries = catMan.enumerateCategory("form-autocomplete-handler");
    while (entries.hasMoreElements()) {
      foundEntriesCount++;
      let entry = entries.getNext().QueryInterface(Ci.nsISupportsCString).data;
      let cid = catMan.getCategoryEntry("form-autocomplete-handler", entry);
      _("      Found category entry (" + entry + ") = ["+cid+"]");
      let handler = Cc[cid].getService(Ci.nsIFormAutoComplete);
      _("      Got service instance "+handler);
      this.handlers.push(cid);
    }
    _("   Found "+foundEntriesCount+" handlers");
}
FormAutocomplete.prototype = {
  classDescription: "Extensible Form Autocomplete",
  contractID: "@mozilla.org/satchel/form-autocomplete;1",
  classID: Components.ID("{a90ef7fd-ef96-6f4a-bb0e-075fc2f06e23}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIFormAutoComplete]),
  handlers: null,

  autoCompleteSearch: function autoCompleteSearch(name, query, field, prev) {
    _("FormAutocomplete autoCompleteSearch", Array.slice(arguments));

    // See if any of the handlers want to provide autocomplete
    for (var i in this.handlers) {
        let handler = Cc[this.handlers[i]].getService(Ci.nsIFormAutoComplete);
        let ac = handler.autoCompleteSearch(name, query, field, prev);
        if (ac) return ac;
    }
    // Use the base form autocomplete for non-people searches
    return FAC.autoCompleteSearch(name, query, field, prev);
  }
};

let components = [FormAutocomplete];
if (XPCOMUtils.generateNSGetFactory)
    var NSGetFactory = XPCOMUtils.generateNSGetFactory(components);
else
    var NSGetModule = XPCOMUtils.generateNSGetModule(components);



