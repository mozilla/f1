
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


Setting up a valid Google domain for OpenID+OAuth
=================================================

You have to have access to a valid domain that google can get to and where you can install an html file.

Visit: https://www.google.com/accounts/ManageDomains

Add your domain, follow the rest of their instructions.

To test: Once that is done, you can bypass normal access to your domain by adding to your /etc/hosts file:

127.0.0.1 your.host.com

Update development.ini and add your key/secret for the google configuration, restart paster.

Then in the web browser, hit linkdrop with http://your.host.com.  


