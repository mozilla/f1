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
      .bind('keyup', fn.bind(this, 'askForCompletions'))
      .bind('blur', fn.bind(this, 'onBlur'));

      //Tell the chrome about where the dimensions are for the text
      //area. This can execute after DOM ready but before window onload,
      //but not guaranteed, so do both.
      this.setDimensions();
      $(window).bind('load', fn.bind(this, "setDimensions"));
    },

    setDimensions: function () {
      this.dimensions = this.dom[0].getBoundingClientRect();
      dispatch.pub('autoCompleteRect', this.dimensions);
    },

    setData: function (data) {
      this.data = data;
      //Let the chrome know of the available completions
      dispatch.pub('autoCompleteData', data);
    },

    askForCompletions: function (evt) {
      //Get the text in the textarea, but only get the text after
      //the last comma, since multiple values can be in the text field.
      var text = this.dom.val() || '',
        parts = text.split(',');

      if (parts.length > 1) {
        text = parts[parts.length - 1].trim();
      }

      dispatch.pub('autoComplete', text);
    },

    onBlur: function (evt) {
      dispatch.pub('autoCompleteBlur');
    }
  });
});
