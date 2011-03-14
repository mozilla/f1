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
 * The Initial Developer of the Original Code is The Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2011
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *	Anant Narayanan <anant@kix.in>
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

/* l10n support. See https://github.com/Mardak/restartless/examples/l10nDialogs */
function getString(name, args, plural) {
    let str;
    try {
        str = getString.bundle.GetStringFromName(name);
    } catch(ex) {
        str = getString.fallback.GetStringFromName(name);
    }
    if (args != null) {
        if (typeof args == "string" || args.length == null)
            args = [args];
        str = str.replace(/%s/gi, args[0]);
        Array.forEach(args, function(replacement, index) {
            str = str.replace(RegExp("%" + (index + 1) + "\\$S", "gi"), replacement);
        });
    }
    return str;
}
getString.init = function(addon, getAlternate) {
    if (typeof getAlternate != "function")
        getAlternate = function() "en-US";

    function getBundle(locale) {
        let propertyPath = "chrome/locale/" + locale + ".properties";
        let propertyFile = addon.getResourceURI(propertyPath);
        try {
            let uniqueFileSpec = propertyFile.spec + "#" + Math.random();
            let bundle = Services.strings.createBundle(uniqueFileSpec);
            bundle.getSimpleEnumeration();
            return bundle;
        } catch(ex) {}
        return null;
    }

    let locale = Cc["@mozilla.org/chrome/chrome-registry;1"].
        getService(Ci.nsIXULChromeRegistry).getSelectedLocale("global");
    getString.bundle = getBundle(locale) || getBundle(getAlternate(locale));
    getString.fallback = getBundle("en-US");
}

function f1(win, add)
{
    this._addon = add;
    this._window = win;
    
    // Hang on, the window may not be fully loaded yet
    let self = this;
    function checkWindow()
    {
        if (!win.document.getElementById("nav-bar")) {
            let timeout = win.setTimeout(checkWindow, 1000);
            unloaders.push(function() win.clearTimeout(timeout));
        } else {
            let uri = self._addon.getResourceURI("chrome/content/ff-overlay.xul").spec;
            win.document.loadOverlay(uri, self);
        }
    }
    checkWindow();
}
f1.prototype = {
    _addToolbarButton: function() {
        let self = this;
        
        // Don't add a toolbar button if one is already present
        if (this._window.document.getElementById("ffshare-toolbar-button"))
            return;
        
        // We clone an existing button because creating a new one from scratch
        // does not seem to work (perhaps some missing properties?)
        let toolbox = this._window.document.getElementById("nav-bar");
        let homeButton = this._window.document.getElementById("home-button");
        let button = homeButton.cloneNode(false);
        
        // Setup label and tooltip
        button.id = "ffshare-toolbar-button";
        button.type = "checkbox";
        button.label = getString("ffshareToolbarButton.label");
        button.tooltipText = getString("ffshareToolbarButton.tooltip");
        button.class = "toolbarbutton-1 chromeclass-toolbar-additional"
        button.command = "cmd_toggleSharePage";
        
        // Reset click handlers of cloned button
        button.ondragexit = button.aboutHomeOverrideTooltip = null;
        button.ondragover = button.ondragenter = button.ondrop = null;
        
        // Put our button right before the URL bar
        let urlbar = this._window.document.getElementById("urlbar-container");
        toolbox.insertBefore(button, urlbar);
        unloaders.push(function() toolbox.removeChild(button));
    },
    
    togglePanel: function(options) {
        let popup = this._window.document.getElementById('share-popup');
        if (popup.state == 'open') {
            this._sharePanel.close();
        } else {
            this._sharePanel.show(options);
        }
    },
    
    whoFrom: function() {
        
    },
    
    isValidURI: function (aURI) {
      // Only open the share frame for http/https/ftp urls, file urls for testing.
      return (aURI && (aURI.schemeIs('http') || aURI.schemeIs('https') ||
                       aURI.schemeIs('file') || aURI.schemeIs('ftp')));
    },
    
    observe: function(subject, topic, data) {
        if (topic == "xul-overlay-merged") {
            let tmp = {};
            
            this._sharePanel = this._window.document.getElementById('share-popup');
            this._addToolbarButton();
            
            Cu.import("resource://f1/modules/panel.js", tmp);
            this._sharePanel = new tmp.sharePanel(this._window);
            
            // Load FUEL to access Application and setup preferences
            let Application = Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);
            this.prefs = {
                system: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".system", "prod"),
                share_url: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".share_url", ""),
                frontpage_url: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".frontpage_url", ""),
                bookmarking: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".bookmarking", true),
                previous_version: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".previous_version", ""),
                
                // Cannot rename firstRun to first_install since it would mess up already deployed clients,
                // would pop a new F1 window on an upgrade vs. fresh install.
                firstRun: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".first-install", ""),
                use_accel_key: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".use_accel_key", true)
           };
        }
    }
};

let unloaders = [];
function startup(data, reason) AddonManager.getAddonByID(data.id, function(addon) {
    /* Let's register ourselves a resource: namespace */
    let resource = Services.io.getProtocolHandler("resource")
                   .QueryInterface(Ci.nsIResProtocolHandler);
    let alias = Services.io.newFileURI(data.installPath);
    if (!data.installPath.isDirectory())
        alias = Services.io.newURI("jar:" + alias.spec + "!/", null, null);
    resource.setSubstitution("f1", alias);
    
    /* Setup l10n */
    getString.init(addon);
    
    /* We use winWatcher to create an instance per window (current and future) */
    function f1Factory(win) {
        win.addEventListener("load", function() {
            win.removeEventListener("load", arguments.callee, false);
            let doc = win.document.documentElement;
            if (doc.getAttribute("windowtype") == "navigator:browser") {
                win.gBrowser.f1 = new f1(win, addon);
            }
        }, false);
    }
    
    let iter = Cc["@mozilla.org/appshell/window-mediator;1"]
               .getService(Ci.nsIWindowMediator)
               .getEnumerator("navigator:browser");
    while (iter.hasMoreElements()) {
        let win = iter.getNext().QueryInterface(Ci.nsIDOMWindow);
        if (win.gBrowser != null)
            win.gBrowser.f1 = new f1(win, addon)
        else
            f1Factory(win);
    }
    function winWatcher(subject, topic) {
        if (topic != "domwindowopened")
            return;
        f1Factory(subject);
    }
    Services.ww.registerNotification(winWatcher);
    unloaders.push(function() Services.ww.unregisterNotification(winWatcher));
})

function shutdown(data, reason)
{
    if (reason == APP_SHUTDOWN) return;
    unloaders.forEach(function(unload) unload && unload());
}

function install()
{
}

function uninstall()
{
}
