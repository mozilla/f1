
/*jslint strict: false, indent: 2 */
/*global require: false, mozmill: false, controller: false, elementslib: false */


var f1 = require('./lib/f1'),
    tabs = require('./lib/tabs'),
    log = require('./lib/l').og,
    e = elementslib,
    c;

function setupModule(module) {
  c = module.controller = mozmill.getBrowserController();
}

function setupTest(test) {
  // Open a tab to something that can be shared (home page is not shareable)
  tabs.open(c, 'http://www.google.com');
  f1.open(c);
}

function testTextInput(test) {
  var doc = f1.doc(c),
      node = doc.querySelectorAll('#gmail input[name="to"]')[0];

  log('DOC: ' + doc);
  log('NODE: ' + node);

  var toElem = new e.Elem(node);
      //toElem = e.Elem();

  c.type(toElem, "foobar");
  c.assertValue(toElem, "foobar");
}

function teardownTest(test) {
  // Close F1
  f1.close(c);
}
