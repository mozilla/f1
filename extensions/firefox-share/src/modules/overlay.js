
const FFSHARE_EXT_ID = "ffshare@mozilla.org";
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

Cu.import("resource://ffshare/modules/addonutils.js");

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var buttonId = 'ffshare-toolbar-button';

var EXPORTED_SYMBOLS = ["installOverlay"];

function installOverlay(win) {
  let unloaders = [];
  let Application = Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);
  let xulRuntime = Components.classes["@mozilla.org/xre/app-info;1"]
                             .getService(Components.interfaces.nsIXULRuntime);

  let document = win.document;

  // load our stylesheet, not sure how to unload
  dump("running on "+xulRuntime.OS+"\n");
  if (xulRuntime.OS === "windows") {
    // XXX not sure what xulRuntime.OS will be on windows
    loadStylesheet(win, "resource://ffshare/chrome/skin/windows/overlay.css");
  } else {
    loadStylesheet(win, "resource://ffshare/chrome/skin/overlay.css");
  }

  // ********************************************************************
  // create our commandset

  let commandset = document.createElementNS(NS_XUL, 'commandset');
  commandset.setAttribute('id', 'shareCommandset')
  
  let command = document.createElementNS(NS_XUL, 'command');
  command.setAttribute('id', 'cmd_toggleSharePage');
  command.setAttribute('oncommand', "ffshare.togglePanel();");
  commandset.appendChild(command);
  document.documentElement.appendChild(commandset);

  unloaders.push(function() {
      document.documentElement.removeChild(
          document.getElementById('shareCommandset')
      );
  });

  // ********************************************************************
  // create our keyset

  let key = document.createElementNS(NS_XUL, 'key');
  key.setAttribute('id', 'key_ffshare');
  key.setAttribute('command', 'cmd_toggleSharePage');
  document.getElementById('mainKeyset').appendChild(key);
  unloaders.push(function() {
      document.getElementById('mainKeyset').removeChild(
          document.getElementById('key_ffshare')
      );
  });


  // ********************************************************************
  // create the context menu's

  let context = document.getElementById('contentAreaContextMenu');
  let place = document.getElementById('context-sendpage').nextSibling;
  
  let el = document.createElementNS(NS_XUL, 'menuseparator');
  el.setAttribute('id', 'context-ffshare-separator');
  context.insertBefore(el, place);

  el = document.createElementNS(NS_XUL, 'menuitem');
  el.setAttribute('id', 'context-ffshare');
  el.setAttribute('label', getString("ffshareContext.label"));
  el.setAttribute('command', 'cmd_toggleSharePage');
  context.insertBefore(el, place);
  
  place = document.getElementById('context-sep-selectall').nextSibling;
  
  el = document.createElementNS(NS_XUL, 'menuitem');
  el.setAttribute('id', 'context-selected-ffshare');
  el.setAttribute('label', getString("ffshareContext.label"));
  el.setAttribute('command', 'cmd_toggleSharePage');
  context.insertBefore(el, place);

  el = document.createElementNS(NS_XUL, 'menuseparator');
  el.setAttribute('id', 'context-selected-ffshare-separator');
  el.setAttribute('hidden', 'true');
  context.insertBefore(el, place);

  //document.getElementById('mainPopupSet').appendChild(popup);
  unloaders.push(function() {
      let context = document.getElementById('contentAreaContextMenu');
      context.removeChild(document.getElementById('context-ffshare'));
      context.removeChild(document.getElementById('context-ffshare-separator'));
      context.removeChild(document.getElementById('context-selected-ffshare-separator'));
      context.removeChild(document.getElementById('context-selected-ffshare'));
  });

  // ********************************************************************
  // create the share panel/doorhanger
  
  let panel = document.createElementNS(NS_XUL, 'panel');
  panel.setAttribute('id', 'share-popup');
  panel.setAttribute('type', 'arrow');
  panel.setAttribute('noautohide', 'true');
  panel.setAttribute('class', 'ffshare-panel');
  panel.setAttribute('level', 'parent');
  
  let browser = document.createElementNS(NS_XUL, 'browser');
  browser.setAttribute('id', 'share-browser');
  browser.setAttribute('type', 'content');
  browser.setAttribute('flex', '1');
  browser.setAttribute('src', 'about:blank');
  browser.setAttribute('disablehistory', 'true');
  browser.setAttribute('contextmenu', 'contentAreaContextMenu');
  browser.setAttribute('class', 'ffshare-browser');
  panel.appendChild(browser);
  
  let popupset = document.getElementById('mainPopupSet');
  popupset.appendChild(panel);
  
  unloaders.push(function() {
      let popupset = document.getElementById('mainPopupSet');
      popupset.removeChild(document.getElementById('share-popup'));
  });


  // ********************************************************************
  // create the file menu item

  let popup = document.getElementById('menu_FilePopup');
  let place = document.getElementById('menu_sendLink').nextSibling;

  let menu = document.createElementNS(NS_XUL, 'menuitem');
  menu.setAttribute('id', 'menu_ffshare');
  menu.setAttribute('label', getString("ffshareMenu.label"));
  menu.setAttribute('command', 'cmd_toggleSharePage');

  popup.insertBefore(menu, place);

  menu = document.createElementNS(NS_XUL, 'menuseparator');
  menu.setAttribute('id', 'menu_ffshare_separator');
  popup.insertBefore(menu, place);

  unloaders.push(function() {
      let popup = document.getElementById('menu_FilePopup');
      popup.removeChild(document.getElementById('menu_ffshare'));
      popup.removeChild(document.getElementById('menu_ffshare_separator'));
  });


  // ********************************************************************
  // create the toolbar button, this gets fancy, should be easier



  // We clone an existing button because creating a new one from scratch
  // does not seem to work (perhaps some missing properties?)
  let button = document.createElementNS(NS_XUL, 'toolbarbutton');
  
  let toolbox = document.getElementById("navigator-toolbox");
  // at startup, we must modify BrowserToolbarPalette, after load, we must
  // use toolbox.palette
  let palette = document.getElementById('BrowserToolbarPalette') || toolbox.palette;
  
  // Setup label and tooltip
  button.setAttribute("id", buttonId);
  button.setAttribute("type",  "checkbox");
  button.setAttribute("label",  getString("ffshareToolbarButton.label"));
  button.setAttribute("tooltipText",  getString("ffshareToolbarButton.tooltip"));
  button.setAttribute("class",  "toolbarbutton-1 chromeclass-toolbar-additional");
  button.setAttribute("command",  "cmd_toggleSharePage");
  
  palette.appendChild(button);

  // move to location specified in prefs
  let toolbarId = Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".toolbarid", "nav-bar");
  let beforeId = Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".toolbarbefore", "urlbar-container");
  let toolbar = toolbarId && document.getElementById(toolbarId);
  if (toolbar) {
      let curSet  = toolbar.currentSet.split(",");

      if (curSet.indexOf(buttonId) === -1) {
        //Insert our ID before the URL bar ID.
        pos = curSet.indexOf(beforeId) || curSet.length;
        curSet.splice(pos, 0, buttonId);
        set = curSet.join(",");

        toolbar.setAttribute("currentset", set);
        toolbar.currentSet = set;
        document.persist(toolbar.id, "currentset");
        try {
          BrowserToolboxCustomizeDone(true);
        }
        catch (e) {}
      }

  }

  // we must redeclare our vars in the unload...
  unloaders.push(function() {
      let toolbox = document.getElementById("navigator-toolbox");
      let toolbarId = Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".toolbarid", "nav-bar");
      let toolbar = toolbarId && document.getElementById(toolbarId);
      
      let curSet  = toolbar.currentSet.split(",");
      let pos = curSet.indexOf(buttonId);
      if (pos !== -1) {
          curSet.splice(pos, 1)
          let set = curSet.join(",");

          toolbar.setAttribute("currentset", set);
          toolbar.currentSet = set;
          document.persist(toolbar.id, "currentset");
      }
      let palette = document.getElementById('BrowserToolbarPalette') || toolbox.palette;
      palette.removeChild(button);
  });
  return unloaders;
}
