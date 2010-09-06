'use strict';
/*jslint indent: 2 */
/*global document: false, setInterval: false, clearInterval: false,
  Application: false, gBrowser: false, window: false */

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

    clearHeightAnimation: function () {
      if (this.animIntervalId) {
        clearInterval(this.animIntervalId);
        this.animIntervalId = 0;
      }
    },

    hide: function () {
      this.clearHeightAnimation();
      this.changeHeight(0, fn.bind(this, function () {
        this.shareFrame.parentNode.removeChild(this.shareFrame);
        this.shareFrame = null;
      }));
    },
  
    show: function () {
      //Cancel previous height animation if in play.
      this.clearHeightAnimation();
  
      //Create the iframe.
      var tab = gBrowser.selectedTab,
          parentNode = tab.linkedBrowser.parentNode,
          iframeNode = document.createElement("iframe");

      //Remember iframe node for later.
      this.shareFrame = iframeNode;

      iframeNode.style.width = '100%';
      iframeNode.style.height = 0;

      iframeNode.addEventListener('load', fn.bind(this, function (evt) {
        var height = evt.target.documentElement.getBoundingClientRect().height;
        this.changeHeight(height);
      }), true);

      iframeNode.setAttribute("src", this.shareUrl);

      parentNode.insertBefore(iframeNode, parentNode.firstChild);
    },

    changeHeight: function (height, onEnd) {
      var currentHeight = parseInt(this.shareFrame.style.height, 10),
          diff = height - currentHeight,
          pxPerMs = diff / this.frameAnimationTime,
          startTime = (new Date()).getTime();
  
      this.animIntervalId = setInterval(fn.bind(this, function () {
        var msDiff = (new Date()).getTime() - startTime,
            newHeight = currentHeight + (msDiff * pxPerMs);
  
        //Make sure height stays within limits.
        if (diff < 0 && newHeight < height) {
          newHeight = height;
        } else if (diff >= 0 && newHeight >= height) {
          newHeight = height;
        }

        this.shareFrame.style.height = newHeight + 'px';

        if (newHeight === height) {
          clearInterval(this.animIntervalId);
          this.animIntervalId = 0;
          if (onEnd) {
            onEnd();
          }
        }
      }), 15);
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