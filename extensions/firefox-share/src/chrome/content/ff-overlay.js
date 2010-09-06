ffshare.onFirefoxLoad = function(event) {
  document.getElementById("contentAreaContextMenu")
          .addEventListener("popupshowing", function (e){ ffshare.showFirefoxContextMenu(e); }, false);

  // For now we'll just insert ourselves on every window even though this isn't nice in the long run
  try {
    var firefoxnav = document.getElementById("nav-bar");
    var curSet = firefoxnav.currentSet;
    if (curSet.indexOf("my-extension-button") == -1) {
      var set;
      // Place the button just after the urlbar
      if (curSet.indexOf("urlbar-container") != -1) {
        set = curSet.replace(/urlbar-container/, "urlbar-container,ffshare-toolbar-button");
      }
      else  { // otherwise at the very end
        set = curSet + ",my-extension-button";
      }
      firefoxnav.setAttribute("currentset", set);
      firefoxnav.currentSet = set;
      document.persist("nav-bar", "currentset");
      // If you don't do the following call, funny things happen
      try {
        BrowserToolboxCustomizeDone(true);
      }
      catch (e) { }
    }
 }
 catch(e) { }
};

ffshare.showFirefoxContextMenu = function(event) {
  // show or hide the menuitem based on what the context menu is on
  document.getElementById("context-ffshare").hidden = gContextMenu.onImage;

  // Always hide the old send link context menu
  document.getElementById("context-sendlink").hidden = true;
};

window.addEventListener("load", ffshare.onFirefoxLoad, false);
