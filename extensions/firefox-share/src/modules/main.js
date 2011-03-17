
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
    let unloaders = [];
    unloaders.push(function () {
        win.gBrowser.f1.unload();
        win.gBrowser.f1 = null;
    });
    return unloaders;
}

function log(msg) {
    dump(msg+"\n");
    Cu.reportError('.' + msg); // avoid clearing on empty log
}

function error(msg) {
    dump(msg+"\n");
    Cu.reportError('.' + msg); // avoid clearing on empty log
}

function sendJustInstalledEvent(win, url) {
  var buttonNode = win.document.getElementById(buttonId);
  //Button may not be there if customized and removed from toolbar.
  if (buttonNode) {
    var tab = win.gBrowser.loadOneTab(url, { referrerURI: null,
                                             charset: null,
                                             postData: null,
                                             inBackground: false,
                                             allowThirdPartyFixup: null });
    // select here and there in case the load was quick
    win.gBrowser.selectedTab = tab;
    tab.addEventListener("load", function tabevent() {
                                    tab.removeEventListener("load", tabevent, true);
                                    win.gBrowser.selectedTab  = tab;
                                  }, true);
    buttonNode.setAttribute("firstRun", "true");
  }
}

function makeInstalledLoadHandler(win, url) {
  var handler = function () {
    win.removeEventListener("load", handler, true);
    sendJustInstalledEvent(win, url);
  };
  return handler;
}

//Taken from https://developer.mozilla.org/en/Code_snippets/Tabbed_browser
function openAndReuseOneTabPerURL(url) {
  var browserEnumerator = Services.wm.getEnumerator("navigator:browser"),
      rect, browser, buttonNode;
  // Check each browser instance for our URL
  var found = false;
  try {
    while (!found && browserEnumerator.hasMoreElements()) {
      var browserWin = browserEnumerator.getNext();
      var tabbrowser = browserWin.gBrowser;

      // Sometimes we don't get a tabbrowser element
      if (tabbrowser) {
        // Check each tab of this browser instance
        var numTabs = tabbrowser.browsers.length;
        for (var index = 0; index < numTabs; index++) {
          var currentBrowser = tabbrowser.getBrowserAtIndex(index);
          if (currentBrowser.currentURI &&
              url === currentBrowser.currentURI.spec) {

            // The URL is already opened. Select this tab.
            tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];

            // Focus *this* browser-window
            browserWin.focus();

            buttonNode = browserWin.document.getElementById(buttonId);
            //Button may not be there if customized and removed from toolbar.
            if (buttonNode) {
              buttonNode.setAttribute("firstRun", "true");
            }

            found = true;
            break;
          }
        }
      }
    }
  // Minefield likes to error out in this loop sometimes
  } catch (ignore) { }

  // Our URL isn't open. Open it now.
  if (!found) {
    var recentWindow = Services.wm.getMostRecentWindow("navigator:browser");
    if (recentWindow) {
      // If our window is opened and ready just open the tab
      //   possible values: (loading, complete, or uninitialized)
      if (recentWindow.document.readyState === "complete") {
        sendJustInstalledEvent(recentWindow, url);
      } else {
        // Otherwise the window, while existing, might not be ready yet so we wait to open our tab
        recentWindow.addEventListener("load", makeInstalledLoadHandler(recentWindow, url), true);
      }
    }
    else {
      // No browser windows are open, so open a new one.
      this.window.open(url);
    }
  }
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
    keycodeId: "key_ffshare",
    keycode : "VK_F1",
    oldKeycodeId: "key_old_ffshare",

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
                true
            ),
            use_accel_key: Application.prefs.getValue(
                "extensions." + FFSHARE_EXT_ID + ".use_accel_key",
                true
            )
        };

        // dev and staging settings are based on the system pref
        if (this.prefs.system === 'dev') {
          this.prefs.share_url = 'http://linkdrop.caraveo.com:5000/share/panel/';
        } else if (this.prefs.system === 'staging') {
          this.prefs.share_url = 'https://f1-staging.mozillamessaging.com/share/panel/';
        }
      
        if (this.prefs.system === 'dev') {
          this.prefs.frontpage_url = 'http://linkdrop.caraveo.com:5000/';
        } else if (this.prefs.system === 'staging') {
          this.prefs.frontpage_url = 'http://f1-staging.mozillamessaging.com/';
        }

        let self = this;
        AddonManager.getAddonByID(FFSHARE_EXT_ID, function (addon) {
            self.onInstallUpgrade(addon.version);
        });
      
        try {
            this.canShareProgressListener = new LocationChangeProgressListener(this);
            this.window.gBrowser.addProgressListener(this.canShareProgressListener);
        } catch (e) {
            error(e);
        }
        
        this.onContextMenuItemShowing = function(e) {
            self._onContextMenuItemShowing(e);
        }
        this.window.document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", this.onContextMenuItemShowing, false);

        this.initKeyCode();

        Services.prefs.addObserver("extensions." + FFSHARE_EXT_ID + ".", this, false);

        //Events triggered by TabView (panorama)
        this.tabViewShowListener = function() { self.onTabViewShow() };
        this.tabViewHideListener = function() { self.onTabViewHide() };
        this.window.addEventListener('tabviewshow', this.tabViewShowListener, false);
        this.window.addEventListener('tabviewhide', this.tabViewHideListener, false);
    },
    
    unload: function() {
        try {
            this.window.gBrowser.removeProgressListener(this.canShareProgressListener);
        } catch (e) {
            error(e);
        }

        this.window.document.getElementById("contentAreaContextMenu").removeEventListener("popupshowing", this.onContextMenuItemShowing, false);

        //Events triggered by TabView (panorama)
        this.window.removeEventListener('tabviewshow', this.tabViewShowListener, false);
        this.window.removeEventListener('tabviewhide', this.tabViewHideListener, false);
        this.tabViewShowListener = null;
        this.tabViewHideListener = null;
    },
    
    onInstallUpgrade: function (version) {
      this.version = version;

      //Only run if the versions do not match.
      if (version === this.prefs.previous_version) {
        return;
      }
      let Application = Cc["@mozilla.org/fuel/application;1"].getService(Ci.fuelIApplication);

      this.prefs.previous_version = version;
      Application.prefs.setValue("extensions." + FFSHARE_EXT_ID + ".previous_version", version);

      if (this.prefs.firstRun) {
        //Make sure to set the pref first to avoid bad things if later code
        //throws and we cannot set the pref.
        this.prefs.firstRun = false;
        Application.prefs.setValue("extensions." + FFSHARE_EXT_ID + ".first-install", false);
        openAndReuseOneTabPerURL(this.prefs.frontpage_url);
      }
    },

    // This function is to be run once at onLoad
    // Checks for the existence of key code already and saves or gives it an ID for later
    // We could get away without this check but we're being nice to existing key commands
    initKeyCode: function () {
      var keys = this.window.document.getElementsByTagName("key");
      for (var i = 0; i < keys.length; i++) {
        // has the keycode we want to take and isn't already ours
        if (this.keycode === keys[i].getAttribute("keycode") &&
            this.keycodeId !== keys[i].id) {

          if (keys[i].id) {
            this.oldKeycodeId = keys[i].id;
          }
          else {
            keys[i].id = this.oldKeycodeId;
          }

          break;
        }
      }
      this.setAccelKey(this.prefs.use_accel_key);
    },

    _onContextMenuItemShowing: function (e) {
      try {
        let contextMenu = this.window.gContextMenu;
        let document = this.window.document;
        let hide = (contextMenu.onTextInput || contextMenu.onLink ||
                    contextMenu.onImage || contextMenu.isContentSelected ||
                    contextMenu.onCanvas || contextMenu.onVideo ||
                    contextMenu.onAudio);
        let hideSelected = (contextMenu.onTextInput || contextMenu.onLink ||
                            !contextMenu.isContentSelected ||
                            contextMenu.onImage || contextMenu.onCanvas ||
                            contextMenu.onVideo || contextMenu.onAudio);

        document.getElementById("context-ffshare").hidden = hide;
        document.getElementById("context-ffshare-separator").hidden = hide;

        document.getElementById("context-selected-ffshare").hidden = hideSelected;
        document.getElementById("context-selected-ffshare-separator").hidden = hideSelected;
      } catch (e) { }
    },

    observe: function (subject, topic, data) {
      if (topic !== "nsPref:changed") {
        return;
      }

      let pref = subject.QueryInterface(Ci.nsIPrefBranch);
      //dump("topic: " + topic + " -- data: " + data + " == pref: " + pref.getBoolPref(data) + "\n");
      if ("extensions." + FFSHARE_EXT_ID + ".use_accel_key" === data) {
        try {
          this.setAccelKey(pref.getBoolPref(data));
        } catch (e) {
          error(e);
        }
      } else if ("extensions." + FFSHARE_EXT_ID + ".bookmarking" === data) {
        try {
          this.prefs.bookmarking = pref.getBoolPref(data);
        } catch (e) {
          error(e);
        }
      }
    },

    setAccelKey: function (keyOn) {
      let document = this.window.document,
          oldKey = document.getElementById(this.oldKeycodeId),
          f1Key = document.getElementById(this.keycodeId),
          keyset = document.getElementById("mainKeyset"),
          p;

      if (keyOn) {
        try {
          if (oldKey) {
            oldKey.setAttribute("keycode", "");
          }
          f1Key.setAttribute("keycode", this.keycode);
        } catch (e) {
          error(e);
        }
      } else {
        try {
          f1Key.setAttribute("keycode", "");
          if (oldKey) {
            oldKey.setAttribute("keycode", this.keycode);
          }
        } catch (e) {
          error(e);
        }
      }

      // now we invalidate the keyset cache so our changes take effect
      p = keyset.parentNode;
      p.appendChild(p.removeChild(keyset));

    },
    
    onTabViewShow: function (event) {
      // Triggered by TabView (panorama). Always hide it if being shown.
      if (this.window.document.getElementById('share-popup').state === 'open') {
        this.sharePanel.hide();
      }
    },

    onTabViewHide: function (event) {
      // Triggered by TabView (panorama). Restore share panel if needed.
      // Hmm this never seems to be called? browser-tabview.js shows
      // creation of a 'tabviewhide' event, but this function does
      // not seem to be called.
      this.switchTab();
    }

};

