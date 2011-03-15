# Web tests with MozMill

Create mozmill test profile.

virtualenv testenv
source testenv/bin/activate

//Installing a release
#easy_install pip
#pip install mozmill mercurial

//Installing latest from repo (do this once in the testenv virtualenv)
git clone http://github.com/mozautomation/mozmill.git
cd mozmill
./setup_development.py
cd ..


mozmill --binary /Applications/Firefox4.app  --profile ~/Library/Application\ Support/Firefox/Profiles/pksogaxf.mozmill/ --test=testF1.js --debug




To debug during a test:
dump() to output to command line, or controller.window.alert()
