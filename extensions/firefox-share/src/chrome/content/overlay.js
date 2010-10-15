'use strict';
/*jslint indent: 2, plusplus: false */
/*global document: false, setInterval: false, clearInterval: false,
  Application: false, gBrowser: false, window: false, Components: false */

var ffshare;
var FFSHARE_EXT_ID = "ffshare@mozilla.org";
(function () {

  var slice = Array.prototype.slice,
      ostring = Object.prototype.toString, fn;

  var queryToObject = function (/*String*/ str) {
    // summary:
    //        Create an object representing a de-serialized query section of a
    //        URL. Query keys with multiple values are returned in an array.
    //
    // example:
    //        This string:
    //
    //    |        "foo=bar&foo=baz&thinger=%20spaces%20=blah&zonk=blarg&"
    //
    //        results in this object structure:
    //
    //    |        {
    //    |            foo: [ "bar", "baz" ],
    //    |            thinger: " spaces =blah",
    //    |            zonk: "blarg"
    //    |        }
    //
    //        Note that spaces and other urlencoded entities are correctly
    //        handled.
    var ret = {},
        qp = str.split('&'),
        dec = decodeURIComponent,
        parts, name, val;

    qp.forEach(function (item) {
        if (item.length) {
            parts = item.split('=');
            name = dec(parts.shift());
            val = dec(parts.join('='));
            if (typeof ret[name] === 'string') {
                ret[name] = [ret[name]];
            }

            if (ostring.call(ret[name]) === '[object Array]') {
                ret[name].push(val);
            } else {
                ret[name] = val;
            }
        }
    });
    return ret;
  };

  function log(msg) {
    Application.console.log('.'+msg); // avoid clearing on empty log
  }

  function error(msg) {
    Components.utils.reportError('.'+msg); // avoid clearing on empty log
  }

  fn = {

    /**
     * Determines if the input a function.
     * @param {Object} it whatever you want to test to see if it is a function.
     * @returns Boolean
     */
    is: function (it) {
      return ostring.call(it) === '[object Function]';
    },

    /**
     * Different from Function.prototype.bind in ES5 --
     * it has the "this" argument listed first. This is generally
     * more readable, since the "this" object is visible before
     * the function body, reducing chances for error by missing it.
     * If only obj has a real value then obj will be returned,
     * allowing this method to be called even if you are not aware
     * of the format of the obj and f types.
     * It also allows the function to be a string name, in which case,
     * obj[f] is used to find the function.
     * @param {Object||Function} obj the "this" object, or a function.
     * @param {Function||String} f the function of function name that
     * should be called with obj set as the "this" value.
     * @returns {Function}
     */
    bind: function (obj, f) {
      //Do not bother if 
      if (!f) {
        return obj;
      }

      //Make sure we have a function
      if (typeof f === 'string') {
        f = obj[f];
      }
      var args = slice.call(arguments, 2);
      return function () {
        return f.apply(obj, args.concat(slice.call(arguments, 0)));
      };
    }
  };

  var iframeProgressListener = {
    // detect communication from the iframe via location setting
    QueryInterface: function(aIID) {
      if (aIID.equals(Components.interfaces.nsIWebProgressListener)   ||
          aIID.equals(Components.interfaces.nsIWebProgressListener2)  ||
          aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
          aIID.equals(Components.interfaces.nsISupports))
        return this;
      throw Components.results.NS_NOINTERFACE;
    },

    onLocationChange: function(/*in nsIWebProgress*/ aWebProgress,
                          /*in nsIRequest*/ aRequest,
                          /*in nsIURI*/ aLocation) {
      var hashIndex = aLocation.spec.indexOf("#");
      if (hashIndex != -1) {
        var tail = aLocation.spec.slice(hashIndex+1, aLocation.spec.length);
        if (tail.indexOf("!success") === 0) {
          ffshare.hide();

          // XXX Should probably have a pref to disable auto-tagging & auto-bookmarking
          var bits = tail.slice("!success:".length, tail.length);
          var retvals = queryToObject(bits);
          var tags = ['shared', 'linkdrop'];
          if (retvals.domain == 'twitter.com') {
            tags.push("twitter");
          }
          if (retvals.domain == 'facebook.com') {
            tags.push("facebook");
          }

          if (ffshare.useBookmarking) {
            var ios = Cc["@mozilla.org/network/io-service;1"].
                   getService(Ci.nsIIOService);
            var nsiuri = ios.newURI(gBrowser.currentURI.spec, null, null);
            var bmsvc = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"]
                        .getService(Components.interfaces.nsINavBookmarksService);
            bmsvc.insertBookmark(bmsvc.unfiledBookmarksFolder, nsiuri, bmsvc.DEFAULT_INDEX, ffshare.getPageTitle().trim());
  
            PlacesUtils.tagging.tagURI(nsiuri, tags);
          }
        } else if (tail == "!resize") {
          ffshare.matchIframeContentHeight();
        }
      }
    }
  };

  var navProgressListener = {
    // detect navigational events for the tab, so we can close

    QueryInterface: function(aIID) {
      if (aIID.equals(Components.interfaces.nsIWebProgressListener)   ||
          aIID.equals(Components.interfaces.nsIWebProgressListener2)  ||
          aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
          aIID.equals(Components.interfaces.nsISupports))
        return this;
      throw Components.results.NS_NOINTERFACE;
    },

    onLocationChange: function(/*in nsIWebProgress*/ aWebProgress,
                          /*in nsIRequest*/ aRequest,
                          /*in nsIURI*/ aLocation) {
      // For now, any navigation causes collapsing.
      // XXX refine to be tolerant of #-appending
      ffshare.hide();
    }
  };

  ffshare = {

    onPopupShown: function() {
      Application.console.log("shownPOPUP!");
    },

    frameAnimationTime: 300,

    system: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".system", "prod"),
    shareUrl: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".share_url", ""),
    frontpageUrl: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".frontpage_url", ""),
    useBookmarking: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".bookmarking", true),
    firstRun: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".first-install", true),

    onFirstRun: function () {
      // create a hidden iframe and get it to load the standard contents
      // to prefill the cache
      var iframeNode = document.createElement("browser");
      iframeNode.setAttribute("type", "content");
      iframeNode.setAttribute("style", "width: 100px; height: 100px; background: pink;");
      iframeNode.setAttribute("src", this.shareUrl);
      iframeNode.setAttribute("style", "visibility: collapse;");
      gBrowser.getBrowserForTab(gBrowser.selectedTab).parentNode.appendChild(iframeNode);

      //Taken from https://developer.mozilla.org/en/Code_snippets/Tabbed_browser
      function openAndReuseOneTabPerURL(url) {
        var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                           .getService(Components.interfaces.nsIWindowMediator);
        var browserEnumerator = wm.getEnumerator("navigator:browser");

        // Check each browser instance for our URL
        var found = false;
        while (!found && browserEnumerator.hasMoreElements()) {
          var browserWin = browserEnumerator.getNext();
          var tabbrowser = browserWin.gBrowser;

          // Check each tab of this browser instance
          var numTabs = tabbrowser.browsers.length;
          for (var index = 0; index < numTabs; index++) {
            var currentBrowser = tabbrowser.getBrowserAtIndex(index);
            if (url == currentBrowser.currentURI.spec) {

              // The URL is already opened. Select this tab.
              tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];

              // Focus *this* browser-window
              browserWin.focus();

              var rect = browserWin.document.getElementById("ffshare-toolbar-button").getBoundingClientRect();
              var browser = gBrowser.getBrowserForTab(tabbrowser.selectedTab);

              // try setting the button location as the window may have already loaded
              try {
                browser.contentWindow.wrappedJSObject.buttonX = rect.left + rect.width / 2;
                var evt = browser.contentWindow.wrappedJSObject.document.createEvent("Event");
                evt.initEvent("buttonX", true, false);
                browser.contentWindow.wrappedJSObject.dispatchEvent(evt);
              } catch (ignore) { }

              // Add the load handler in case the window hasn't finished loaded (unlikely)
              browser.addEventListener("load",
                                       function buttonX() {
                                          browser.removeEventListener("load", buttonX, true);
                                          browser.contentWindow.wrappedJSObject.buttonX = rect.left + rect.width / 2;
                                          var evt = browser.contentWindow.wrappedJSObject.document.createEvent("Event");
                                          evt.initEvent("buttonX", true, false);
                                          browser.contentWindow.wrappedJSObject.dispatchEvent(evt);
                                       }, true);

              found = true;
              break;
            }
          }
        }

        // Our URL isn't open. Open it now.
        if (!found) {
          var recentWindow = wm.getMostRecentWindow("navigator:browser");
          if (recentWindow) {
            var rect = recentWindow.document.getElementById("ffshare-toolbar-button").getBoundingClientRect();
            // Use the existing browser (recent) Window
            var tab = recentWindow.gBrowser.loadOneTab(url,{ referrerURI: null,
                                                             charset: null,
                                                             postData: null,
                                                             inBackground: false,
                                                             allowThirdPartyFixup: null });
            var browser = gBrowser.getBrowserForTab(tab);
            browser.addEventListener("load",
                                     function buttonX() {
                                        browser.removeEventListener("load", buttonX, true);
                                        browser.contentWindow.wrappedJSObject.buttonX = rect.left + rect.width / 2;
                                        var evt = browser.contentWindow.wrappedJSObject.document.createEvent("Event");
                                        evt.initEvent("buttonX", true, false);
                                        browser.contentWindow.wrappedJSObject.dispatchEvent(evt);
                                     }, true);
          }
          else {
            // No browser windows are open, so open a new one.
            window.open(url);
          }
        }
      };

      openAndReuseOneTabPerURL(this.frontpageUrl);

      // curse you first install prefs!
      Application.prefs.setValue("extensions." + FFSHARE_EXT_ID + ".first-install", false);
    },

    onMenuItemCommand: function (e) {
      this.onToolbarButtonCommand(e);
    },

    registerListener: function() {
      this.shareFrame.webProgress.addProgressListener(iframeProgressListener, Components.interfaces.nsIWebProgress.NOTIFY_LOCATION);
      gBrowser.getBrowserForTab(gBrowser.selectedTab).webProgress.addProgressListener(navProgressListener, Components.interfaces.nsIWebProgress.NOTIFY_LOCATION);
    },
    
    unregisterListener: function(listener) {
      this.shareFrame.webProgress.removeProgressListener(iframeProgressListener);
      gBrowser.getBrowserForTab(gBrowser.selectedTab).webProgress.removeProgressListener(navProgressListener);
    },

    hide: function () {
      this.unregisterListener();
      this.changeHeight(0, fn.bind(this, function () {
          this.shareFrame.parentNode.removeChild(this.shareFrame);
          this.shareFrame = null;
      }));
    },

    get tab() {
      return gBrowser.selectedTab;
    },

    get shareFrameId() {
      return "ffhsare" + this.tab.getAttribute("linkedpanel").replace("panel","");
    },

    get shareFrameExists() {
      return (document.getElementById(this.shareFrameId) != null);
    },

    get shareFrame() {
      var parentNode = gBrowser.getBrowserForTab(gBrowser.selectedTab).parentNode,
          id = this.shareFrameId, iframeNode = null, url, options;

      iframeNode = document.getElementById(id);

      if (iframeNode == null) {
        //Create the iframe.
        iframeNode = document.createElement("browser");

        iframeNode.id = id;
        iframeNode.className = 'ffshare-frame';
        iframeNode.style.width = '100%';
        iframeNode.style.height = '114px';
        //Make sure it can go all the way to zero.
        iframeNode.style.minHeight = 0;

        options = {
          title: this.getPageTitle(),
          description : this.getPageDescription(),
          medium : this.getPageMedium(),
          url: gBrowser.currentURI.spec,
          canonicalUrl: this.getCanonicalURL(),
          shortUrl: this.getShortURL(),
          previews: this.previews(),
          system: this.system
        };

        if (! options.previews.length) {
          // then we need to make our own thumbnail
          options['thumbnail'] = this.getThumbnailData();
        }

        url = this.shareUrl +
                  '#options=' + encodeURIComponent(JSON.stringify(options));

        iframeNode.setAttribute("type", "content");
        iframeNode.setAttribute("src", url);
        parentNode.insertBefore(iframeNode, parentNode.firstChild);

      }
      return iframeNode;
    },

    show: function () {
      var iframeNode = this.shareFrame;

      if (this.frontpageUrl == gBrowser.getBrowserForTab(gBrowser.selectedTab).currentURI.spec) {
        var browser = gBrowser.getBrowserForTab(gBrowser.selectedTab);
        // If we're looking at the front page we should clear the first run helper
        var evt = browser.contentWindow.wrappedJSObject.document.createEvent("Event");
        evt.initEvent("hideInstalled", true, false);
        browser.contentWindow.wrappedJSObject.dispatchEvent(evt);
      }

      /*
      //Figure out if CSS transitions can be used
      if ('MozTransition' in iframeNode.style) {
        this.useCssTransition = true;
        iframeNode.addEventListener("transitionend", fn.bind(this, 'onTransitionEnd'), true);
      } else {
        this.useCssTransition = false;
      }
      iframeNode.addEventListener('DOMContentLoaded', fn.bind(this, 'matchIframeContentHeight'), true);
      */

      this.registerListener();
    },

    changeHeight: function (height, onEnd) {

      if (this.useCssTransition) {
        this.onHeightEnd = onEnd;
      }
      
      this.shareFrame.style.height = height + 'px';

      if (!this.useCssTransition && onEnd) {
        onEnd();
      }
    },

    matchIframeContentHeight: function () {
      var height = this.shareFrame.contentDocument.documentElement.getBoundingClientRect().height;
      this.changeHeight(height);
    },

    onTransitionEnd: function (evt) {
      if (this.onHeightEnd) {
        this.onHeightEnd();
      }
    },

    onToolbarButtonCommand: function (e) {
      if (this.shareFrameExists) {
        this.hide();
      } else {
        this.show();
      }
    },

    getPageTitle: function () {
      var metaNodes = gBrowser.contentDocument.getElementsByTagName('meta');
      var titleNode = gBrowser.contentDocument.getElementsByTagName('title')[0];
      for (var i = 0; i < metaNodes.length; i++) {
        if ("title" == metaNodes[i].getAttribute("name")) {
          var content = metaNodes[i].getAttribute("content");
          if (content)
            return content.trim();
        }
      }
      if (titleNode) {
        return titleNode.firstChild.nodeValue.trim();
      }
      return '';
    },

    getPageDescription: function () {
      var metaNodes = gBrowser.contentDocument.getElementsByTagName('meta');
      for (var i = 0; i < metaNodes.length; i++) {
        if ("description" == metaNodes[i].getAttribute("name")) {
          var content = metaNodes[i].getAttribute("content");
          if (content)
            return content;
        }
      }
      return "";
    },

    // According to Facebook - (only the first 3 are interesting)
    // Valid values for medium_type are audio, image, video, news, blog, and mult.
    getPageMedium: function() {
      var metaNodes = gBrowser.contentDocument.getElementsByTagName('meta');
      for (var i = 0; i < metaNodes.length; i++) {
        if ("medium" == metaNodes[i].getAttribute("name")) {
          var content = metaNodes[i].getAttribute("content");
          if (content)
            return content;
        }
      }
      return "";
    },

    getShortURL: function() {
      var links = gBrowser.contentDocument.getElementsByTagName("link"),
        rel = null,
        rev = null,
        i;

      // flickr does id="shorturl"
      var shorturl = gBrowser.contentDocument.getElementById("shorturl");
      if (shorturl) {
        return shorturl.getAttribute("href");
      }

      for (i = 0; i < links.length; i++) {
        // is there a rel=shortlink href?
        if (links[i].getAttribute("rel") === "shortlink") {
          return gBrowser.currentURI.resolve(links[i].getAttribute("href"));
        }
      }
      return "";
    },

    getCanonicalURL: function () {
      var links = gBrowser.contentDocument.getElementsByTagName("link"),
        rel = null,
        i;

      for (i = 0; i < links.length; i++) {
        if (links[i].getAttribute("rel") === "canonical") {
          return gBrowser.currentURI.resolve(links[i].getAttribute("href"));
        }
      }

      // Finally try some hacks for certain sites
      return this.getURLHacks();
    },

    // This will likely be a collection of hacks for certain sites we want to
    // work but currently don't provide the right kind of meta data
    getURLHacks: function () {
      // Google Maps Hack :( obviously this regex isn't robust
      if (/^maps\.google.*/.test(gBrowser.currentURI.host))
        return gBrowser.contentDocument.getElementById("link").getAttribute("href");

      return '';
    },

    getThumbnailData: function() {
      var canvas = gBrowser.contentDocument.createElement("canvas"); // where?
      canvas.setAttribute('width', '90');
      canvas.setAttribute('height', '70');
      var tab = gBrowser.selectedTab;
      var win = gBrowser.getBrowserForTab(tab).contentWindow;
      var aspectRatio = canvas.width / canvas.height;
      var w = win.innerWidth + win.scrollMaxX;
      var h = Math.max(win.innerHeight, w/aspectRatio);

      if (w > 10000) w = 10000;
      if (h > 10000) h = 10000;

      var canvasW = canvas.width;
      var canvasH = canvas.height;
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.save();

      var scale = canvasH/h;
      ctx.scale(scale, scale);
      ctx.drawWindow(win, 0, 0, w, h, "rgb(255,255,255)");
      ctx.restore();
      return canvas.toDataURL("image/png", "");
    },

    previews: function () {
      // Look for rel="image_src" and use those if they're available
      // see e.g. http://about.digg.com/thumbnails

      var links = gBrowser.contentDocument.getElementsByTagName("link"),
          previews = [], i;

      for (i = 0; i < links.length; i++) {
        if (links[i].getAttribute("rel") === "image_src") {
          previews.push(links[i].getAttribute("href"));
        }
      }
      return previews;
    }
  };

  if (!ffshare.shareUrl) {
    if (ffshare.system === 'dev') {
      ffshare.shareUrl = 'http://linkdrop.caraveo.com:5000/share/';
    } else {
      ffshare.shareUrl = 'https://linkdrop.mozillamessaging.com/share/';
    }
  }

  if (!ffshare.frontpageUrl) {
    if (ffshare.system === 'dev') {
      ffshare.frontpageUrl = 'http://linkdrop.caraveo.com:5000/frontpage/';
    } else {
      ffshare.frontpageUrl = 'https://linkdrop.mozillamessaging.com/frontpage/';
    }
  }
}());
