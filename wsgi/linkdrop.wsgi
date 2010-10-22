# Find ourselves
import os.path
basedir = os.path.abspath(os.path.dirname(__file__))

from paste.deploy import loadapp

# And deploy our app from raindrop.ini
application = loadapp('config:../production.ini', relative_to=basedir)
