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

const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
const errorPage = "resource://ffshare/chrome/content/down.html";
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

const EXPORTED_SYMBOLS = ["StateProgressListener",
                          "LocationChangeProgressListener"];

/**
 * This progress listener looks for HTTP codes that are errors/not
 * successses and puts up the "server down" page bundled in the extension.
 * This listener is related to the HttpActivityObserver, but that one handles
 * cases when the server is just not reachable via the network. This one
 * handles the cases where the server is reachable but is freaking out.
 */
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
