
const FFSHARE_EXT_ID = "ffshare@mozilla.org";
const {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

Cu.import("resource://ffshare/modules/progress.js");

const NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";

const buttonId = 'ffshare-toolbar-button';

var EXPORTED_SYMBOLS = ["startAddon"];

function startAddon(win) {
    win.gBrowser.f1 = new f1(win);
}

function log(msg) {
    dump(msg+"\n");
    Cu.reportError('.' + msg); // avoid clearing on empty log
}

function error(msg) {
    dump(msg+"\n");
    Cu.reportError('.' + msg); // avoid clearing on empty log
}

function f1(win)
{
    this.window = win;
    
    // Hang on, the window may not be fully loaded yet
    let self = this;
    function checkWindow()
    {
        if (win.document.readyState !== "complete") {
            let timeout = win.setTimeout(checkWindow, 1000);
            unloaders.push(function() win.clearTimeout(timeout));
        } else {
            self.init();
        }
    }
    checkWindow();
}
f1.prototype = {

    togglePanel: function(options) {
        let popup = this.window.document.getElementById('share-popup');
        if (popup.state == 'open') {
            this.sharePanel.close();
        } else {
            this.sharePanel.show(options);
        }
    },

    switchTab: function (waitForLoad) {
      let self = this;
      if (waitForLoad) {
        // this double-loads the share panel since image data may not be
        // available yet
        this.window.gBrowser.contentWindow.addEventListener('DOMContentLoaded', function () {
          self.switchTab(false);
        }, true);
      }

      var selectedTab = this.window.gBrowser.selectedTab;
      var visible = this.window.document.getElementById('share-popup').state === 'open';
      var isopen = selectedTab.shareState && selectedTab.shareState.open;
      if (visible && !isopen) {
        this.sharePanel.close();
      }
      if (isopen) {
        this.window.setTimeout(function () {
          self.sharePanel.show({});
        }, 0);
      } else {
        this.window.setTimeout(function () {
          self.sharePanel.updateStatus();
        }, 0);
      }
    },

    canShareURI: function (aURI) {
      var command = this.window.document.getElementById("cmd_toggleSharePage");
      try {
        if (this.isValidURI(aURI)) {
          command.removeAttribute("disabled");
        } else {
          command.setAttribute("disabled", "true");
        }
      } catch (e) {
        throw e;
      }
    },

    isValidURI: function (aURI) {
      // Only open the share frame for http/https/ftp urls, file urls for testing.
      return (aURI && (aURI.schemeIs('http') || aURI.schemeIs('https') ||
                       aURI.schemeIs('file') || aURI.schemeIs('ftp')));
    },
    
    installAPI: function() {
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
        tmp.InjectorInit(self.window);
        self.window.injector.register(ffapi);
    },
    
    init: function() {
        let tmp = {};
        
        Cu.import("resource://ffshare/modules/panel.js", tmp);
        this.sharePanel = new tmp.sharePanel(this.window, this);
        
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
       
        try {
            this.canShareProgressListener = new LocationChangeProgressListener(this);
            this.window.gBrowser.addProgressListener(this.canShareProgressListener);
        } catch (e) {
            error(e);
        }
    },
    
    unload: function() {
        try {
            this.window.gBrowser.removeProgressListener(this.canShareProgressListener);
        } catch (e) {
            error(e);
        }
    }
};

