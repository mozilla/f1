# Web tests with MozMill

Create mozmill test profile.

  virtualenv testenv
  source testenv/bin/activate
  easy_install pip
  pip install mozmill mercurial
  mozmill --binary /Applications/Firefox4.app  --profile ~/Library/Application\ Support/Firefox/Profiles/pksogaxf.mozmill/ --test=testF1.js --debug