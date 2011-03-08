const {classes: Cc, interfaces: Ci, utils: Cu} = Components;
Cu.import("resource://f1/modules/progress.js");
Cu.import("resource://gre/modules/Services.jsm");

// singleton controller for the share panel
// A state object is attached to each browser tab when the share panel
// is opened for that tab.  The state object is removed from the current
// tab when the panel is closed.
function sharePanel(window) {
    this.window = window;
    this.gBrowser = window.gBrowser;
    this.document = window.document;
    this.browser = this.document.getElementById('share-browser');
    this.panel = this.document.getElementById('share-popup');
    this.init();
}
sharePanel.prototype = {
    init: function() {
        // hookup esc to also close the panel
        // XXX not working, maybe need to listen on window
        let self = this;
        this.panel.addEventListener('keypress', function (e) {
            if (e.keyCode === 27 /*"VK_ESC"*/) {
                self.close();
            }
        }, false);
        this.loadListener = function (evt) {
            self.window.setTimeout(function () {
                self.sizeToContent();
            }, 0);
        };
        this.browser.addEventListener("load", this.loadListener, true);

        Services.obs.addObserver(this, 'content-document-global-created', false);

        let webProgress = this.browser.webProgress;
        this.stateProgressListener = new StateProgressListener(this.browser);
        webProgress.addProgressListener(this.stateProgressListener, Ci.nsIWebProgress.NOTIFY_STATE_WINDOW);
    },

    shutdown: function() {
        Services.obs.removeObserver(this, 'content-document-global-created');
        let webProgress = this.browser.webProgress;
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
        let self = this;
        let contentWindow = this.browser.contentWindow;
        contentWindow = contentWindow.wrappedJSObject ? contentWindow.wrappedJSObject : contentWindow;
        contentWindow.addEventListener("message", function (evt) {
            // Make sure we only act on messages from the page we expect.
            if (ffshare.prefs.share_url.indexOf(evt.origin) === 0) {
                // Mesages have the following properties:
                // name: the string name of the messsage
                // data: the JSON structure of data for the message.
                let message = evt.data, skip = false, topic, data;

                try {
                    // Only some messages are valid JSON, only care about the ones
                    // that are.
                    message = JSON.parse(message);
                } catch (e) {
                    skip = true;
                }
                
                if (!skip) {
                    topic = message.topic;
                    data = message.data;
                    if (topic && self[topic]) {
                        self[topic](data);
                    }
                }
            }
        }, false);
    },

    // Fired when a pref changes from content space. the pref object has
    // a name and value.
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

    
    // PostMessage APIs
    // Called by content page when share is successful.
    // @param {Object} data info about the share.
    success: function(data) {
        this.updateStatus(0);
        this.close();

        if (ffshare.prefs.bookmarking) {
            let tags = ['shared', 'f1'];
            if (data.domain === 'twitter.com') {
                tags.push("twitter");
            }
            if (data.domain === 'facebook.com') {
                tags.push("facebook");
            }

            let nsiuri = Services.io.newURI(gBrowser.currentURI.spec, null, null);
            Services.bookmarks.insertBookmark(Services.bookmarks.unfiledBookmarksFolder,
                                          nsiuri, Services.bookmarks.DEFAULT_INDEX,
                                          this.getPageTitle().trim());

            PlacesUtils.tagging.tagURI(nsiuri, tags);
        }
    },

    getPageTitle: function() {
        let metas = gBrowser.contentDocument.querySelectorAll("meta[property='og:title']"),
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
                // Title could have some XML escapes in it so be sure unescape
                return unescapeXml(content.trim());
            }
        }
      
        title = gBrowser.contentDocument.getElementsByTagName("title")[0];
        if (title && title.firstChild) {
            // Use node Value because we have nothing else
            return title.firstChild.nodeValue.trim();
        }
        return "";
    },

    getPageDescription: function() {
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
    },

    escapeHtml: function (text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
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
      if (gBrowser.selectedTab.shareState) {
        if (gBrowser.selectedTab.shareState.status === 0)
          gBrowser.selectedTab.shareState = null;
        else
          gBrowser.selectedTab.shareState.open = false;
      }

      // Always ensure the button is unchecked when the panel is hidden
      var button = getButton();
      if (button)
        button.removeAttribute("checked");
    },
    
    updateStatus: function(status) {
      let self = this;
      if (typeof(status) == 'undefined')
        status = gBrowser.selectedTab.shareState ? gBrowser.selectedTab.shareState.status : 0;
      if (gBrowser.selectedTab.shareState)
        gBrowser.selectedTab.shareState.status = status;
      if (status == 2) {
        // use the notification bar if the button is not in the urlbar
        let nBox = gBrowser.getNotificationBox();
        let buttons = [
            {
            label: "try again",
            accessKey: null,
            callback: function() {
                gBrowser.getNotificationBox().removeCurrentNotification();
                window.setTimeout(function() {
                  ffshare.togglePanel();
                }, 0);
            }
        }];
        nBox.appendNotification(
                       "There was a problem sharing this page.", "F1 Share Failure",
                       null,
                       nBox.PRIORITY_WARNING_MEDIUM, buttons);
      }
      var button = getButton();
      if (button) {
        if (status == 2)
          status = 0;
        button.setAttribute("status", SHARE_STATUS[status]);
      }
    },

    hide: function () {
      this.panel.hidePopup();
      gBrowser.selectedTab.shareState.open = false;
      var button = getButton();
      if (button)
        button.removeAttribute("checked");
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
        status: currentState ? currentState.status : 0,
        open: true
      };

      var url = ffshare.prefs.share_url +
                '#options=' + encodeURIComponent(JSON.stringify(options));

      // adjust the size
      this.browser.style.width = lastWidth + 'px';
      this.browser.style.height = lastHeight + 'px';
      //Make sure it can go all the way to zero.
      this.browser.style.minHeight = 0;

      if (forceReload) {
        this.browser.loadURI(url);
        forceReload = false;
      } else {
        this.browser.setAttribute('src', url);
      }

      var button = getButton();
      if (button) {
        // Always ensure the button is checked if the panel is open
        button.setAttribute("checked", true);
  
        // Always ensure we aren't glowing if the person clicks on the button
        button.removeAttribute("firstRun");
      } else {
        // use urlbar as the anchor
        button = document.getElementById('identity-box');
      }

      // fx 4
      var position = (getComputedStyle(gNavToolbox, "").direction === "rtl") ? 'bottomcenter topright' : 'bottomcenter topleft';
      this.panel.openPopup(button, position, 0, 0, false, false);
    }
};

var EXPORTED_SYMBOLS = ["sharePanel"];
