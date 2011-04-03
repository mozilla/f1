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

define([ 'blade/object', 'blade/Widget', 'blade/fn', 'jquery', 'dispatch',
         './jigFuncs', 'text!./PageInfo.html', 'jquery.textOverflow'],
function (object,         Widget,         fn,      $,        dispatch,
          jigFuncs,     template) {

  //Define any global handlers
  $(function () {
    $('body').delegate('#pageInfo .nofollow', 'click', function (evt) {
      evt.preventDefault();
    });
  });

  //Define the widget.
  return object(Widget, null, function (parent) {
    return {
      template: template,

      optionsChanged: function () {
        //options have updated, update the UI.
        var root = $(this.node),
            opts = this.options;

        root.find('.thumb').attr('src', jigFuncs.thumb(opts));
        root.find('.title').text(opts.title);
        root.find('.description').text(opts.description);
        root.find('.url').text(jigFuncs.cleanLink(opts.url));
        root.find('.shorturl').text(jigFuncs.cleanLink(opts.shortUrl));

        //Update text overflow.
        $(".overflow", this.node).textOverflow();
      },

      onCreate: function () {
        this.optionsChangedSub = dispatch.sub('optionsChanged', fn.bind(this, function (options) {
          this.options = options;
          this.optionsChanged();
        }));
      },

      onRender: function () {
        //Create ellipsis for anything wanting ... overflow
        $(".overflow", this.node).textOverflow();
      },

      destroy: function () {
        dispatch.unsub(this.optionsChangedSub);
        parent(this, 'destroy');
      }
    };
  });
});
