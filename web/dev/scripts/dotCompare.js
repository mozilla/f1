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

/*jslint indent: 2, plusplus: false */
/*global require: false, window: false, location: false */
"use strict";

require.def("dotCompare", function () {

  /**
   * A function that compares two "x.x.x" version numbers, and returns:
   * @param {String} a value of "x.x.x".
   * @param {String} b value of "x.x.x".
   * @returns Number that depends on the equality:
   * -1 if a is less than b
   * 0 if they are the same
   * 1 if a is greater than b
   */
  function dotCompare(a, b) {
    a = a || "0";
    b = b || "0";
    a = a.split('.');
    b = b.split('.');
    var i, ap, bp,
        length = a.length > b.length ? a.length : b.length;

    for (i = 0; i < length; i++) {
      ap = parseInt(a[i] || "0", 10);
      bp = parseInt(b[i] || "0", 10);
      if (ap > bp) {
        return 1;
      } else if (ap < bp) {
        return -1;
      }
    }

    return 0;
  }

  return dotCompare;
});
