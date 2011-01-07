version := 0.1.7
xpi_version := 0.7.3

ifeq ($(TOPSRCDIR),)
  export TOPSRCDIR = $(shell pwd)
endif
srcdir=$(TOPSRCDIR)/extensions/firefox-share/src/
objdir=$(TOPSRCDIR)/extensions/firefox-share/dist/
stage_dir=$(objdir)/stage
xpi_dir=$(TOPSRCDIR)/web
web_dir=$(TOPSRCDIR)/web/dev
static_dir=$(TOPSRCDIR)/web/$(version)
webbuild_dir=$(TOPSRCDIR)/tools/webbuild
requirejs_dir=$(webbuild_dir)/requirejs

ifeq ($(release_build),)
  xpi_type := dev
  update_url :=
else
  xpi_type := rel
  update_url :=
endif

xpi_name := share-$(xpi_version)-$(xpi_type).xpi
xpi_files := chrome.manifest chrome install.rdf defaults components modules
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

stage_files = $(stage_dir)/defaults $(stage_dir)/chrome $(stage_dir)/install.rdf $(stage_dir)/chrome.manifest $(stage_dir)/components $(stage_dir)/modules

$(stage_dir):
	mkdir -p $(stage_dir)
	$(MAKE) $(stage_files)

$(stage_dir)/chrome.manifest: $(srcdir)/chrome.manifest
	$(SLINK) $(srcdir)/chrome.manifest $(stage_dir)/chrome.manifest

$(stage_dir)/install.rdf: $(srcdir)/install.rdf
	$(SLINK) $(srcdir)/install.rdf $(stage_dir)/install.rdf

$(stage_dir)/chrome: $(srcdir)/chrome
	$(SLINK) $(srcdir)/chrome $(stage_dir)/chrome

$(stage_dir)/components: $(srcdir)/components
	$(SLINK) $(srcdir)/components $(stage_dir)/components

$(stage_dir)/modules: $(srcdir)/modules
	$(SLINK) $(srcdir)/modules $(stage_dir)/modules

$(stage_dir)/defaults: $(srcdir)/defaults
	$(SLINK) $(srcdir)/defaults $(stage_dir)/defaults

$(xpi_dir)/$(xpi_name): $(xpi_dir) $(stage_dir) $(dep_files)
	rm -f $(xpi_dir)/$(xpi_name)
	cd $(stage_dir) && zip -9r $(xpi_name) $(xpi_files)
	mv $(stage_dir)/$(xpi_name) $(xpi_dir)/$(xpi_name)

web: $(static_dir)

$(static_dir):
	rsync -av $(web_dir)/ $(static_dir)/

	perl -i -pe "s:version='[^']+':version='$(version)':" $(TOPSRCDIR)/setup.py
	find $(static_dir) -name \*.html | xargs perl -i -pe 's:/dev/:/$(version)/:go'

	cd $(static_dir) && $(requirejs_dir)/build/build.sh build.js
	cd $(static_dir)/settings && $(requirejs_dir)/build/build.sh build.js
	cd $(static_dir)/share && $(requirejs_dir)/build/build.sh build.js

clean:
	rm -rf $(objdir)
	rm -rf $(static_dir)

.PHONY: xpi clean
