# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1
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
# The Original Code is Raindrop.
#
# The Initial Developer of the Original Code is
# Mozilla Messaging, Inc..
# Portions created by the Initial Developer are Copyright (C) 2009
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#

try:
    from setuptools import setup, find_packages
except ImportError:
    from ez_setup import use_setuptools
    use_setuptools()
    from setuptools import setup, find_packages

VERSION = '0.3.7'

setup(
    name='ShareServer',
    version=VERSION,
    description=('F1 is a browser extension that allows you to share links '
                 'in a fast and fun way.'),
    author='Mozilla Messaging',
    author_email='linkdrop@googlegroups.com',
    url='http://f1.mozillamessaging.com/',
    install_requires=[
        "PasteScript>=1.6.3",
        "beaker",
        "services",
        "decorator",
        "docutils",
        "nose",
        "coverage",
        "mock",
        "httplib2",
        "oauth2",
        "python-dateutil",
        "python-openid",
        "python-memcached",
        "linkoauth",
    ],
    packages=find_packages(exclude=['ez_setup']),
    include_package_data=True,
    test_suite='nose.collector',
    package_data={'linkdrop': ['i18n/*/LC_MESSAGES/*.mo']},
    message_extractors={'linkdrop': [
            ('**.py', 'python', None),
            ('templates/**.mako', 'mako', {'input_encoding': 'utf-8'}),
            ('public/**', 'ignore', None)]},
    zip_safe=False,
    paster_plugins=['PasteScript'],
    entry_points="""
    [paste.app_factory]
    main = linkdrop.wsgiapp:make_app
    static = linkdrop.static:make_static

    [paste.filter_app_factory]
    csrf = linkdrop.csrf:make_csrf_filter_app
    dbgp = linkdrop.debug:make_dbgp_middleware
    profiler = linkdrop.debug:make_profile_middleware

    [paste.app_install]
    main = paste.script.appinstall:Installer
    """,
)

import os
import stat
basedir = os.path.join(os.getcwd(), "web")
realdir = VERSION
linkdir = os.path.join(basedir, "current")

# Sanity check, nuke what isn't a symlink
try:
    s = os.lstat(linkdir)
    if not stat.S_ISLNK(s.st_mode):
        if stat.S_ISDIR:
            os.rmdir(linkdir)
        else:
            os.unlink(linkdir)
except OSError, e:
    if e.errno != 2:  # file does not exist
        raise

# Check what the symlink might already point to
# and update if needed
if hasattr(os, "readlink"):
    try:
        lver = os.readlink(linkdir)
    except OSError, e:
        lver = None
        if e.errno != 2:  # file does not exist
            raise

    if lver != VERSION:
        if lver:
            os.unlink(linkdir)
        os.symlink(realdir, linkdir)
