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
  XPCOMUtils: false, AddonManager: false,
  BrowserToolboxCustomizeDone: false, InjectorInit: false, injector: false,
  getComputedStyle: false, gNavToolbox: false, XPCNativeWrapper: false,
  Image: false */


// XXX This is a hacked up version of overlay.js just to get things working
// in fennec

// TODO:
//
// a quick laundrey list that I can see....
//
// - hookup postmessage communication that the observer on content-document-global-created
//   does in the fx overlay
// - make the contentInfo object work
// - refactor contentInfo so it can be shared between both fx and fennec
// - move shared code to a single file
// - see if the ffshare object can be refactored to share code between fx and fennec
// - if injector will work in fennec, split that out to a shared file
// - at some point, share/panel got redesigned specificly to mobile, we need to
//   either move that to share/panel/m or otherwise deal with the differences

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
  var SHARE_STATUS = ["", "start", "error"];

  var forceReload = true;

  Cu.import("resource://ffshare/modules/injector.js");
  Cu.import("resource://gre/modules/XPCOMUtils.jsm");

  // Firefox 4 has the nice Services module
  Cu.import("resource://gre/modules/Services.jsm");

  ///// prefs support that works with both fx and fennec //////

  var extPrefs = Components.classes["@mozilla.org/preferences-service;1"]
                      .getService(Components.interfaces.nsIPrefBranch2);


  // argh!
  function getCharPref(name, def) {
    try {
      return extPrefs.getCharPref(name);
    } catch(e) {}
    return def;
  }
  function getBoolPref(name, def) {
    try {
      return extPrefs.getBoolPref(name);
    } catch(e) {}
    return def;
  }

  //////  Extensions to the Services object //////

  XPCOMUtils.defineLazyServiceGetter(Services, "bookmarks",
                                     "@mozilla.org/browser/nav-bookmarks-service;1",
                                     "nsINavBookmarksService");

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
    dump("LOG: "+msg+"\n");
    Cu.reportError('.' + msg); // avoid clearing on empty log
  }

  function error(msg) {
    dump("ERROR: "+msg+"\n");
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


  // functions to get information from the content we are sharing
  var contentInfo = {

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
            http_url : gBrowser.currentURI.resolve(content),
            base64 : ""
          });
        }
      }

      for (i = 0; i < links.length; i++) {
        content = links[i].getAttribute("href");
        if (content) {
          previews.push({
            http_url : gBrowser.currentURI.resolve(content),
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
    }
  }

  var fennecTab = {
    init: function() {
      
    },
    
    getOptions: function(options) {
      // XXX the calls to contentInfo here need to get data from the browser
      // tab that has the page content we want to share
      options = options || {};
      mixin(options, {
        version: ffshare.version,
        title: '',//contentInfo.getPageTitle(),
        description: '',//contentInfo.getPageDescription(),
        medium: '',//contentInfo.getPageMedium(),
        url: Browser.selectedTab.browser.currentURI.spec,
        canonicalUrl: '',//contentInfo.getCanonicalURL(),
        shortUrl: '',//contentInfo.getShortURL(),
        previews: '',//contentInfo.previews(),
        siteName: '',//contentInfo.getSiteName(),
        prefs: {
          system: ffshare.prefs.system,
          bookmarking: ffshare.prefs.bookmarking,
          use_accel_key: ffshare.prefs.use_accel_key
        }
      });
      return options;
    },
    
    open: function() {
      var tabURI = Browser.selectedTab.browser.currentURI,
          tabUrl = tabURI.spec;
      if (!ffshare.isValidURI(tabURI)) {
        return;
      }
      var currentState = Browser.selectedTab.shareState;
      var options = this.getOptions(options);

      Browser.selectedTab.shareState = {
        options: options, // currently not used for anything
        status: currentState ? currentState.status : 0,
        open: true
      };

      var url = ffshare.prefs.share_url +
                '#options=' + encodeURIComponent(JSON.stringify(options));
      Browser.addTab(url, true, Browser.selectedTab.browser);
    },
    
    close: function() {
      // close the share tab
    },
    
    hide: function() {
      // api called from share panel content, we can just close on fennec
    },
    
    updateStatus: function() {
      // called from content to provide user notification of share status
    }
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

  ffshare = {

    version: '',
    prefs: {
      // We only use extPrefs for the nice getValue/setValue methods
      system: getCharPref("extensions." + FFSHARE_EXT_ID + ".system", "prod"),
      share_url: getCharPref("extensions." + FFSHARE_EXT_ID + ".share_url", ""),
      frontpage_url: getCharPref("extensions." + FFSHARE_EXT_ID + ".frontpage_url", ""),
      bookmarking: getBoolPref("extensions." + FFSHARE_EXT_ID + ".bookmarking", true),
      previous_version: getCharPref("extensions." + FFSHARE_EXT_ID + ".previous_version", ""),
      //Cannot rename firstRun to first_install since it would mess up already deployed clients,
      //would pop a new F1 window on an upgrade vs. fresh install.
      firstRun: getCharPref("extensions." + FFSHARE_EXT_ID + ".first-install", ""),
      use_accel_key: getBoolPref("extensions." + FFSHARE_EXT_ID + ".use_accel_key", true)
    },

    errorPage: 'chrome://ffshare/content/down.html',

    keycodeId: "key_ffshare",
    keycode : "VK_F1",
    oldKeycodeId: "key_old_ffshare",

    onLoad: function () {
      fennecTab.init();

      Services.prefs.addObserver("extensions." + FFSHARE_EXT_ID + ".", this, false);
    },

    onUnload: function () {
      Services.prefs.removeObserver("extensions." + FFSHARE_EXT_ID + ".", this);
    },

    observe: function (subject, topic, data) {
      var pref;

      if (topic !== "nsPref:changed") {
        return;
      }

      if ("extensions." + FFSHARE_EXT_ID + ".bookmarking" === data) {
        try {
          pref = subject.QueryInterface(Ci.nsIPrefBranch);
          ffshare.prefs.bookmarking = pref.getBoolPref(data);
        } catch (e) {
          error("observe: "+e);
        }
      }
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

    switchTab: function (waitForLoad) {
      dump("switchTab called\n");
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
      var isopen = selectedTab.shareState && selectedTab.shareState.open;
      if (visible && !isopen) {
        sharePanel.close();
      }
      if (isopen) {
        window.setTimeout(function () {
          sharePanel.updateStatus();
          sharePanel.show({});
        }, 0);
      } else {
        window.setTimeout(function () {
          sharePanel.updateStatus();
        }, 0);
      }
    },

    open: function (options) {
      fennecTab.open();
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
dump("system: "+ffshare.prefs.system+"\n");
dump("panel url: "+ffshare.prefs.frontpage_url+"\n");

  // injecting api into content
  var ffapi = {
    apibase: null, // null == 'navigator.mozilla.labs'
    name: 'share', // builds to 'navigator.mozilla.labs.share'
    script: null, // null == use injected default script
    getapi: function () {
      return function (options) {
        ffshare.open(options);
      };
    }
  };
  InjectorInit(window);
  injector.register(ffapi);

  window.addEventListener("load", fn.bind(ffshare, "onLoad"), false);
  window.addEventListener("unload", fn.bind(ffshare, "onUnload"), false);
}());
