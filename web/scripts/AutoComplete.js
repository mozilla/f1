/*jslint plusplus: false, indent: 2 */
/*global require: false, window: false */
"use strict";

require.def('AutoComplete',
    ['jquery', 'blade/object', 'blade/fn', 'dispatch'],
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
