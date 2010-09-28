
ifeq ($(TOPSRCDIR),)
  export TOPSRCDIR = $(shell pwd)
endif
srcdir=$(TOPSRCDIR)/extensions/firefox-share/src/
objdir=$(TOPSRCDIR)/extensions/firefox-share/dist/
stage_dir=$(objdir)/stage
xpi_dir=$(TOPSRCDIR)/web

version := 0.1

ifeq ($(release_build),)
  xpi_type := dev
  update_url := 
else
  xpi_type := rel
  update_url :=
endif

xpi_name := share-$(version)-$(xpi_type).xpi
xpi_files := chrome.manifest chrome install.rdf defaults


SLINK = ln -sf
ifneq ($(findstring MINGW,$(shell uname -s)),)
  SLINK = cp -r
  export NO_SYMLINK = 1
endif

all: build

setup:
	mkdir -p $(xpi_dir)
	mkdir -p $(stage_dir)
	mkdir -p $(xpi_dir)

build: setup
	test -d $(stage_dir)/chrome.manifest || $(SLINK) $(srcdir)/chrome.manifest $(stage_dir)/chrome.manifest
	test -d $(stage_dir)/install.rdf || $(SLINK) $(srcdir)/install.rdf $(stage_dir)/install.rdf
	test -d $(stage_dir)/chrome || $(SLINK) $(srcdir)/chrome $(stage_dir)/chrome
	test -d $(stage_dir)/defaults || $(SLINK) $(srcdir)/defaults $(stage_dir)/defaults

xpi: build
	rm -f $(xpi_dir)/$(xpi_name)
	cd $(stage_dir);zip -9r $(xpi_name) $(xpi_files)
	mv $(stage_dir)/$(xpi_name) $(xpi_dir)/$(xpi_name)


clean:
	rm -rf $(objdir)

