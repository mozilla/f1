
/*jslint strict: false, indent: 2 */
/*global require: false, exports: false, elementslib: false */

/**
 * Creates a new tab and loads content in it. Waits for the content
 * to be loaded before returning.
 *
 * @param {controller} c the mozmill controller
 * @param {String} url the url to load in the tab.
 */
exports.open = function (c, url) {
  c.click(new elementslib.Elem(c.menus['file-menu']['menu_newNavigatorTab']));
  c.open(url);
  c.waitForPageLoad();
};
