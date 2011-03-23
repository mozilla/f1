/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
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
 * the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *	Anant Narayanan <anant@kix.in>
 *	Shane Caraveo <shanec@mozillamessaging.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const FFSHARE_EXT_ID = "ffshare@mozilla.org";
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");
Cu.import("resource://ffshare/modules/addonutils.js");

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
const SHARE_BUTTON_ID = 'share-button';

const EXPORTED_SYMBOLS = ["installOverlay"];

function installOverlay(win) {
  let unloaders = [];
  let Application = Cc["@mozilla.org/fuel/application;1"]
                      .getService(Ci.fuelIApplication);
  let xulRuntime = Cc["@mozilla.org/xre/app-info;1"]
                     .getService(Ci.nsIXULRuntime);

  let document = win.document;

  // Load our stylesheet and register an unloader that removes it again.
  dump("running on "+xulRuntime.OS+"\n");
  let pi;
  if (xulRuntime.OS === "windows") {
    // XXX not sure what xulRuntime.OS will be on windows
    pi = loadStylesheet(win, "resource://ffshare/chrome/skin/windows/overlay.css");
  } else {
    pi = loadStylesheet(win, "resource://ffshare/chrome/skin/overlay.css");
  }
  unloaders.push(function () {
    win.document.removeChild(pi);
  });

  // ********************************************************************
  // create our commandset

  let commandset = document.createElementNS(NS_XUL, 'commandset');
  commandset.setAttribute('id', 'shareCommandset');
  
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

  let menu = document.createElementNS(NS_XUL, 'menuseparator');
  menu.setAttribute('id', 'menu_ffshare_separator');
  popup.insertBefore(menu, place);

  menu = document.createElementNS(NS_XUL, 'menuitem');
  menu.setAttribute('id', 'menu_ffshare');
  menu.setAttribute('label', getString("ffshareMenu.label"));
  menu.setAttribute('command', 'cmd_toggleSharePage');

  popup.insertBefore(menu, place);

  unloaders.push(function() {
      let popup = document.getElementById('menu_FilePopup');
      popup.removeChild(document.getElementById('menu_ffshare'));
      popup.removeChild(document.getElementById('menu_ffshare_separator'));
  });


  // ********************************************************************
  // create the urlbar button

  let button = document.createElementNS(NS_XUL, "image");
  button.id = SHARE_BUTTON_ID;
  button.className = "urlbar-icon";
  button.setAttribute("onclick", "ffshare.togglePanel();");
  let urlbarIcons = document.getElementById("urlbar-icons");
  urlbarIcons.insertBefore(button, urlbarIcons.firstChild);
  unloaders.push(function() {
    urlbarIcons.removeChild(button);
  });

  return unloaders;
}
