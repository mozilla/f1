
/*jslint strict: false, indent: 2 */
/*global mozmill: false, controller: false, elementslib: false */

var setupModule = function (module) {
  module.controller = mozmill.getBrowserController();
};

var setupTest = function (test) {
  // Open a tab to something that can be shared (home page is not shareable)
  controller.click(new elementslib.Elem(controller.menus['file-menu']['menu_newNavigatorTab']));
  controller.open('http://www.wikipedia.org');
  controller.waitForPageLoad();

  // Open F1
  controller.click(new elementslib.ID(controller.window.document, 'ffshare-toolbar-button'));

  var browser = new elementslib.ID(controller.window.document, 'share-browser');

  // todo: what we really want to know is that the form is completely updated
  // with the current tab's information. May need to listen to postMessage,
  // but may be tricky to set up.
  controller.waitForPageLoad(browser.document, 5000, 300);
};


var testTextInput = function (test) {
  var //browser = new elementslib.ID(controller.window.document, 'share-browser'),
      document = controller.window.frames[2].document,
      toElem = new elementslib.Name(controller.window.frames[2].document, "to");
      //toElem = elementslib.Elem(document.querySelectorAll('#gmail input[name="to"]')[0]);

//Cu.reportError('.' + 'foo');

  controller.type(toElem, "jrburke@gmail.com");
  controller.assertValue(toElem, "jrburke@gmail.com");
};

var teardownTest = function (test) {
  // Close F1
  controller.click(new elementslib.ID(controller.window.document, 'ffshare-toolbar-button'));
  controller.click(new elementslib.Elem(controller.menus['file-menu']['menu_close']));
};
