# ShareServer

A web service that supports Firefox's 'Share' feature.

Firefox exposes the share UI as a preference panel.

The web service handles the OAuth work and sending of messages to different
share servers.

Some directory explanations:

* **grinder**: a load testing tool.
* **tools**: deployment tools.
* The rest of the files support the web service.

## Installation and Setup

### Get the server-share repository:

    git clone https://github.com/mozilla/server-share.git
    cd server-share

### Setup dependencies:

    make build

If you are on OS X and you get errors or it does not work, see the OS X
troubleshooting section below.

### Start the virtualenv

    source bin/activate

### Running ShareServer

Run the web server. 'reload' is useful for development, the webserver restarts
on file changes, otherwise you can leave it off.

    paster serve --reload development.ini

Then visit: [http://127.0.0.1:5000/](http://127.0.0.1:5000/) for an index of
api examples

## Troubleshooting OS X installs

If the **make build** command produced errors or results in not being able to
start up the server, use the following steps. It is suggested you re-clone
server-share before doing the following steps, so that it starts out with a
clean environment.

1. Make sure XCode 3 is installed.

2. Build your own version of Python:

    sudo svn co http://svn.plone.org/svn/collective/buildout/python/
    sudo chown -R $USER ./python
    cd python
    vi buildout.cfg: then remove any references to python 2.4 and 2.5
    python bootstrap.py
    ./bin/buildout
    cd /usr/local/bin
    sudo ln -s /opt/python/bin/virtualenv-2.6 virtualenv

3. Now edit your .profile to make sure that if you have MacPorts installed, its
PATH and MANPATH variables are last in the list for those environment
variables.

I also removed export
PYTHONPATH=/Users/aaa/hg/raindrop/server/python:$PYTHONPATH and removed
/Library/Frameworks/Python.framework/Versions/Current/bin from the $PATH
variable.

4. Build C libraries via Homebrew:

Homebrew installs into /usr/local by default, and it is best if you chown the
files in there to you:

    sudo chown -R $USER /usr/local

If installed things before in these directories, remove these directories:
/usr/local/include and /usr/local/lib

    ruby -e "$(curl -fsSLk https://gist.github.com/raw/323731/install_homebrew.rb)"
    brew install memcached libmemcached

Then try the **make build** command above and continue from there.

## Setting up a valid Google domain for OpenID+OAuth

You have to have access to a valid domain that google can get to and where you
can install an html file.

Visit: [https://www.google.com/accounts/ManageDomains](https://www.google.com/accounts/ManageDomains)

Add your domain, follow the rest of their instructions.

To test: Once that is done, you can bypass normal access to your domain by
adding to your /etc/hosts file:

127.0.0.1 your.host.com

Update development.ini and add your key/secret for the google configuration,
restart paster.

Then in the web browser, hit ShareServer with http://your.host.com.
