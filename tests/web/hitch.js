var setupModule = function(module) {
  module.controller = mozmill.getBrowserController();
}

var setupTest = function(test) {
  // Open a tab for wikipedia
  controller.click(new elementslib.Elem(controller.menus['file-menu']['menu_newNavigatorTab']));
  controller.open('http://www.wikipedia.org');
  controller.waitForPageLoad();
}

var teardownTest = function(test) {
  // Close the tab
  controller.click(new elementslib.Elem(controller.menus['file-menu']['menu_close']));
}

var testHitchhiker = function () {
   searchbox = new elementslib.ID(controller.tabs.activeTab, "searchInput");
   controller.type(searchbox, "Hitchhiker's Guide to the Galaxy");
   controller.click(new elementslib.Name(controller.tabs.activeTab, "go"));
   controller.waitForPageLoad();

   image = new elementslib.XPath(controller.tabs.activeTab,
                                 "/html/body/div[@id='globalWrapper']/div[@id='column-content']" +
                                 "/div[@id='content']/div[@id='bodyContent']/div[6]/div/a[1]/img");
   controller.assertImageLoaded(image);
}

var testHuckFinn = function(){
   searchbox = new elementslib.ID(controller.tabs.activeTab, "searchInput");
   controller.type(searchbox, "Huck Finn");
   controller.click(new elementslib.Name(controller.tabs.activeTab, "go"));
   controller.waitForPageLoad();

   // Note that the Xpath is different on this page, used the inspector to get it
   image = new elementslib.XPath(controller.tabs.activeTab,
                                 "/html/body/div[@id='globalWrapper']/div[@id='column-content']" +
                                 "/div[@id='content']/div[@id='bodyContent']/table/tbody/tr[2]/td/a[1]/img");
   controller.assertImageLoaded(image);
}
