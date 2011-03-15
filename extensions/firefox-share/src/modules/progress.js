const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const errorPage = "resource://ffshare/chrome/content/down.html";
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

// This progress listener looks for HTTP codes that are errors/not
// successses and puts up the "server down" page bundled in the extension.
// This listener is related to the HttpActivityObserver, but that one handles
// cases when the server is just not reachable via the network. This one
// handles the cases where the server is reachable but is freaking out.
function StateProgressListener(panel) {
    this.panel = panel;
}
StateProgressListener.prototype = {
    // detect communication from the iframe via location setting
    QueryInterface: function (aIID) {
        if (aIID.equals(Ci.nsIWebProgressListener)   ||
            aIID.equals(Ci.nsISupportsWeakReference) ||
            aIID.equals(Ci.nsISupports)) {
            return this;
        }
        throw Components.results.NS_NOINTERFACE;
    },

    onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {
        let flags = Ci.nsIWebProgressListener;
        
        if (!('nsIHttpChannel' in aRequest))
            return;
        
        if (aStateFlags & flags.STATE_IS_WINDOW && aStateFlags & flags.STATE_STOP) {
            let status;
            try {
                status = aRequest.nsIHttpChannel.responseStatus;
            } catch (e) {
                // Could be just an invalid URL or not an http thing. Need to be sure to not endlessly
                // load error page if it is already loaded.
                // Also ignore this state for about:blank which is apparently used as
                // a placeholder by FF while first creating the panel/browser element.
                // Check against channel.name, that is what we were *trying* to load.
                let href = aRequest.nsIHttpChannel.name;
                if (href !== errorPage && href !== 'about:blank') {
                    status = 1000;
                } else {
                    status = 200;
                }
            }

            if (status < 200 || status > 399) {
                this.panel.browser.contentWindow.location = errorPage;
                this.panel.forceReload = true;
            }
        }
    },

    onLocationChange: function (aWebProgress, aRequest, aLocation) {},
    onProgressChange: function (aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
    onSecurityChange: function (aWebProgress, aRequest, aState) {},
    onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) {
        //dump("onStatus Change: " + aRequest.nsIHttpChannel.responseStatus + ": " + aRequest.loadFlags + ", " + aRequest + ", " + aMessage);
    }
};

function LocationChangeProgressListener(f1) {
    this.f1 = f1;
}
LocationChangeProgressListener.prototype = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener,
                                         Ci.nsISupportsWeakReference,
                                         Ci.nsISupports]),

  onLocationChange: function (aWebProgress, aRequest, aLocation) {
    this.f1.canShareURI(aLocation);
    //dump("onlocationchange causing switchtab\n");
    let f1 = this.f1;
    f1.window.setTimeout(function () {
      f1.switchTab(true);
    }, 0);
  },

  onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {},
  onProgressChange: function (aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
  onSecurityChange: function (aWebProgress, aRequest, aState) {},
  onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) {}
};

function FirstRunProgressListener(f1) {
    this.f1 = f1;
}
FirstRunProgressListener.prototype = {
    QueryInterface: XPCOMUtils.generateQI(
        [Ci.nsIWebProgressListener, Ci.nsISupportsWeakReference, Ci.nsISupports]
    ),

    onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {
        // maybe can just use onLocationChange, but I don't think so?
        let flags = Ci.nsIWebProgressListener;
        // This seems like an excessive check but works very well
        if (aStateFlags & flags.STATE_IS_WINDOW && aStateFlags & flags.STATE_STOP) {
            if (!this.f1.didOnFirstRun) {
                //Be sure to disable first run after one try. Even if it does
                //not work, do not want to annoy the user with continual popping up
                //of the front page.
                this.f1.didOnFirstRun = true;
                this.f1.onFirstRun();
            }
        }
    },

    onLocationChange: function (aWebProgress, aRequest, aLocation) {},
    onProgressChange: function (aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
    onSecurityChange: function (aWebProgress, aRequest, aState) {},
    onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) {}
};

var EXPORTED_SYMBOLS = ["StateProgressListener",
                        "LocationChangeProgressListener",
                        "FirstRunProgressListener"];
