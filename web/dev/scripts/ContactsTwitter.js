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

define([ 'blade/object', 'Contacts', 'jquery'],
function (object,         Contacts,     $) {
  var idRegExp = /\@(\S+)/;

  /**
   * Overrides the formatting of contacts and converting
   * one of those formatted contacts into a user ID.
   */
  return object(Contacts, null, function (parent) {
    return {
      formatContact: function (contact) {
        var value = '@' + contact.username;
        return value;
      },

      findContact: function (to) {
        var match = idRegExp.exec(to),
            value = '',
            name = (match && match[1]) || '';
        if (name) {
          (this.contacts || []).some(function (contact) {
            if (contact.username === name) {
              value = contact.userid;
              return true;
            }
            return false;
          });
        }

        return value;
      }
    };
  });
});
