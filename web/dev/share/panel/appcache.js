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

/**
 * Creates the appcache manifest, appcache.json for the panel UI.
 */

/*jslint indent: 2 */
/*global */

var fs = require('fs'),
    contents;

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, contents) {
  return fs.writeFileSync(path, contents, 'utf8');
}

// Update the index.html page to have a manifest attribute.
contents = read('index.html');
contents = contents.replace(/<html/, '<html manifest="appcache.manifest"');
write('index.html', contents);

// Parse the contents for link tags and script tags