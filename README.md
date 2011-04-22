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

### Setup dependencies:

    make build

If you get this error on Mac OS X:

    /Developer/SDKs/MacOSX10.4u.sdk/usr/include/stdarg.h:4:25: error: stdarg.h: No such file or directory

It could be because the default version of GCC is too high. If you do

    ls -la /usr/bin/gcc

And it points to gcc-4.2, then change it to point to gcc-4.0 (warning affects all gcc calls from then on):

    sudo rm /usr/bin/gcc
    sudo ln -s /usr/bin/gcc-4.0 /usr/bin/gcc

Info taken from [this web site](http://blog.coredumped.org/2009/09/snow-leopard-and-lxml.html)

### Start the virtualenv

    source bin/activate

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
