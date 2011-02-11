/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
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
 * Mozilla Messaging, Inc..
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * */

'use strict';
/*jslint indent: 2, es5: true, plusplus: false, onevar: false,
  bitwise: false, nomen: false */
/*global document: false, setInterval: false, clearInterval: false, Services: false,
  Application: false, gBrowser: false, window: false, Components: false,
  Cc: false, Ci: false, PlacesUtils: false, gContextMenu: false,
  XPCOMUtils: false, ffshareAutoCompleteData: false, AddonManager: false,
  BrowserToolboxCustomizeDone: false, InjectorInit: false, injector: false,
  getComputedStyle: false, gNavToolbox: false, XPCNativeWrapper: false,
  Image: false */

var ffshare;
var FFSHARE_EXT_ID = "ffshare@mozilla.org";
(function () {
  var Cc = Components.classes,
      Ci = Components.interfaces,
      Cu = Components.utils,
      slice = Array.prototype.slice,
      ostring = Object.prototype.toString,
      empty = {}, fn,
      buttonId = 'ffshare-toolbar-button';

  // width/height tracking for the panel, initial values are defaults to
  // show the configure status panel
  // with fx3, we have to set the dimensions of the panel, with fx4, we have to
  // set the dimensions of the browser in the panel.
  var defaultWidth = 400, lastWidth = 400;
  var defaultHeight = 180, lastHeight = 180;
  var panelWidthMargin = 41;
  var panelHeightMargin = 45;

  Cu.import("resource://ffshare/modules/ffshareAutoCompleteData.js");
  Cu.import("resource://ffshare/modules/injector.js");
  Cu.import("resource://gre/modules/XPCOMUtils.jsm");

  // Firefox 4 has the nice Services module
  Cu.import("resource://gre/modules/Services.jsm");

  //////  Extensions to the Services object //////

  XPCOMUtils.defineLazyServiceGetter(Services, "bookmarks",
                                     "@mozilla.org/browser/nav-bookmarks-service;1",
                                     "nsINavBookmarksService");

  Cu.import("resource://gre/modules/AddonManager.jsm");

  function getButton() {
    return document.getElementById(buttonId);
  }

  function mixin(target, source, override) {
    //TODO: consider ES5 getters and setters in here.
    for (var prop in source) {
      if (!(prop in empty) && (!(prop in target) || override)) {
        target[prop] = source[prop];
      }
    }
  }

  //Allows setting multiple attributes, but using a simple JS
  //object construction.
  function setAttrs(node, obj) {
    for (var prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        node.setAttribute(prop, obj[prop]);
      }
    }
  }

  function unescapeXml(text) {
    return text.replace(/&lt;|&#60;/g, '<')
               .replace(/&gt;|&#62;/g, '>')
               .replace(/&amp;|&#38;/g, '&')
               .replace(/&apos;|&#39;/g, '\'')
               .replace(/&quot;|&#34;/g, '"');
  }

  function log(msg) {
    Cu.reportError('.' + msg); // avoid clearing on empty log
  }

  function error(msg) {
    Cu.reportError('.' + msg); // avoid clearing on empty log
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

  /**
   * This progress listener looks for HTTP codes that are errors/not
   * successses and puts up the "server down" page bundled in the extension.
   * This listener is related to the HttpActivityObserver, but that one handles
   * cases when the server is just not reachable via the network. This one
   * handles the cases where the server is reachable but is freaking out.
   */
  function StateProgressListener(browser) {
    this.browser = browser;
  }

  StateProgressListener.prototype = {
    // detect communication from the iframe via location setting
    QueryInterface: function (aIID) {
      if (aIID.equals(Components.interfaces.nsIWebProgressListener)   ||
          aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
          aIID.equals(Components.interfaces.nsISupports)) {
        return this;
      }
      throw Components.results.NS_NOINTERFACE;
    },

    onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {
      var flags = Components.interfaces.nsIWebProgressListener;
      if (aStateFlags & flags.STATE_IS_WINDOW &&
                 aStateFlags & flags.STATE_STOP) {
        var status;

        try {
          status = aRequest.nsIHttpChannel.responseStatus;
        } catch (e) {
          //Could be just an invalid URL or not an http thing. Need to be sure to not endlessly
          //load error page if it is already loaded.
          //Also ignore this state for about:blank which is apparently used as
          //a placeholder by FF while first creating the panel/browser element.
          var href = this.browser.contentWindow.location.href;
          if (href !== ffshare.errorPage && href !== 'about:blank') {
            status = 1000;
          } else {
            status = 200;
          }
        }

        if (status < 200 || status > 399) {
          this.browser.contentWindow.location = ffshare.errorPage;
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

  var firstRunProgressListener = {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener,
                                           Ci.nsISupportsWeakReference,
                                           Ci.nsISupports]),

    onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {
      // maybe can just use onLocationChange, but I don't think so?
      var flags = Ci.nsIWebProgressListener;

      // This seems like an excessive check but works very well
      if (aStateFlags & flags.STATE_IS_WINDOW &&
                 aStateFlags & flags.STATE_STOP) {
        if (!ffshare.didOnFirstRun) {
          //Be sure to disable first run after one try. Even if it does
          //not work, do not want to annoy the user with continual popping up
          //of the front page.
          ffshare.didOnFirstRun = true;
          ffshare.onFirstRun();
        }
      }
    },

    onLocationChange: function (aWebProgress, aRequest, aLocation) {},
    onProgressChange: function (aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
    onSecurityChange: function (aWebProgress, aRequest, aState) {},
    onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) {}
  };

  var canShareProgressListener = {
    QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener,
                                           Ci.nsISupportsWeakReference,
                                           Ci.nsISupports]),

    onLocationChange: function (aWebProgress, aRequest, aLocation) {
      ffshare.canShareURI(aLocation);
      //dump("onlocationchange causing switchtab\n");
      window.setTimeout(function () {
        ffshare.switchTab(true);
      }, 0);
    },

    onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {},
    onProgressChange: function (aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
    onSecurityChange: function (aWebProgress, aRequest, aState) {},
    onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) {}
  };


  /**
   * This observer looks for conditions where the server is not reachable
   * by the network, and puts up the "server down" page. This observer is
   * related to the StateProgressListener, but that one handles the cases
   * where the server is reachable by the network but causes an error.
   */
  var nsIHttpActivityObserver = Ci.nsIHttpActivityObserver;
  function HttpActivityObserver(browser) {
    this.browser = browser;
  }
  HttpActivityObserver.prototype = {
    // copied largely from firebug net.js
    registered: false,

    registerObserver: function () {
      if (!Ci.nsIHttpActivityDistributor) {
        return;
      }

      if (this.registered) {
        return;
      }

      var distributor = this.getActivityDistributor();
      if (!distributor) {
        return;
      }

      distributor.addObserver(this);
      this.registered = true;
    },

    unregisterObserver: function () {
      if (!Ci.nsIHttpActivityDistributor) {
        return;
      }

      if (!this.registered) {
        return;
      }

      var distributor = this.getActivityDistributor();
      if (!distributor) {
        return;
      }

      distributor.removeObserver(this);
      this.registered = false;
    },

    getActivityDistributor: function () {
      var activityDistributor = null;
      try {
        var dist = Cc["@mozilla.org/network/http-activity-distributor;1"];
        if (dist) {
          activityDistributor = dist.getService(Ci.nsIHttpActivityDistributor);
        }
      } catch (e) {
        log("nsIHttpActivityDistributor no available " + e + "\n");
      }
      delete this.activityDistributor;
      return (this.activityDistributor = activityDistributor);
    },

    getWindowForRequest: function (channel) {
      var lctx;
      try {
        if (channel && channel.notificationCallbacks) {
          lctx = channel.notificationCallbacks.getInterface(Ci.nsILoadContext);
          return lctx.associatedWindow;
        }
      } catch(e) {}
      try {
        if (channel && channel.loadGroup && channel.loadGroup.notificationCallbacks) {
          lctx = channel.loadGroup.notificationCallbacks.getInterface(Ci.nsILoadContext);
          return lctx.associatedWindow;
        }
      } catch(e) {}
      return null;
    },

    getDocumentForWin: function (win) {
      try {
        var theDoc = win.QueryInterface(Ci.nsIInterfaceRequestor)
                          .getInterface(Ci.nsIWebNavigation)
                          .QueryInterface(Ci.nsIDocShell)
                          .chromeEventHandler.contentDocument;
        //dump("got a document "+theDoc+"\n");
        try {
          return XPCNativeWrapper.unwrap(theDoc);
        } catch (e) {
          return theDoc.wrappedJSObject;
        }
      } catch(e) {}
      return null;
    },

    getBrowserForRequest: function (channel) {
      if (!this.browser.contentDocument)
        return null;
      var win = this.getWindowForRequest(channel);
      if (!win) {
        return null;
      }
      var theDoc = this.getDocumentForWin(win);
      if (theDoc !== this.browser.contentDocument.wrappedJSObject) {
        //dump("they dont match "+theDoc+" !== "+this.browser.contentDocument.wrappedJSObject+"\n");
        return null;
      }
      return this.browser;
    },

    /* nsIActivityObserver */
    observeActivity: function (httpChannel, activityType, activitySubtype,
                              timestamp, extraSizeData, extraStringData) {
      try {
        if (httpChannel instanceof Ci.nsIHttpChannel) {
          this.observeRequest(httpChannel, activityType, activitySubtype, timestamp,
                extraSizeData, extraStringData);
        }
      } catch (e) {
        log("observeActivity: EXCEPTION " + e + "\n");
      }
    },

    observeRequest: function (httpChannel, activityType, activitySubtype,
                             timestamp, extraSizeData, extraStringData) {
      var browser = this.getBrowserForRequest(httpChannel);
      if (!browser) {
        return;
      }

      if (activityType === nsIHttpActivityObserver.ACTIVITY_TYPE_HTTP_TRANSACTION) {
        if (activitySubtype === nsIHttpActivityObserver.ACTIVITY_SUBTYPE_REQUEST_HEADER) {
          //dump("ACTIVITY_SUBTYPE_REQUEST_HEADER for "+httpChannel.name+" \n");
          browser.__response_headers_received = false;
        } else
        if (activitySubtype === nsIHttpActivityObserver.ACTIVITY_SUBTYPE_TRANSACTION_CLOSE) {
          // If we don't have response headers then we did not recieve a response,
          // but skip the case where the page is the about:blank filler used
          // by the browser when first loading a browser.
          //dump("ACTIVITY_SUBTYPE_TRANSACTION_CLOSE for "+httpChannel.name+" \n");
          if (!browser.__response_headers_received && browser.currentURI.spec !== 'about:blank') {
            //dump("loading error page for "+httpChannel.name+"\n");
            browser.loadURI(ffshare.errorPage);
            gBrowser.selectedTab.shareState.forceReload = true;
          }
        } else
        if (activitySubtype === nsIHttpActivityObserver.ACTIVITY_SUBTYPE_RESPONSE_HEADER) {
          //dump("ACTIVITY_SUBTYPE_RESPONSE_HEADER for "+httpChannel.name+" \n");
          browser.__response_headers_received = true;
        }
      }
    },

    /* nsISupports */
    QueryInterface: XPCOMUtils.generateQI([Ci.nsISupports,
                                           Ci.nsIActivityObserver])

  };


  // singleton controller for the share panel
  // A state object is attached to each browser tab when the share panel
  // is opened for that tab.  The state object is removed from the current
  // tab when the panel is closed.
  var sharePanel = {
    init: function() {
      this.browser = document.getElementById('share-browser');
      this.panel = document.getElementById('share-popup');

      // hookup esc to also close the panel
      // XXX not working, maybe need to listen on window
      this.panel.addEventListener('keypress', fn.bind(this, function (e) {
        if (e.keyCode === 27 /*"VK_ESC"*/) {
          this.close();
        }
      }), false);

      this.loadListener = fn.bind(this, function (evt) {
        var self = this;
        window.setTimeout(function () {
          self.sizeToContent();
        }, 0);
      });
      this.browser.addEventListener("load", this.loadListener, true);

      Services.obs.addObserver(this, 'content-document-global-created', false);

      this.httpObserver = new HttpActivityObserver(this.browser);
      this.httpObserver.registerObserver();

      var webProgress = this.browser.webProgress;
      this.stateProgressListener = new StateProgressListener(this.browser);
      webProgress.addProgressListener(this.stateProgressListener, Components.interfaces.nsIWebProgress.NOTIFY_STATE_WINDOW);

    },
    
    shutdown: function() {
      Services.obs.removeObserver(this, 'content-document-global-created');
      
      this.httpObserver.unregisterObserver();

      var webProgress = this.browser.webProgress;
      webProgress.removeProgressListener(this.stateProgressListener);
      this.stateProgressListener = null;
    },

    observe: function (aSubject, aTopic, aData) {
      if (!aSubject.location.href) {
        return;
      }

      // is this window a child of OUR XUL window?
      var mainWindow = aSubject.QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIWebNavigation)
                     .QueryInterface(Ci.nsIDocShellTreeItem)
                     .rootTreeItem
                     .QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIDOMWindow);
      mainWindow = mainWindow.wrappedJSObject ? mainWindow.wrappedJSObject : mainWindow;
      if (mainWindow !== this.panel.ownerDocument.defaultView) {
        return;
      }
      // listen for messages now
      var contentWindow = this.browser.contentWindow;
      contentWindow = contentWindow.wrappedJSObject ? contentWindow.wrappedJSObject : contentWindow;
      contentWindow.addEventListener("message", fn.bind(this, function (evt) {
        //Make sure we only act on messages from the page we expect.
        if (ffshare.prefs.share_url.indexOf(evt.origin) === 0) {
          //Mesages have the following properties:
          //name: the string name of the messsage
          //data: the JSON structure of data for the message.
          var message = evt.data, skip = false, topic, data;

          try {
            //Only some messages are valid JSON, only care about the ones
            //that are.
            message = JSON.parse(message);
          } catch (e) {
            skip = true;
          }
          if (!skip) {
            topic = message.topic;
            data = message.data;

            if (topic && this[topic]) {
              this[topic](data);
            }
          }
        }
      }), false);
    },

    //Fired when a pref changes from content space. the pref object has
    //a name and value.
    prefChanged: function (pref) {
      Application.prefs.setValue("extensions." + FFSHARE_EXT_ID + "." + pref.name, pref.value);
    },

    getOptions: function(options) {
      options = options || {};
      mixin(options, {
        version: ffshare.version,
        title: this.getPageTitle(),
        description: this.getPageDescription(),
        medium: this.getPageMedium(),
        url: gBrowser.currentURI.spec,
        canonicalUrl: this.getCanonicalURL(),
        shortUrl: this.getShortURL(),
        previews: this.previews(),
        siteName: this.getSiteName(),
        prefs: {
          system: ffshare.prefs.system,
          bookmarking: ffshare.prefs.bookmarking,
          use_accel_key: ffshare.prefs.use_accel_key
        }
      });
      return options;
    },

    /**
     * PostMessage APIs
     * Called by content page when share is successful.
     * @param {Object} data info about the share.
     */
    success: function (data) {
      this.close();

      if (ffshare.prefs.bookmarking) {
        var tags = ['shared', 'f1'];
        if (data.domain === 'twitter.com') {
          tags.push("twitter");
        }
        if (data.domain === 'facebook.com') {
          tags.push("facebook");
        }

        var nsiuri = Services.io.newURI(gBrowser.currentURI.spec, null, null);
        Services.bookmarks.insertBookmark(Services.bookmarks.unfiledBookmarksFolder,
                                          nsiuri, Services.bookmarks.DEFAULT_INDEX,
                                          this.getPageTitle().trim());

        PlacesUtils.tagging.tagURI(nsiuri, tags);
      }
    },

    getPageTitle: function () {
      var metas = gBrowser.contentDocument.querySelectorAll("meta[property='og:title']"),
          i, title, content;
      for (i = 0; i < metas.length; i++) {
        content = metas[i].getAttribute("content");
        if (content) {
          //Title could have some XML escapes in it since it could be an
          //og:title type of tag, so be sure unescape
          return unescapeXml(content.trim());
        }
      }
      metas = gBrowser.contentDocument.querySelectorAll("meta[name='title']");
      for (i = 0; i < metas.length; i++) {
        content = metas[i].getAttribute("content");
        if (content) {
          //Title could have some XML escapes in it so be sure unescape
          return unescapeXml(content.trim());
        }
      }
      title = gBrowser.contentDocument.getElementsByTagName("title")[0];
      if (title && title.firstChild) {
        //Use node Value because we have nothing else
        return title.firstChild.nodeValue.trim();
      }
      return "";
    },

    getPageDescription: function () {
      var metas = gBrowser.contentDocument.querySelectorAll("meta[property='og:description']"),
          i, content;
      for (i = 0; i < metas.length; i++) {
        content = metas[i].getAttribute("content");
        if (content) {
          return unescapeXml(content);
        }
      }
      metas = gBrowser.contentDocument.querySelectorAll("meta[name='description']");
      for (i = 0; i < metas.length; i++) {
        content = metas[i].getAttribute("content");
        if (content) {
          return unescapeXml(content);
        }
      }
      return "";
    },

    getSiteName: function () {
      var metas = gBrowser.contentDocument.querySelectorAll("meta[property='og:site_name']");
      for (var i = 0; i < metas.length; i++) {
        var content = metas[i].getAttribute("content");
        if (content) {
          return unescapeXml(content);
        }
      }
      return "";
    },

    // According to Facebook - (only the first 3 are interesting)
    // Valid values for medium_type are audio, image, video, news, blog, and mult.
    getPageMedium: function () {
      var metas = gBrowser.contentDocument.querySelectorAll("meta[property='og:type']"),
          i, content;
      for (i = 0; i < metas.length; i++) {
        content = metas[i].getAttribute("content");
        if (content) {
          return unescapeXml(content);
        }
      }
      metas = gBrowser.contentDocument.querySelectorAll("meta[name='medium']");
      for (i = 0; i < metas.length; i++) {
        content = metas[i].getAttribute("content");
        if (content) {
          return unescapeXml(content);
        }
      }
      return "";
    },

    getShortURL: function () {
      var shorturl = gBrowser.contentDocument.getElementById("shorturl"),
          links = gBrowser.contentDocument.querySelectorAll("link[rel='shortlink']");

      // flickr does id="shorturl"
      if (shorturl) {
        return shorturl.getAttribute("href");
      }

      for (var i = 0; i < links.length; i++) {
        var content = links[i].getAttribute("href");
        if (content) {
          return gBrowser.currentURI.resolve(content);
        }
      }
      return "";
    },

    getCanonicalURL: function () {
      var links = gBrowser.contentDocument.querySelectorAll("meta[property='og:url']"),
          i, content;

      for (i = 0; i < links.length; i++) {
        content = links[i].getAttribute("content");
        if (content) {
          return gBrowser.currentURI.resolve(content);
        }
      }

      links = gBrowser.contentDocument.querySelectorAll("link[rel='canonical']");

      for (i = 0; i < links.length; i++) {
        content = links[i].getAttribute("href");
        if (content) {
          return gBrowser.currentURI.resolve(content);
        }
      }

      // Finally try some hacks for certain sites
      return this.getCanonicalURLHacks();
    },

    // This will likely be a collection of hacks for certain sites we want to
    // work but currently don't provide the right kind of meta data
    getCanonicalURLHacks: function () {
      // Google Maps Hack :( obviously this regex isn't robust
      if (/^maps\.google\.[a-zA-Z]{2,5}/.test(gBrowser.currentURI.host)) {
        return gBrowser.contentDocument.getElementById("link").getAttribute("href");
      }

      return '';
    },

    getThumbnailData: function () {
      var canvas = gBrowser.contentDocument.createElement("canvas"); // where?
      canvas.setAttribute('width', '90');
      canvas.setAttribute('height', '70');
      var tab = gBrowser.selectedTab;
      var win = gBrowser.getBrowserForTab(tab).contentWindow;
      var aspectRatio = canvas.width / canvas.height;
      var w = win.innerWidth + win.scrollMaxX;
      var h = Math.max(win.innerHeight, w / aspectRatio);

      if (w > 10000) {
        w = 10000;
      }
      if (h > 10000) {
        h = 10000;
      }

      var canvasW = canvas.width;
      var canvasH = canvas.height;
      var ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvasW, canvasH);
      ctx.save();

      var scale = canvasH / h;
      ctx.scale(scale, scale);
      ctx.drawWindow(win, 0, 0, w, h, "rgb(255,255,255)");
      ctx.restore();
      var img = canvas.toDataURL("image/png", "");
      return img;
    },

    /**
     * Method used to generate thumbnail data from a postMessage
     * originating from the share UI in content-space
     */
    generateBase64Preview: function (imgUrl) {
      var img = new Image();
      img.onload = fn.bind(this, function () {

        var canvas = gBrowser.contentDocument.createElement("canvas"),
            win = this.browser.contentWindow.wrappedJSObject,
            w = img.width,
            h = img.height,
            dataUrl, canvasW, canvasH, ctx, scale;

        //Put upper constraints on the image size.
        if (w > 10000) {
          w = 10000;
        }
        if (h > 10000) {
          h = 10000;
        }

        canvas.setAttribute('width', '90');
        canvas.setAttribute('height', '70');

        canvasW = canvas.width;
        canvasH = canvas.height;
        ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvasW, canvasH);
        ctx.save();

        scale = canvasH / h;
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, w, h);
        ctx.restore();
        dataUrl = canvas.toDataURL("image/png", "");

        win.postMessage(JSON.stringify({
          topic: 'base64Preview',
          data: dataUrl
        }), win.location.protocol + "//" + win.location.host);

      });
      img.src = imgUrl;

    },

    previews: function () {
      // Look for FB og:image and then rel="image_src" to use if available
      // for og:image see: http://developers.facebook.com/docs/share
      // for image_src see: http://about.digg.com/thumbnails
      var metas = gBrowser.contentDocument.querySelectorAll("meta[property='og:image']"),
          links = gBrowser.contentDocument.querySelectorAll("link[rel='image_src']"),
          previews = [], i, content;

      for (i = 0; i < metas.length; i++) {
        content = metas[i].getAttribute("content");
        if (content) {
          previews.push({
            http_url : content,
            base64 : ""
          });
        }
      }

      for (i = 0; i < links.length; i++) {
        content = links[i].getAttribute("href");
        if (content) {
          previews.push({
            http_url : content,
            base64 : ""
          });
        }
      }

      // Push in the page thumbnail last in case there aren't others
      previews.push(
        {
          http_url : "",
          base64 : this.getThumbnailData()
        }
      );
      return previews;
    },

    //Methods for handling autocomplete

    escapeHtml: function (text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },

    autoCompleteData: function (data) {
      ffshareAutoCompleteData.set(data);
    },
    
    sizeToContent: function () {
      var doc = this.browser.contentDocument.wrappedJSObject;
      var wrapper = doc && doc.getElementById('wrapper');
      if (!wrapper) {
        return;
      }
      // XXX argh, we really should look at the panel and see what margins/padding
      // sizes are and calculate that way, however this is pretty complex due
      // to how the background image of the panel is used,
      //dump("content size is "+wrapper.scrollWidth+" x "+wrapper.scrollHeight+"\n");
      var h = lastWidth > defaultHeight ? lastWidth: defaultHeight;
      lastWidth = wrapper.scrollWidth;
      lastHeight = wrapper.scrollHeight > 0 ? wrapper.scrollHeight : h;
      this.browser.style.width = lastWidth + "px";
      this.browser.style.height = lastHeight + "px";
    },


    // panelUI operations
    close: function () {
      this.panel.hidePopup();
      gBrowser.selectedTab.shareState = null;
      // Always ensure the button is unchecked when the panel is hidden
      getButton().removeAttribute("checked");
    },

    hide: function () {
      this.close();
    },
    

    show: function (options) {
      var tabURI = gBrowser.getBrowserForTab(gBrowser.selectedTab).currentURI,
          tabUrl = tabURI.spec;

      if (!ffshare.isValidURI(tabURI)) {
        return;
      }
      var currentState = gBrowser.selectedTab.shareState;
      options = this.getOptions(options);
      
      gBrowser.selectedTab.shareState = {
        options: options, // currently not used for anything
        forceReload: false
      };

      var url = ffshare.prefs.share_url +
                '#options=' + encodeURIComponent(JSON.stringify(options));

      // adjust the size
      this.browser.style.width = lastWidth + 'px';
      this.browser.style.height = lastHeight + 'px';
      //Make sure it can go all the way to zero.
      this.browser.style.minHeight = 0;

      if (currentState && currentState.forceReload)
        this.browser.loadURI(url);
      else
        this.browser.setAttribute('src', url);

      var button = getButton();
      // Always ensure the button is checked if the panel is open
      button.setAttribute("checked", true);

      // Always ensure we aren't glowing if the person clicks on the button
      button.removeAttribute("firstRun");

      // fx 4
      var position = (getComputedStyle(gNavToolbox, "").direction === "rtl") ? 'bottomcenter topright' : 'bottomcenter topleft';
      this.panel.openPopup(button, position, 0, 0, false, false);
    }    
  };


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

  ffshare = {

    version: '',
    prefs: {
      // We only use Application.prefs for the nice getValue/setValue methods
      system: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".system", "prod"),
      share_url: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".share_url", ""),
      frontpage_url: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".frontpage_url", ""),
      bookmarking: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".bookmarking", true),
      previous_version: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".previous_version", ""),
      //Cannot rename firstRun to first_install since it would mess up already deployed clients,
      //would pop a new F1 window on an upgrade vs. fresh install.
      firstRun: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".first-install", ""),
      use_accel_key: Application.prefs.getValue("extensions." + FFSHARE_EXT_ID + ".use_accel_key", true)
    },

    errorPage: 'chrome://ffshare/content/down.html',

    keycodeId: "key_ffshare",
    keycode : "VK_F1",
    oldKeycodeId: "key_old_ffshare",

    onInstallUpgrade: function (version) {
      ffshare.version = version;

      //Only run if the versions do not match.
      if (version === ffshare.prefs.previous_version) {
        return;
      }

      //Update prefs.previous_version pref. Do this now in case an error below
      //prevents it -- do not want to get in a situation where for instance
      //we pop the front page URL for every tab navigation.
      ffshare.prefs.previous_version = version;
      Application.prefs.setValue("extensions." + FFSHARE_EXT_ID + ".previous_version", version);

      // Place the button in the toolbar, before the URL bar.
      try {
        var beforeId = "urlbar-container";   // ID of element to insert before

        var navBar  = document.getElementById("nav-bar"),
            curSet  = navBar.currentSet.split(","),
            set, pos;

        //TODO: REMOVE this at some point. 0.7.x versions of the extension
        //added the button to the end of the list, and this list is not updated
        //on uninstall. So for now remove the buttonId from the end of the list.
        //This could be frustrating for users how explicitly move it to the end
        //for for at least the first 0.8.x release, do this so that most people
        //get the new position, then remove this line in the next release.
        if (curSet[curSet.length - 1] === buttonId) {
          curSet.pop();
        }

        if (curSet.indexOf(buttonId) === -1) {
          //Insert our ID before the URL bar ID.
          pos = curSet.indexOf(beforeId) || curSet.length;
          curSet.splice(pos, 0, buttonId);
          set = curSet.join(",");

          navBar.setAttribute("currentset", set);
          navBar.currentSet = set;
          document.persist(navBar.id, "currentset");
          try {
            BrowserToolboxCustomizeDone(true);
          }
          catch (e) {}
        }
      }
      catch (ex) {}

      if (ffshare.prefs.firstRun) {
        //Make sure to set the pref first to avoid bad things if later code
        //throws and we cannot set the pref.
        ffshare.prefs.firstRun = false;
        Application.prefs.setValue("extensions." + FFSHARE_EXT_ID + ".first-install", false);

        //Register first run listener.
        gBrowser.getBrowserForTab(gBrowser.selectedTab).addProgressListener(firstRunProgressListener, Ci.nsIWebProgress.NOTIFY_STATE_DOCUMENT);
        this.addedFirstRunProgressListener = true;
      }
    },

    onLoad: function () {
      sharePanel.init();

      AddonManager.getAddonByID(FFSHARE_EXT_ID, function (addon) {
        ffshare.onInstallUpgrade(addon.version);
      });

      try {
        gBrowser.addProgressListener(canShareProgressListener);
      } catch (ex) {
        error(ex);
      }

      document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", this.onContextMenuItemShowing, false);

      this.initKeyCode();

      Services.prefs.addObserver("extensions." + FFSHARE_EXT_ID + ".", this, false);

      //Events triggered by TabView (panorama)
      this.tabViewShowListener = fn.bind(this, ffshare.onTabViewShow);
      this.tabViewHideListener = fn.bind(this, ffshare.onTabViewHide);
      window.addEventListener('tabviewshow', this.tabViewShowListener, false);
      window.addEventListener('tabviewhide', this.tabViewHideListener, false);
    },

    onUnload: function () {
      // initialization code
      if (this.addedFirstRunProgressListener) {
        gBrowser.getBrowserForTab(gBrowser.selectedTab).removeProgressListener(firstRunProgressListener);
      }

      try {
        gBrowser.removeProgressListener(canShareProgressListener);
      } catch (e) {
        error(e);
      }

      document.getElementById("contentAreaContextMenu").removeEventListener("popupshowing", this.onContextMenuItemShowing, false);

      Services.prefs.removeObserver("extensions." + FFSHARE_EXT_ID + ".", this);

      //Events triggered by TabView (panorama)
      window.removeEventListener('tabviewshow', this.tabViewShowListener, false);
      window.removeEventListener('tabviewhide', this.tabViewHideListener, false);
      this.tabViewShowListener = null;
      this.tabViewHideListener = null;
    },

    onFirstRun: function () {
      // create a hidden iframe and get it to load the standard contents
      // to prefill the cache
      var browser = gBrowser.getBrowserForTab(gBrowser.selectedTab);
      var notificationBox = gBrowser.getNotificationBox(browser);
      var iframeNode = document.createElement("browser");
      iframeNode.setAttribute("type", "content");
      iframeNode.setAttribute("style", "width: 100px; height: 100px; background: pink;");
      iframeNode.setAttribute("src", ffshare.prefs.share_url);
      iframeNode.setAttribute("style", "visibility: collapse;");
      notificationBox.insertBefore(iframeNode, notificationBox.firstChild);

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
            window.open(url);
          }
        }
      }

      openAndReuseOneTabPerURL(this.prefs.frontpage_url);
    },

    // This function is to be run once at onLoad
    // Checks for the existence of key code already and saves or gives it an ID for later
    // We could get away without this check but we're being nice to existing key commands
    initKeyCode: function () {
      var keys = document.getElementsByTagName("key");
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

    observe: function (subject, topic, data) {
      var pref;

      if (topic !== "nsPref:changed") {
        return;
      }

      if ("extensions." + FFSHARE_EXT_ID + ".use_accel_key" === data) {
        try {
          pref = subject.QueryInterface(Ci.nsIPrefBranch);
          //dump("topic: " + topic + " -- data: " + data + " == pref: " + pref.getBoolPref(data) + "\n");
          ffshare.setAccelKey(pref.getBoolPref(data));
        } catch (e) {
          error(e);
        }
      }
    },

    setAccelKey: function (keyOn) {
      var oldKey = document.getElementById(this.oldKeycodeId),
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
        } catch (ex) {
          error(ex);
        }
      }

      // now we invalidate the keyset cache so our changes take effect
      p = keyset.parentNode;
      p.appendChild(p.removeChild(keyset));

    },

    isValidURI: function (aURI) {
      //Only open the share frame for http/https/ftp urls, file urls for testing.
      return (aURI && (aURI.schemeIs('http') || aURI.schemeIs('https') ||
                       aURI.schemeIs('file') || aURI.schemeIs('ftp')));
    },

    canShareURI: function (aURI) {
      var command = document.getElementById("cmd_toggleSharePage");
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

    onContextMenuItemShowing: function (e) {
      try {
        var hide = (gContextMenu.onTextInput || gContextMenu.onLink ||
                    gContextMenu.onImage || gContextMenu.isContentSelected ||
                    gContextMenu.onCanvas || gContextMenu.onVideo ||
                    gContextMenu.onAudio),
            hideSelected = (gContextMenu.onTextInput || gContextMenu.onLink ||
                            !gContextMenu.isContentSelected ||
                            gContextMenu.onImage || gContextMenu.onCanvas ||
                            gContextMenu.onVideo || gContextMenu.onAudio);

        document.getElementById("context-ffshare").hidden = hide;
        document.getElementById("context-ffshare-separator").hidden = hide;

        document.getElementById("context-selected-ffshare").hidden = hideSelected;
        document.getElementById("context-selected-ffshare-separator").hidden = hideSelected;
      } catch (ignore) { }
    },

    switchTab: function (waitForLoad) {
      if (waitForLoad) {
        // this double-loads the share panel since image data may not be
        // available yet
        let self = this;
        gBrowser.contentWindow.addEventListener('DOMContentLoaded', function() {
          self.switchTab(false);
        }, true);
      }
      var selectedTab = gBrowser.selectedTab;
      var visible = document.getElementById('share-popup').state == 'open';
      if (visible && !selectedTab.shareState) {
        sharePanel.hide();
      }
      if (selectedTab.shareState) {
        window.setTimeout(function () {
          sharePanel.show({});
        }, 0);
      }
    },

    onTabViewShow: function (e) {
      // Triggered by TabView (panorama). Always hide it if being shown.
      if (document.getElementById('share-popup').state == 'open') {
        sharePanel.hide();
      }
    },

    onTabViewHide: function (e) {
      // Triggered by TabView (panorama). Restore share panel if needed.
      // Hmm this never seems to be called? browser-tabview.js shows
      // creation of a 'tabviewhide' event, but this function does
      // not seem to be called.
      this.switchTab();
    },

    togglePanel: function (options) {
      if (document.getElementById('share-popup').state == 'open') {
        sharePanel.close();
      } else {
        sharePanel.show(options);
      }
    }
  };

  if (!ffshare.prefs.share_url) {
    if (ffshare.prefs.system === 'dev') {
      ffshare.prefs.share_url = 'http://linkdrop.caraveo.com:5000/share/panel/';
    } else if (ffshare.prefs.system === 'staging') {
      ffshare.prefs.share_url = 'https://f1-staging.mozillamessaging.com/share/panel/';
    } else {
      ffshare.prefs.share_url = 'https://f1.mozillamessaging.com/share/panel/';
    }
  }

  if (!ffshare.prefs.frontpage_url) {
    if (ffshare.prefs.system === 'dev') {
      ffshare.prefs.frontpage_url = 'http://linkdrop.caraveo.com:5000/';
    } else if (ffshare.prefs.system === 'staging') {
      ffshare.prefs.frontpage_url = 'http://f1-staging.mozillamessaging.com/';
    } else {
      ffshare.prefs.frontpage_url = 'http://f1.mozillamessaging.com/';
    }
  }

  var ffapi = {
    apibase: null, // null == 'navigator.mozilla.labs'
    name: 'share', // builds to 'navigator.mozilla.labs.share'
    script: null, // null == use injected default script
    getapi: function () {
      return function (options) {
        ffshare.toggle(options);
      };
    }
  };
  InjectorInit(window);
  injector.register(ffapi);

  window.addEventListener("load", fn.bind(ffshare, "onLoad"), false);
  window.addEventListener("unload", fn.bind(ffshare, "onUnload"), false);
}());
