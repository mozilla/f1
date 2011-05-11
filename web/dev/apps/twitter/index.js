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

/*jslint plusplus: false, indent: 2 */
/*global define: false, location: true, window: false, alert: false,
  document: false, setTimeout: false, localStorage: false */
"use strict";

define([ "jquery", "../common",
         "jquery-ui-1.8.6.custom.min", "jquery.textOverflow"],
function ($, common) {

  var options = common.options;

  function changeShareType() {
    var enabled, disabled;
    var shareControl = $("#selectShareType")[0];
    var shareType = shareControl.options[shareControl.selectedIndex].value;
    if (shareType==="public") {
      enabled = $(".shareTypePublic");
      disabled = $(".shareTypeDirect");
    } else {
      enabled = $(".shareTypeDirect");
      disabled = $(".shareTypePublic");
    }
    enabled.removeClass('hiddenImportant');
    enabled.addClass('fixedSize');
    disabled.addClass('hiddenImportant');
    if (shareType === "direct") {
      $('.toSection input').focus();
    }
  }

  $("#selectShareType").bind("change", function(evt) {
    changeShareType();
    //Clear up any error status, make sure share button
    //is enabled.
    //    this.resetError();
  });

  function loadmeup() {
     $(function () {
      common.setupCommonUI("twitter.com");
      changeShareType();
      $("#shareDirectInstead").bind("click", function(evt) {
        var shareControl = $("#selectShareType")[0];
        shareControl.selectedIndex = 1; // index of the "direct" option.
        changeShareType();
      });
    });
  }

  common.bindAppService(loadmeup);

});
