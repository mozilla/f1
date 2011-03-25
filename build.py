# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is Sync Server
#
# The Initial Developer of the Original Code is the Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2010
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Tarek Ziade (tarek@mozilla.com)
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****
"""
Bootstrap file -- will try to make sure _build.py is up-to-date, then run it.
"""
import os
import sys
import urllib2


def _rename(path):
    if not os.path.exists(path):
        return

    root = 0
    newname = path + '.bak.%d' % root
    while os.path.exists(newname):
        root += 1
        newname = path + '.bak.%d' % root
    os.rename(path, newname)


def _update():
    # getting the file age
    if os.path.exists('._build.etag'):
        with open('._build.etag') as f:
            current_etag = f.read().strip()
        headers = {'If-None-Match': current_etag}
    else:
        headers = {}
        current_etag = None

    request = urllib2.Request('http://moz.ziade.org/_build.py',
                              headers=headers)

    # checking the last version on our server
    try:
        url = urllib2.urlopen(request, timeout=5)
        etag = url.headers.get('ETag')
    except urllib2.HTTPError, e:
        if e.getcode() != 412:
            raise
        # we're up-to-date (precondition failed)
        etag = current_etag
    except urllib2.URLError:
        # timeout error
        etag = None

    if etag is not None and current_etag != etag:
        # we need to update our version
        _rename('_build.py')
        content = url.read()
        with open('_build.py', 'w') as f:
            f.write(content)

        with open('._build.etag', 'w') as f:
            f.write(etag)


def main():
    #_update()
    # we're good, let's import the file and run it
    mod = __import__('_build')
    project_name = sys.argv[1]
    deps = [dep.strip() for dep in sys.argv[2].split(',')]
    mod.main(project_name, deps)


if __name__ == '__main__':
    main()
