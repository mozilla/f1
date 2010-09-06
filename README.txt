
Installation and Setup
======================

Get the ``linkdrop`` repository:

    hg clone http://hg.mozilla.org/users/mhammond_skippinet.com.au/linkdrop
    cd linkdrop

Setup a virtual environment (optional, recommended):

    sudo easy_install virtualenv
    virtualenv env
    source env/bin/activate

Install ``linkdrop``:

    python setup.py develop

Make a config file as follows::

    *skip this step for now*
    paster make-config linkdrop config.ini

Tweak the config file as appropriate and then setup the application::

    *skip this step for now*
    paster setup-app config.ini

Running ``linkdrop``:

    # Run the web server.  'reload' is useful for development, the webserver
    # restarts on file changes, otherwise you can leave it off
    paster serve --reload development.ini

Then visit: http://127.0.0.1:5000/ for an index of api examples



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

Then visit: http://127.0.0.1:5000/ for an index of api examples
