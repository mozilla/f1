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

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var buttonId = 'ffshare-toolbar-button';

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
    this._getString = getString;
    
    // Hang on, the window may not be fully loaded yet
    let self = this;
    function checkWindow()
    {
        if (win.document.readyState !== "complete") {
            let timeout = win.setTimeout(checkWindow, 1000);
            unloaders.push(function() win.clearTimeout(timeout));
        } else {
            self.overlay();
        }
    }
    checkWindow();
}
f1.prototype = {
    _beStylin: function() {
        var sss = Components.classes["@mozilla.org/content/style-sheet-service;1"]
                            .getService(Components.interfaces.nsIStyleSheetService);
        let uri = this._addon.getResourceURI("chrome/skin/overlay.css");
        if(!sss.sheetRegistered(uri, sss.USER_SHEET))
          sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
        unloaders.push(function() sss.unregisterSheet(uri, sss.USER_SHEET));
    },
    _command: function() {
        let document = this._window.document;
        let commandset = document.createElementNS(NS_XUL, 'commandset');
        commandset.setAttribute('id', 'shareCommandset')
        
        let command = document.createElementNS(NS_XUL, 'command');
        command.setAttribute('id', 'cmd_toggleSharePage');
        command.setAttribute('oncommand', "gBrowser.f1.togglePanel();");
        commandset.appendChild(command);
        document.documentElement.appendChild(commandset);

        unloaders.push(function() {
            document.documentElement.removeChild(
                document.getElementById('shareCommandset')
            );
        });
    },
    _keyset: function() {
        let document = this._window.document;
        let key = document.createElementNS(NS_XUL, 'key');
        key.setAttribute('id', 'key_ffshare');
        key.setAttribute('command', 'cmd_toggleSharePage');
        document.getElementById('mainKeyset').appendChild(key);
        unloaders.push(function() {
            document.getElementById('mainKeyset').removeChild(
                document.getElementById('key_ffshare')
            );
        });
    },
    _contextMenu: function() {
        let document = this._window.document;
        let context = document.getElementById('contentAreaContextMenu');
        let place = document.getElementById('context-sendpage').nextSibling;
        //let popup = document.createElementNS(NS_XUL, 'popup');
        //popup.setAttribute('id', 'contentAreaContextMenu');
        
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
    },
    _panel: function() {
        let document = this._window.document;
        
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
    },
    _fileMenu: function() {
        let document = this._window.document;
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
    },
    _addToolbarButton: function() {
        let self = this;

        let Application = Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);

        // We clone an existing button because creating a new one from scratch
        // does not seem to work (perhaps some missing properties?)
        let document = this._window.document;
        let button = document.createElementNS(NS_XUL, 'toolbarbutton');
        
        let toolbox = document.getElementById("navigator-toolbox");
        let palette = document.getElementById('BrowserToolbarPalette') || toolbox.palette;
        
        // Setup label and tooltip
        button.setAttribute("id", buttonId);
        button.setAttribute("type",  "checkbox");
        button.setAttribute("label",  getString("ffshareToolbarButton.label"));
        button.setAttribute("tooltipText",  getString("ffshareToolbarButton.tooltip"));
        button.setAttribute("class",  "chromeclass-toolbar-additional");
        button.setAttribute("command",  "cmd_toggleSharePage");
        button.style.border = "none";
        
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
    },
    
    overlay: function() {
        this._beStylin();
        this._command();
        this._keyset();
        this._contextMenu();
        this._panel();
        this._fileMenu();
        this._addToolbarButton();
        
        this.setMeUp();
    },
    
    togglePanel: function(options) {
        let popup = this._window.document.getElementById('share-popup');
        if (popup.state == 'open') {
            this._sharePanel.close();
        } else {
            this._sharePanel.show(options);
        }
    },
    
    isValidURI: function (aURI) {
      // Only open the share frame for http/https/ftp urls, file urls for testing.
      return (aURI && (aURI.schemeIs('http') || aURI.schemeIs('https') ||
                       aURI.schemeIs('file') || aURI.schemeIs('ftp')));
    },
    
    setMeUp: function() {
        let tmp = {};
        
        Cu.import("resource://f1/modules/panel.js", tmp);
        this._sharePanel = new tmp.sharePanel(this._window, this);
        
        // Inject code into content
        tmp = {};
        let self = this;
        Cu.import("resource://f1/modules/injector.js", tmp);
        let ffapi = {
            apibase: null, // null == 'navigator.mozilla.labs'
            name: 'share', // builds to 'navigator.mozilla.labs.share'
            script: null, // null == use injected default script
            getapi: function () {
                return function (options) {
                    self.togglePanel(options);
                };
            }
        };
        tmp.InjectorInit(self._window);
        self._window.injector.register(ffapi);
          
        // Load FUEL to access Application and setup preferences
        let Application = Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);
        this.prefs = {
            system: Application.prefs.getValue(
                "extensions." + FFSHARE_EXT_ID + ".system",
                "prod"
            ),
            share_url: Application.prefs.getValue(
                "extensions." + FFSHARE_EXT_ID + ".share_url",
                "https://f1.mozillamessaging.com/share/panel/"
            ),
            frontpage_url: Application.prefs.getValue(
                "extensions." + FFSHARE_EXT_ID + ".frontpage_url",
                "http://f1.mozillamessaging.com/"
            ),
            bookmarking: Application.prefs.getValue(
                "extensions." + FFSHARE_EXT_ID + ".bookmarking",
                true
            ),
            previous_version: Application.prefs.getValue(
                "extensions." + FFSHARE_EXT_ID + ".previous_version",
                ""
            ),
            
            // Cannot rename firstRun to first_install since it would mess
            // up already deployed clients, would pop a new F1 window on
            // an upgrade vs. fresh install.
            firstRun: Application.prefs.getValue(
                "extensions." + FFSHARE_EXT_ID + ".first-install",
                ""
            ),
            use_accel_key: Application.prefs.getValue(
                "extensions." + FFSHARE_EXT_ID + ".use_accel_key",
                true
            )
       };
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
        if (win.document.readyState === "complete")
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

    let resource = Services.io.getProtocolHandler("resource")
                   .QueryInterface(Ci.nsIResProtocolHandler);
    resource.setSubstitution("f1", null);
    unloaders.forEach(function(unload) unload && unload());
}

function install()
{
}

function uninstall()
{
}
