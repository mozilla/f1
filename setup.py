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

setup(
    name='linkdrop',
    version='0.1.7',
    description='',
    author='',
    author_email='',
    url='',
    install_requires=[
        "Pylons>=1.0",
        "SQLAlchemy>=0.5",
        "docutils",
        "nose",
        "httplib2",
        "oauth2",
        "python-dateutil",
        "python-openid",
        "python-memcached",
        "twitter",
        "gdata", # google api support
        "sqlalchemy-migrate>=0.5.4",
    ],
    setup_requires=["PasteScript>=1.6.3"],
    packages=find_packages(exclude=['ez_setup']),
    include_package_data=True,
    test_suite='nose.collector',
    package_data={'linkdrop': ['i18n/*/LC_MESSAGES/*.mo']},
    message_extractors={'linkdrop': [
            ('**.py', 'python', None),
            ('templates/**.mako', 'mako', {'input_encoding': 'utf-8'}),
            ('public/**', 'ignore', None)]},
    zip_safe=False,
    paster_plugins=['PasteScript', 'Pylons'],
    entry_points="""
    [paste.app_factory]
    main = linkdrop.config.middleware:make_app
    static = linkdrop.static:make_static

    [paste.filter_app_factory]
    csrf = linkdrop.csrf:make_csrf_filter_app
    dbgp = linkdrop.debug:make_dbgp_middleware
    profiler = linkdrop.debug:make_profile_middleware

    [paste.app_install]
    main = pylons.util:PylonsInstaller
    """,
)
