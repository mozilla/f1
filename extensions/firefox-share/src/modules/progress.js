const { interfaces: Ci } = Components;
const errorPage = "resource://f1/chrome/content/down.html";

// This progress listener looks for HTTP codes that are errors/not
// successses and puts up the "server down" page bundled in the extension.
// This listener is related to the HttpActivityObserver, but that one handles
// cases when the server is just not reachable via the network. This one
// handles the cases where the server is reachable but is freaking out.
function StateProgressListener(browser) {
    this.browser = browser;
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
        var flags = Ci.nsIWebProgressListener;
        
        if (!('nsIHttpChannel' in aRequest))
            return;
        
        if (aStateFlags & flags.STATE_IS_WINDOW && aStateFlags & flags.STATE_STOP) {
            var status;
            try {
                status = aRequest.nsIHttpChannel.responseStatus;
            } catch (e) {
                // Could be just an invalid URL or not an http thing. Need to be sure to not endlessly
                // load error page if it is already loaded.
                // Also ignore this state for about:blank which is apparently used as
                // a placeholder by FF while first creating the panel/browser element.
                // Check against channel.name, that is what we were *trying* to load.
                var href = aRequest.nsIHttpChannel.name;
                if (href !== errorPage && href !== 'about:blank') {
                    status = 1000;
                } else {
                    status = 200;
                }
            }

            if (status < 200 || status > 399) {
                this.browser.contentWindow.location = errorPage;
                forceReload = true;
            }
        }
    },

    onLocationChange: function (aWebProgress, aRequest, aLocation) {},
    onProgressChange: function (aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
    onSecurityChange: function (aWebProgress, aRequest, aState) {},
    onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) {
        //log("onStatus Change: " + aRequest.nsIHttpChannel.responseStatus + ": " + aRequest.loadFlags + ", " + aRequest + ", " + aMessage);
    }
};

var EXPORTED_SYMBOLS = ["StateProgressListener"];
