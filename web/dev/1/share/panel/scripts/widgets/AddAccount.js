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

/*jslint indent: 2, plusplus: false, nomen: false */
/*global define: false, document: false, alert: false */
"use strict";

define([ 'blade/object', 'blade/fn', 'blade/Widget', 'jquery', 'services',
         'storage', 'module', 'dispatch', 'Select', 'oauth',
         'text!./AddAccount.html'],
function (object,         fn,         Widget,         $,        services,
          storage,   module,   dispatch,   Select,   oauth,
          template) {

  var className = module.id.replace(/\//g, '-'),
      store = storage();

  //Define the widget.
  return object(Widget, null, function (parent) {
    return {
      template: template,
      className: className,

      onRender: function () {
        //Use a Select widget because web content in a panel on Linux
        //has a problem with native selects.

        var options = [{name: 'Select type', value: ''}];

        services.domainList.forEach(function (domain) {
          var svc = services.domains[domain];
          options.push({
            name: svc.name,
            value: domain
          });
        });

        this.select = new Select({
          name: 'accountType',
          options: options
        }, $('.add', this.node)[0]);

        //Listen for changes
        this.select.dom.bind('change', fn.bind(this, function (evt) {

          var selectionName = this.select.val();
          if (selectionName) {
            oauth(this.select.val(), true, function (success) {
              if (success) {
                //Make sure to bring the user back to this service if
                //the auth is successful.
                store.set('lastSelection', selectionName);
              } else {
                //TODO: Fix.
                alert('Login Failed.');
              }
            });
          }
        }));
      }
    };
  });
});
