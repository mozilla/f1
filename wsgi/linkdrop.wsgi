# Find ourselves
import os, sys
basedir = os.path.abspath(os.path.dirname(__file__))
__here__ = os.path.dirname(__file__)
__parent__ = os.path.dirname(__here__)

sys.path.append(__parent__)

from paste.script.util.logging_config import fileConfig
fileConfig('%s/development.ini' % __parent__) 

from paste.deploy import loadapp

# And deploy our app from raindrop.ini
application = loadapp('config:../production.ini', relative_to=basedir)
