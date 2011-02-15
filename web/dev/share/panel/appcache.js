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

/*jslint indent: 2, strict: false, regexp: false */
/*global require: false, console: false */

var fs = require('fs'),
    resources = [fs.realpathSync('index.js')],
    existingManifestRegExp = /<html[^>]+manifest="[^"]+"/,
    linkRegExp = /<\s*link\s+[^>]+href="([^"]+)"/g,
    scriptRegExp = /<\s*script\s+[^>]+src="([^"]+)"/g,
    versionRegExp = /f1\/web\/([^\/]+)\//,
    pathRegExp = /^.+\/f1\/web/,
    manifest, contents, images, version;

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function write(path, contents) {
  return fs.writeFileSync(path, contents, 'utf8');
}

// Update the index.html page to have a manifest attribute.
contents = read('index.html');
if (!existingManifestRegExp.test(contents)) {
  contents = contents.replace(/<html/, '<html manifest="appcache.manifest"');
  write('index.html', contents);
}

// Parse the contents for link and script tags
contents.replace(linkRegExp, function (match, url) {
  resources.push(url);
});
contents.replace(scriptRegExp, function (match, url) {
  resources.push(url);
});

// Get all the images. Get the ones from share/i and share/panel/i
images = fs.readdirSync('../i');
images.forEach(function (image) {
  resources.push(fs.realpathSync('../i/' + image));
});

images = fs.readdirSync('i');
images.forEach(function (image) {
  resources.push(fs.realpathSync('i/' + image));
});

// Figure out the version number from the path. If in dev, use a fake
// version number to make testing easier.
version = resources[0].match(versionRegExp)[1];
if (version === 'dev') {
  version = (new Date()).getTime();
}

// Do final path adjustment
resources.forEach(function (path, i) {
  resources[i] = path.replace(pathRegExp, '');
});

// Now construct the final manifest
manifest = read('appcache.template');
manifest = manifest
             .replace(/\{version\}/, version)
             .replace(/\{cached\}/, resources.join('\n'));
write('appcache.manifest', manifest);

console.log('appcache will cache:');
console.log(resources.join('\n'));
