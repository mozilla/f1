/*jslint strict: false, indent: 2 */
/*global define: false, module: false, test: false, equals: false */

define(['dotCompare'], function (dotCompare) {

  module('dotCompare');

  test('A is bigger than B', function () {
    equals(1, dotCompare('0.7.4', '0.7.1'));
    equals(1, dotCompare('1.7.4', '0.8.5'));
  });

  test('B is bigger than A', function () {
    equals(-1, dotCompare('0.7.4', '0.8.1'));
    equals(-1, dotCompare('0.8.5', '1.7.4'));
  });

  test('A is equal to B', function () {
    equals(0, dotCompare('0.7.4', '0.7.4'));
    equals(0, dotCompare('0.0.1', '0.0.1'));
  });

});
