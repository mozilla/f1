# f1

A link sharing service that consists of a Firefox extension and a web service.

The firefox extension creates an area to show the share UI served from the web service.

The web service handles the OAuth work and sending of messages to different share servers.

Some directory explanations:

* **extensions**: holds the Firefox extension source.
* **web**: holds the UI for the web service.
* **grinder**: a load testing tool.
* **tools**: deployment tools.
* The rest of the files support the web service.

## Installation and Setup

### Get the f1 repository:

    git clone https://github.com/mozilla/f1.git
    cd f1

### Setup a virtual environment (optional, recommended):

    sudo easy_install virtualenv
    virtualenv env
    source env/bin/activate

### Dependency installation

    python setup.py develop

### Make a config file as follows::

    # **skip this step for now**
    # paster make-config f1 config.ini

### Tweak the config file as appropriate and then setup the application::

    # **skip this step for now**
    # paster setup-app config.ini

### Running f1

Run the web server. 'reload' is useful for development, the webserver restarts on file changes, otherwise you can leave it off

    paster serve --reload development.ini

Then visit: [http://127.0.0.1:5000/](http://127.0.0.1:5000/) for an index of api examples


## Setting up a valid Google domain for OpenID+OAuth

You have to have access to a valid domain that google can get to and where you can install an html file.

Visit: [https://www.google.com/accounts/ManageDomains](https://www.google.com/accounts/ManageDomains)

Add your domain, follow the rest of their instructions.

To test: Once that is done, you can bypass normal access to your domain by adding to your /etc/hosts file:

127.0.0.1 your.host.com

Update development.ini and add your key/secret for the google configuration, restart paster.

Then in the web browser, hit f1 with http://your.host.com.  


