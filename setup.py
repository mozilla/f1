try:
    from setuptools import setup, find_packages
except ImportError:
    from ez_setup import use_setuptools
    use_setuptools()
    from setuptools import setup, find_packages

setup(
    name='linkdrop',
    version='0.1',
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

    [paste.filter_app_factory]
    csrf = linkdrop.csrf:make_csrf_filter_app
    dbgp = linkdrop.debug:make_dbgp_middleware
    profiler = linkdrop.debug:make_profile_middleware

    [paste.app_install]
    main = pylons.util:PylonsInstaller
    """,
)
