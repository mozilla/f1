This file is for you to describe the linkdrop application. Typically
you would include information such as the information below:

Installation and Setup
======================

Install ``linkdrop`` using easy_install::

    easy_install linkdrop

Make a config file as follows::

    paster make-config linkdrop config.ini

Tweak the config file as appropriate and then setup the application::

    paster setup-app config.ini

Then you are ready to go.

Installing from Source
======================

Get the ``linkdrop`` repository:

    hg clone http://hg.mozilla.org/users/mhammond_skippinet.com.au/linkdrop
    cd linkdrop

Setup a virtual environment (optional, recommended):

    sudo easy_install virtualenv
    virtualenv lenv
    source lenv/bin/activate

Install ``linkdrop``:

    python setup.py develop

Running ``linkdrop``:

    # Run the web server.  'reload' is useful for development, the webserver
    # restarts on file changes, otherwise you can leave it off
    paster serve --reload development.ini
