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
/*global require: false, define: false, window: false */
"use strict";

define([ 'jquery', 'blade/object', 'blade/fn', 'dispatch'],
function ($,    object,         fn,         dispatch) {

  return object(null, null, {
    init: function (node) {
      this.dom = $(node);

      //Wire up events.
      this.dom
      .bind('keyup', fn.bind(this, 'onKeyUp'));
    },

    onKeyUp: function (evt) {
      //If Enter is detected, then probably an autocomplete completion,
      //make sure end of string is visible.
      if (evt.keyCode === 13) {
        /*
        var self = this;
        console.log('key: ', evt);
        setTimeout(function () {
          var event = document.createEvent("KeyboardEvent");
          event.initKeyEvent(
                 "keydown",        //  in DOMString typeArg,
                  true,             //  in boolean canBubbleArg,
                  true,             //  in boolean cancelableArg,
                  null,             //  in nsIDOMAbstractView viewArg,  Specifies UIEvent.view. This value may be null.
                  false,            //  in boolean ctrlKeyArg,
                  false,            //  in boolean altKeyArg,
                  false,            //  in boolean shiftKeyArg,
                  false,            //  in boolean metaKeyArg,
                  39,               //  in unsigned long keyCodeArg,
                   0);              //  in unsigned long charCodeArg);

          self.dom[0].dispatchEvent(event);

          //var value = self.dom.val(),
           //   length = value.length;
          //self.dom[0].value = value;
          //self.dom[0].setSelectionRange(length, length);
          console.log('sent keydown event');
        }, 200);
        */
      }
    }
  });
});
