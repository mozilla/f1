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
/*jslint indent: 2, es5: true, plusplus: false, onevar: false, bitwise: false */
/*global document: false, setInterval: false, clearInterval: false,
  Application: false, gBrowser: false, window: false, Components: false,
  Cc: false, Ci: false, PlacesUtils: false, gContextMenu: false,
  XPCOMUtils: false, ffshareAutoCompleteData: false, AddonManager: false,
  BrowserToolboxCustomizeDone: false, InjectorInit: false, injector: false,
  getComputedStyle: false, gNavToolbox: false */

var ffshare;
var FFSHARE_EXT_ID = "ffshare@mozilla.org";
(function () {
  var Cc = Components.classes,
      Ci = Components.interfaces,
      Cu = Components.utils,
      xulNs = 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
      slice = Array.prototype.slice,
      ostring = Object.prototype.toString,
      empty = {}, fn,
      buttonId = 'ffshare-toolbar-button';

  Cu.import("resource://ffshare/modules/ffshareAutoCompleteData.js");
  Cu.import("resource://ffshare/modules/injector.js");
  Cu.import("resource://gre/modules/XPCOMUtils.jsm");

  var info = Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULAppInfo); 
  var majorVer = parseInt(info.version[0]);

  // This add-on manager is only available in Firefox 4+
  try {
    Cu.import("resource://gre/modules/AddonManager.jsm");
  } catch (e) {
  }

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
    Application.console.log('.' + msg); // avoid clearing on empty log
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
    },

    onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {},
    onProgressChange: function (aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
    onSecurityChange: function (aWebProgress, aRequest, aState) {},
    onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) {}
  };

  function NavProgressListener(tabFrame) {
    this.tabFrame = tabFrame;
  }

  NavProgressListener.prototype = {
    // detect navigational events for the tab, so we can close

    QueryInterface: XPCOMUtils.generateQI([Ci.nsIWebProgressListener,
                                           Ci.nsISupportsWeakReference,
                                           Ci.nsISupports]),

    onLocationChange: function (/*in nsIWebProgress*/ aWebProgress,
                          /*in nsIRequest*/ aRequest,
                          /*in nsIURI*/ aLocation) {
      this.tabFrame.hide();
    },

    onProgressChange: function (aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress) {},
    onSecurityChange: function (aWebProgress, aRequest, aState) {},
    onStateChange: function (aWebProgress, aRequest, aStateFlags, aStatus) {},
    onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) {}
  };

  var TabFrame = function (tab) {
    this.tab = tab;
    this.visible = false;
  };

  TabFrame.prototype = {

    registerListener: function () {
      var obs = Cc["@mozilla.org/observer-service;1"].
                            getService(Components.interfaces.nsIObserverService);
      obs.addObserver(this, 'content-document-global-created', false);
    },

    unregisterListener: function (listener) {
      var obs = Cc["@mozilla.org/observer-service;1"].
                            getService(Ci.nsIObserverService);
      obs.removeObserver(this, 'content-document-global-created');
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
      if (mainWindow !== window) {
        return;
      }

      // listen for messages now
      this.shareFrame.contentWindow.wrappedJSObject.addEventListener("message", fn.bind(this, function (evt) {
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

    hide: function () {
      this.panel.hidePopup();
    },

    createShareFrame: function (options) {
      options = options || {};

      var browser = gBrowser.getBrowserForTab(this.tab), url,
          notificationBox = gBrowser.getNotificationBox(browser),
          panel = document.createElement('panel'),
          browserNode = document.createElement('browser');

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

      this.panel = panel;

      //Add cleanup listener
      this.panelHideListener = fn.bind(this, function (evt) {
        this.unregisterListener();
        this.panel.removeEventListener('popuphidden', this.panelHideListener, false);
        this.panel.parentNode.removeChild(this.panel);
        this.panel = null;
        this.visible = false;
      });

      panel.addEventListener('popuphidden', this.panelHideListener, false);

      if (!options.previews.length && !options.thumbnail) {
        // then we need to make our own thumbnail
        options.thumbnail = this.getThumbnailData();
      }
      url = ffshare.prefs.share_url +
                '#options=' + encodeURIComponent(JSON.stringify(options));

      setAttrs(panel, {
        type: 'arrow',
        level: 'top'
      });

      setAttrs(browserNode, {
        type: 'content',
        flex: '1',
        src: 'about:blank',
        autocompletepopup: 'PopupAutoCompleteRichResult',
        contextmenu: 'contentAreaContextMenu',
        'disablehistory': true
      });

      panel.appendChild(browserNode);
      document.getElementById('mainPopupSet').appendChild(panel);

      this.shareFrame = browserNode;
      //browserNode.style.width = '640px';
      //browserNode.style.height = '404px';
      //Make sure it can go all the way to zero.
      browserNode.style.minHeight = 0;

      this.registerListener();

      browserNode.setAttribute('src', url);
    },

    show: function (options) {
      var tabURI = gBrowser.getBrowserForTab(this.tab).currentURI,
          tabUrl = tabURI.spec;

      if (!ffshare.isValidURI(tabURI)) {
        return;
      }

      this.createShareFrame(options);
      var button = document.getElementById("ffshare-toolbar-button");
      // fx 4
      if (majorVer >= 4) {
        var position = (getComputedStyle(gNavToolbox, "").direction === "rtl") ? 'bottomcenter topright' : 'bottomcenter topleft';
        this.panel.setAttribute('class', 'ffshare-panel');
        this.panel.firstChild.setAttribute('class', 'ffshare-browser');
        this.panel.openPopup(button, position, 0, 0, false, false);
      } else {
        // fx 3 doorhanger support
        // if the button is to the right of th url bar, use ltr, otherwise rtl
        this.panel.firstChild.setAttribute('class', 'ffshare-browser doorhanger-inner');
        var navbar = document.getElementById('nav-bar');
        var urlbar = document.getElementById('urlbar-container');
        var first = null;
        for (var c =0; c < navbar.childNodes.length; c++) {
          if (navbar.childNodes[c] === urlbar || navbar.childNodes[c] === button) {
            first = navbar.childNodes[c];
            break;
          }
        }
        if (first === button) {
          this.panel.setAttribute('class', 'ffshare-panel doorhanger-rtl');
          this.panel.showPopup(button, -1, -1, 'popup', 'bottomleft', 'topleft');
        } else {
          this.panel.setAttribute('class', 'ffshare-panel doorhanger-ltr');
          this.panel.showPopup(button, -1, -1, 'popup', 'bottomright', 'topright');
        }
        this.panel.sizeToContent();
      }

      if (ffshare.prefs.frontpage_url === tabUrl) {
        var browser = gBrowser.getBrowserForTab(this.tab);
        // If we're looking at the front page we should clear the first run helper
        var evt = browser.contentWindow.wrappedJSObject.document.createEvent("Event");
        evt.initEvent("hideInstalled", true, false);
        browser.contentWindow.wrappedJSObject.dispatchEvent(evt);
      }

      this.visible = true;
    },

    /**
     * Called by content page when share is successful.
     * @param {Object} data info about the share.
     */
    success: function (data) {
      this.hide();

      if (ffshare.prefs.bookmarking) {
        var tags = ['shared', 'f1'];
        if (data.domain === 'twitter.com') {
          tags.push("twitter");
        }
        if (data.domain === 'facebook.com') {
          tags.push("facebook");
        }

        var ios = Cc["@mozilla.org/network/io-service;1"].
               getService(Ci.nsIIOService);
        var nsiuri = ios.newURI(gBrowser.currentURI.spec, null, null);
        var bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"]
                    .getService(Ci.nsINavBookmarksService);
        bmsvc.insertBookmark(bmsvc.unfiledBookmarksFolder, nsiuri, bmsvc.DEFAULT_INDEX, this.getPageTitle().trim());

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
      var tab = this.tab;
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
      return canvas.toDataURL("image/png", "");
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
          previews.push(content);
        }
      }

      for (i = 0; i < links.length; i++) {
        content = links[i].getAttribute("href");
        if (content) {
          previews.push(content);
        }
      }
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
    }
  };

  function sendJustInstalledEvent(browser, rect) {
    browser.contentWindow.wrappedJSObject.buttonX = rect.left + rect.width / 2;
    var evt = browser.contentWindow.wrappedJSObject.document.createEvent("Event");
    evt.initEvent("buttonX", true, false);
    browser.contentWindow.wrappedJSObject.dispatchEvent(evt);
  }

  function makeInstalledLoadHandler(browser, rect) {
    return function () {
      sendJustInstalledEvent(browser, rect);
    };
  }

  ffshare = {

    version: '',
    prefs: {
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

      // Place the button in the toolbar.
      try {
        //Not needed since we add to the end.
        //var afterId = "urlbar-container";   // ID of element to insert after
        var navBar  = document.getElementById("nav-bar"),
            curSet  = navBar.currentSet.split(","), set;

        if (curSet.indexOf(buttonId) === -1) {
          //The next two lines place it between url and search bars.
          //pos = curSet.indexOf(afterId) + 1 || curSet.length;
          //var set = curSet.slice(0, pos).concat(buttonId).concat(curSet.slice(pos));
          //Add it to the end of the toolbar.
          set = curSet.concat(buttonId).join(",");

          navBar.setAttribute("currentset", set);
          navBar.currentSet = set;
          document.persist(navBar.id, "currentset");
          try {
            BrowserToolboxCustomizeDone(true);
          }
          catch (e) {}
        }
      }
      catch (e) {}

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
      //Figure out if this is a first install/upgrade case.
      if (typeof AddonManager !== 'undefined') {
        //Firefox 4
        AddonManager.getAddonByID(FFSHARE_EXT_ID, function (addon) {
          ffshare.onInstallUpgrade(addon.version);
        });
      } else {
        //Firefox before version 4.
        try {
          var em = Cc["@mozilla.org/extensions/manager;1"]
                   .getService(Ci.nsIExtensionManager),
              addon = em.getItemForID(FFSHARE_EXT_ID);
          ffshare.onInstallUpgrade(addon.version);
        } catch (e) {}
      }

      try {
        gBrowser.addProgressListener(canShareProgressListener);
      } catch (e) {
        error(e);
      }

      document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", this.onContextMenuItemShowing, false);

      this.initKeyCode();

      this.prefService = Cc["@mozilla.org/preferences-service;1"]
                             .getService(Ci.nsIPrefService)
                             .getBranch("extensions." + FFSHARE_EXT_ID + ".")
                             .QueryInterface(Ci.nsIPrefBranch2);

      this.prefService.addObserver("", this, false);

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

      this.prefService.removeObserver("", this);
      this.prefService = null;

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
        var wm = Cc["@mozilla.org/appshell/window-mediator;1"]
                           .getService(Ci.nsIWindowMediator);
        var browserEnumerator = wm.getEnumerator("navigator:browser"),
            rect, browser, buttonNode;

        // Check each browser instance for our URL
        var found = false;
        while (!found && browserEnumerator.hasMoreElements()) {
          var browserWin = browserEnumerator.getNext();
          var tabbrowser = browserWin.gBrowser;

          // Check each tab of this browser instance
          var numTabs = tabbrowser.browsers.length;
          for (var index = 0; index < numTabs; index++) {
            var currentBrowser = tabbrowser.getBrowserAtIndex(index);
            if (url === currentBrowser.currentURI.spec) {

              // The URL is already opened. Select this tab.
              tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];

              // Focus *this* browser-window
              browserWin.focus();

              buttonNode = browserWin.document.getElementById(buttonId);
              //Button may not be there if customized and removed from toolbar.
              if (buttonNode) {
                rect = buttonNode.getBoundingClientRect();
                browser = gBrowser.getBrowserForTab(tabbrowser.selectedTab);

                // try setting the button location as the window may have already loaded
                try {
                  sendJustInstalledEvent(browser, rect);
                } catch (ignore) { }

                // Add the load handler in case the window hasn't finished loaded (unlikely)
                browser.addEventListener("load", makeInstalledLoadHandler(browser, rect), true);
              }

              found = true;
              break;
            }
          }
        }

        // Our URL isn't open. Open it now.
        if (!found) {
          var recentWindow = wm.getMostRecentWindow("navigator:browser");
          if (recentWindow) {
            buttonNode = recentWindow.document.getElementById(buttonId);
            //Button may not be there if customized and removed from toolbar.
            if (buttonNode) {
              rect = buttonNode.getBoundingClientRect();
              // Use the existing browser (recent) Window
              var tab = recentWindow.gBrowser.loadOneTab(url, { referrerURI: null,
                                                               charset: null,
                                                               postData: null,
                                                               inBackground: false,
                                                               allowThirdPartyFixup: null });
              browser = gBrowser.getBrowserForTab(tab);
              browser.addEventListener("load",
                                      function buttonX() {
                                        browser.removeEventListener("load", buttonX, true);
                                        browser.contentWindow.wrappedJSObject.buttonX = rect.left + rect.width / 2;
                                        var evt = browser.contentWindow.wrappedJSObject.document.createEvent("Event");
                                        evt.initEvent("buttonX", true, false);
                                        browser.contentWindow.wrappedJSObject.dispatchEvent(evt);
                                      }, true);
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
      if (topic !== "nsPref:changed") {
        return;
      }

      if ("use_accel_key" === data) {
        try {
          var pref = subject.QueryInterface(Ci.nsIPrefBranch);
          ffshare.setAccelKey(pref.getBoolPref("use_accel_key"));
        } catch (e) {
          error(e);
        }
      }

    },

    setAccelKey: function (keyOn) {
      var oldKey = document.getElementById(this.oldKeycodeId),
          f1Key = document.getElementById(this.keycodeId),
          keyset = document.getElementById("mainKeyset");

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
      var p = keyset.parentNode;
      p.appendChild(p.removeChild(keyset));

    },

    isValidURI: function (aURI) {
      //Only open the share frame for http/https urls, file urls for testing.
      return (aURI && (aURI.schemeIs('http') || aURI.schemeIs('https') || aURI.schemeIs('file')));
    },

    canShareURI: function (aURI) {
      var command = document.getElementById("cmd_openSharePage");
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

    onOpenShareCommand: function (e) {
      this.toggle();
    },

    toggle: function (options) {
      var selectedTab = gBrowser.selectedTab,
          tabFrame = selectedTab.ffshareTabFrame;
      if (!tabFrame) {
        tabFrame = new TabFrame(selectedTab);
        selectedTab.ffshareTabFrame = tabFrame;
      }

      tabFrame.show(options);
    }
  };

  if (!ffshare.prefs.share_url) {
    if (ffshare.prefs.system === 'dev') {
      ffshare.prefs.share_url = 'http://linkdrop.caraveo.com:5000/play/designs/popup/';
    } else if (ffshare.prefs.system === 'devpopup') {
      ffshare.prefs.share_url = 'http://linkdrop.caraveo.com:5000/play/designs/popup/';
    } else if (ffshare.prefs.system === 'staging') {
      ffshare.prefs.share_url = 'https://f1-staging.mozillamessaging.com/play/designs/popup/';
    } else {
      ffshare.prefs.share_url = 'https://f1.mozillamessaging.com/play/designs/popup/';
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
