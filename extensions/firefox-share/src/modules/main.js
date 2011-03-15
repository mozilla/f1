
const FFSHARE_EXT_ID = "ffshare@mozilla.org";
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

var buttonId = 'ffshare-toolbar-button';

var EXPORTED_SYMBOLS = ["startAddon"];

function startAddon(win) {
    win.gBrowser.f1 = new f1(win);
}

function f1(win)
{
    this._window = win;
    
    // Hang on, the window may not be fully loaded yet
    let self = this;
    function checkWindow()
    {
        if (win.document.readyState !== "complete") {
            let timeout = win.setTimeout(checkWindow, 1000);
            unloaders.push(function() win.clearTimeout(timeout));
        } else {
            self.setMeUp();
        }
    }
    checkWindow();
}
f1.prototype = {

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
        
        Cu.import("resource://ffshare/modules/panel.js", tmp);
        this._sharePanel = new tmp.sharePanel(this._window, this);
        
        // Inject code into content
        tmp = {};
        let self = this;
        Cu.import("resource://ffshare/modules/injector.js", tmp);
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

