'use strict';
/*jslint indent: 2 */
/*global document: false, setInterval: false, clearInterval: false,
  Application: false, gBrowser: false, window: false, Components: false */

/*
 TODO
 - if user navigates away from page, then should auto-close the share pane.
 - Detect if the user already uses some services and pass them to the iframe.
*/

var ffshare;
(function () {

  var slice = Array.prototype.slice,
      ostring = Object.prototype.toString,
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

  ffshare = {
    frameAnimationTime: 300,
    shareUrl: 'http://127.0.0.1:5000/send/',
    shareFrame: null,

    onLoad: function () {
      // initialization code
      this.initialized = true;
      this.strings = document.getElementById("ffshare-strings");
    },

    onMenuItemCommand: function (e) {
      this.onToolbarButtonCommand(e);
    },

    getKnownServices: function () {
      var loginMgr = Components.classes["@mozilla.org/login-manager;1"]
                         .getService(Components.interfaces.nsILoginManager);

      var logins = loginMgr.getAllLogins({});
      var knownServices = [
        {'hostnames': ['http://twitter.com', 'https://twitter.com'], 'name': 'Twitter'},
        {'hostnames': ['http://mail.google.com', 'https://mail.google.com'], 'name': 'Gmail'},
        {'hostnames': ['http://www.facebook.com', 'https://login.facebook.com'], 'name': 'Facebook'}
      ];
      var detectedServices = [];
      var detectedServicesMap = {};
      for (var i = 0; i < logins.length; i++) {
        for (var j = 0; j < knownServices.length; j++) {
          for (var hostnameIndex = 0; hostnameIndex < knownServices[j].hostnames.length; hostnameIndex++) {
            if (knownServices[j].hostnames[hostnameIndex] == logins[i].hostname) {
              var svcName = knownServices[j].name;
              var username = logins[i].username;
              var svcData;
              if (! detectedServicesMap[svcName]) {
                svcData = {'usernames': []};
                detectedServicesMap[svcName] = svcData;
                detectedServices.push(svcName);
              } else {
                svcData = detectedServicesMap[svcName];
              }
              var exists = false;
              for (var ui = 0; ui < svcData.usernames.length; ui++) {
                if (svcData.usernames[ui] == username) exists = true;
              }
              if (!exists)
                svcData.usernames.push(username);
            }
          }
        }
      }
      //if (detectedServices.length) {
      //  var bits = [];
      //  for (var i = 0; i < detectedServices.length; i++) {
      //    var svcData = detectedServicesMap[detectedServices[i]];
      //    bits.push(svcData.name + ': ' + svcData.usernames.join(', '));
      //  }
      //}
      // We'll return a map of all of the known services we have found logins
      // for, with the following structure:

       //{'Gmail': {
       //     'usernames': ['john.doe', 'jane baz']
       //     },
       //{'Twitter': {
       //     'usernames': ['john.doe', 'jane baz']
       //     },
       //
      return detectedServicesMap;
    },

    hide: function () {
      this.changeHeight(0, fn.bind(this, function () {
        this.shareFrame.parentNode.removeChild(this.shareFrame);
        this.shareFrame = null;
      }));
    },
  
    show: function () {
      //Create the iframe.
      var tab = gBrowser.selectedTab,
          parentNode = tab.linkedBrowser.parentNode,
          iframeNode = document.createElement("iframe");

      //Remember iframe node for later.
      this.shareFrame = iframeNode;

      iframeNode.className = 'ffshare-frame';
      iframeNode.style.width = '100%';
      iframeNode.style.height = 0;
      //Make sure it can go all the way to zero.
      iframeNode.style.minHeight = 0;

      //Figure out if CSS transitions can be used
      if ('MozTransition' in iframeNode.style) {
        this.useCssTransition = true;
        iframeNode.addEventListener("transitionend", fn.bind(this, 'onTransitionEnd'), true);
      } else {
        this.useCssTransition = false;
      }

      iframeNode.addEventListener('load', fn.bind(this, function (evt) {
        var height = evt.target.documentElement.getBoundingClientRect().height;
        this.changeHeight(height);
      }), true);

      var url = this.shareUrl + "#services=" + encodeURIComponent(JSON.stringify(this.getKnownServices()));
      iframeNode.setAttribute("src", url);
      parentNode.insertBefore(iframeNode, parentNode.firstChild);
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

    onTransitionEnd: function (evt) {
      if (this.onHeightEnd) {
        this.onHeightEnd();
      }
    },

    onToolbarButtonCommand: function (e) {
      if (this.shareFrame) {
        this.hide();
      } else {
        this.show();
      }
    }
  };

  window.addEventListener("load", ffshare.onLoad, false);

}());