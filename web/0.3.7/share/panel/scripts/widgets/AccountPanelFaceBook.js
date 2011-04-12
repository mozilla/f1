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

/*jslint indent: 2 */
/*global define: false */
"use strict";

define([ 'blade/object', './AccountPanel', 'jquery'],
function (object,         AccountPanel,     $) {
  /**
   * Just overrides a text string.
   */
  return object(AccountPanel, null, function (parent) {
    return {

      onRender: function () {
        //Call Parent logic
        parent(this, "onRender", arguments);
  
        this.sourceInputDom = $('[name="source"]', this.bodyNode);
        this.formatVideoShare();
      },

      optionsChanged: function () {
        parent(this, "optionsChanged", arguments);
        this.formatVideoShare();
      },

      formatVideoShare: function () {
        // facebook will not allow a video share unless there is an image preview,
        // so if no image preview, remove the source value.
        if (!this.options.previews || !this.options.previews[0] || !this.options.previews[0].http_url) {
          this.sourceInputDom.val('');
        }
      }
    };
  });
});
