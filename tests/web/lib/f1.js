
/*jslint strict: false, indent: 2 */
/*global require: false, exports: false, elementslib: false */

var log = require('./l').og,
    e = elementslib;

/**
 * Opens the F1 panel, and waits for it to be ready.
 *
 * @param {Controller} c, the mozmill controller for the test.
 */
exports.open = function (c) {

  c.click(new e.ID(c.window.document, 'ffshare-toolbar-button'));

  var browser = new e.ID(c.window.document, 'share-browser').getNode(),
      doc = browser.contentWindow.document;

  // todo: what we really want to know is that the form is completely updated
  // with the current tab's information. May need to listen to postMessage,
  // but may be tricky to set up.
  c.waitForPageLoad(function () {
    return doc.readyState === 4;
  }, 'waiting for F1 doc to load', 5000, 300);
};

exports.doc = function (c) {
  return new e.ID(c.window.document, 'share-browser').getNode().contentWindow.document;
};



/**
 * Opens the F1 panel, and waits for it to be ready.
 *
 * @param {Controller} c, the mozmill controller for the test.
 */
exports.close = function (c) {
  c.click(new e.ID(c.window.document, 'ffshare-toolbar-button'));
  c.click(new e.Elem(c.menus['file-menu']['menu_close']));
};
