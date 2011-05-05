ifeq ($(OS),Windows_NT)
BIN_DIR = Scripts
else
BIN_DIR = bin
endif

APPNAME = server-shared-send
DEPS = mozilla:server-core,github:server-share-core,github:client-share-web
DEV_DEPS = github:server-core,github:server-share-core,github:client-share-web
VIRTUALENV = virtualenv
NOSE = $(BIN_DIR)/nosetests
NOSETESTS_ARGS = -s
NOSETESTS_ARGS_C = -s --with-xunit --with-coverage --cover-package=linkdrop,linkoauth --cover-erase
TESTS = linkdrop/tests deps/server-share-core/linkoauth/tests
PYTHON = $(BIN_DIR)/python
version = $(shell $(PYTHON) setup.py --version)
tag = $(shell grep tag_build setup.cfg  | cut -d= -f2 | xargs echo )

# *sob* - just running easy_install on Windows prompts for UAC...
ifeq ($(OS),Windows_NT)
EZ = $(PYTHON) $(BIN_DIR)/easy_install-script.py
else
EZ = $(BIN_DIR)/easy_install
endif
COVEROPTS = --cover-html --cover-html-dir=html --with-coverage --cover-package=linkdrop
COVERAGE := coverage
PYLINT = $(BIN_DIR)/pylint
PKGS = linkdrop

GIT_DESCRIBE := `git describe --long`

ifeq ($(TOPSRCDIR),)
  export TOPSRCDIR = $(shell pwd)
endif
srcdir=$(TOPSRCDIR)/extensions/firefox-share/src/
objdir=$(TOPSRCDIR)/extensions/firefox-share/dist/
dist_dir=$(TOPSRCDIR)/dist
stage_dir=$(objdir)/stage
xpi_dir=$(TOPSRCDIR)/web/dev
web_dir=$(TOPSRCDIR)/web/dev
static_dir=$(TOPSRCDIR)/web/$(version)
webbuild_dir=$(TOPSRCDIR)/tools/webbuild
requirejs_dir=$(webbuild_dir)/requirejs

xpi_name := ffshare.xpi
xpi_files := bootstrap.js chrome install.rdf modules
dep_files := Makefile $(shell find $(srcdir) -type f)

SLINK = ln -sf
ifneq ($(findstring MINGW,$(shell uname -s)),)
  SLINK = cp -r
  export NO_SYMLINK = 1
endif

all: xpi

xpi: $(xpi_dir)/$(xpi_name)

$(xpi_dir):
	mkdir -p $(xpi_dir)

stage_files = $(stage_dir)/chrome $(stage_dir)/install.rdf $(stage_dir)/bootstrap.js $(stage_dir)/modules

$(stage_dir):
	mkdir -p $(stage_dir)
	$(MAKE) $(stage_files)

$(stage_dir)/bootstrap.js: $(srcdir)/bootstrap.js
	$(SLINK) $(srcdir)/bootstrap.js $(stage_dir)/bootstrap.js

$(stage_dir)/install.rdf: $(srcdir)/install.rdf
	$(SLINK) $(srcdir)/install.rdf $(stage_dir)/install.rdf

$(stage_dir)/chrome: $(srcdir)/chrome
	$(SLINK) $(srcdir)/chrome $(stage_dir)/chrome

$(stage_dir)/modules: $(srcdir)/modules
	$(SLINK) $(srcdir)/modules $(stage_dir)/modules

$(xpi_dir)/$(xpi_name): $(xpi_dir) $(stage_dir) $(dep_files)
	rm -f $(xpi_dir)/$(xpi_name)
	cd $(stage_dir) && zip -9r $(xpi_name) $(xpi_files)
	mv $(stage_dir)/$(xpi_name) $(xpi_dir)/$(xpi_name)

web: $(static_dir)

$(static_dir):
	rsync -av $(web_dir)/ $(static_dir)/

	perl -i -pe "s:VERSION='[^']+':VERSION='$(version)':" $(TOPSRCDIR)/setup.py
	perl -i -pe 's:/[^/]+/auth.html:/$(version)/auth.html:go' $(TOPSRCDIR)/staging.ini
	perl -i -pe 's:/[^/]+/auth.html:/$(version)/auth.html:go' $(TOPSRCDIR)/production.ini

	find $(static_dir) -name \*.html | xargs perl -i -pe 's:/dev/:/$(version)/:go'
	perl -i -pe 's:/dev/:/$(version)/:go' $(static_dir)/scripts/oauth.js

	cd $(static_dir) && $(requirejs_dir)/build/build.sh build.js
	cd $(static_dir)/settings && $(requirejs_dir)/build/build.sh build.js
	cd $(static_dir)/share && $(requirejs_dir)/build/build.sh build.js
	cd $(static_dir)/share/panel && $(requirejs_dir)/build/build.sh build.js

clean:
	rm -rf $(objdir)
	rm -rf $(static_dir)
	rm -rf $(dist_dir)
	rm -f f1.spec

dist:   f1.spec
	$(PYTHON) setup.py sdist --formats gztar,zip
	# This is so Hudson can get stable urls to this tarball
	ln -sf linkdrop-$(version)$(tag).tar.gz dist/linkdrop-current.tar.gz

rpm:	f1.spec
	$(PYTHON) setup.py bdist_rpm

f1.spec: f1.spec.in Makefile tools/makespec
	tools/makespec $(version)$(tag) linkdrop.egg-info/requires.txt $(GIT_DESCRIBE) < f1.spec.in > f1.spec

build:
	$(VIRTUALENV) --no-site-packages --distribute .
	$(PYTHON) build.py $(APPNAME) $(DEPS)
	$(EZ) nose
	$(EZ) WebTest
	$(EZ) Funkload
	$(EZ) pylint
	$(EZ) coverage

dev:
	$(VIRTUALENV) --no-site-packages --distribute .
	$(PYTHON) build.py $(APPNAME) $(DEV_DEPS)
	$(EZ) nose
	$(EZ) WebTest
	$(EZ) Funkload
	$(EZ) pylint
	$(EZ) coverage

test:
	$(NOSE) $(NOSETESTS_ARGS) $(TESTS)

coverage:
	$(NOSE) $(NOSETESTS_ARGS_C) $(TESTS)
	$(COVERAGE) xml

.PHONY: xpi clean dist rpm build test coverage web $(static_dir)
