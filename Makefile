
TYPE=debug

ifeq ($(TYPE),release)
OUTPUTDIR=release
YUI=java -jar tools/yuicompressor-2.4.6.jar --type js
else
OUTPUTDIR=debug
YUI=cat
endif

VERSION=$(shell git describe)$(shell if ! git diff --quiet HEAD; then echo -mods; fi;)
UPDATE_DATE=$(shell date "+%Y-%m-%d")

OBJDIR=$(OUTPUTDIR)/objs
COREDIR=$(OUTPUTDIR)/$(VERSION)

NANOWASP_JS=nanowasp.js crtc.js crtcmemory.js keyboard.js latchrom.js memmapper.js memory.js \
            microbee.js utils.js z80cpu.js virtualtape.js tapeinjector.js tape_settings.js
Z80_JS=z80/z80_full.js z80/z80_ops_full.js

ROMS=$(wildcard data/roms/*.rom)
ROMS_JS=$(ROMS:data/roms/%.rom=$(OBJDIR)/%.js)

MWBS=$(wildcard data/mwb/*.mwb)
MWBS_JS=$(MWBS:data/mwb/%.mwb=$(OBJDIR)/%.js)

MACS=$(wildcard data/mac/*.mac)
MACS_JS=$(MACS:data/mac/%.mac=$(OBJDIR)/%.js)

HTML=$(OUTPUTDIR)/index.html $(OUTPUTDIR)/maintenance.html $(COREDIR)/about.html $(COREDIR)/help.html $(COREDIR)/main.css
JAVASCRIPT=$(COREDIR)/nanowasp.js $(COREDIR)/z80.js $(COREDIR)/data.js
IMAGES=$(COREDIR)/dave.jpg $(COREDIR)/monitor.jpg
HTACCESS=$(COREDIR)/.htaccess

.PHONY: nanowasp
nanowasp: $(HTML) $(JAVASCRIPT) $(IMAGES) $(HTACCESS)

# Used as a dependency for targets that should always be built (e.g. targets that need to update if $(VERSION) changes).
.PHONY: force_build
force_build:

$(OUTPUTDIR)/index.html: nanowasp.html force_build | $(OUTPUTDIR)
	cat "$<" | sed -e 's/#UPDATE_DATE#/$(UPDATE_DATE)/g' | sed -e 's/#VERSION#/$(VERSION)/g' > "$@"

$(OUTPUTDIR)/maintenance.html: maintenance.html force_build | $(OUTPUTDIR)
	cat "$<" | sed -e 's/#UPDATE_DATE#/$(UPDATE_DATE)/g' | sed -e 's/#VERSION#/$(VERSION)/g' > "$@"

$(COREDIR)/%.html: %.html | $(COREDIR)
	cp "$<" "$@"

$(COREDIR)/.htaccess: htaccess | $(COREDIR)
	cp $< $@

$(COREDIR)/main.css: main.css | $(COREDIR)
	cp $< $@

$(IMAGES): $(COREDIR)/%: images/% | $(COREDIR)
	cp $< $@

$(COREDIR)/nanowasp.js: $(NANOWASP_JS) | $(COREDIR)
	cat $(NANOWASP_JS) | $(YUI) > $@
	gzip -c $@ > $@.gz

$(COREDIR)/z80.js: $(Z80_JS) | $(COREDIR) z80
	cat $(Z80_JS) | $(YUI) > $@
	gzip -c $@ > $@.gz

$(COREDIR)/data.js: $(OBJDIR)/nanowasp-data.js | $(COREDIR)
	cat $< | $(YUI) > $@
	gzip -c $@ > $@.gz

$(OBJDIR)/nanowasp-data.js: $(ROMS_JS) $(MWBS_JS) $(MACS_JS) | $(OBJDIR)
	echo "var nanowasp = nanowasp || {};" > $@
	echo "nanowasp.data = {};" >> $@
	echo "nanowasp.data.roms = {};" >> $@
	cat $(ROMS_JS:%="%") >> $@
	echo "nanowasp.data.mwbs = {};" >> $@
	cat $(MWBS_JS:%="%") >> $@
	cat $(MACS_JS:%="%") >> $@

$(OBJDIR)/%.js: data/roms/%.rom | $(OBJDIR)
	echo "nanowasp.data.roms['$*'] = \"$$(openssl base64 -in "$<" | sed -e "$$ ! s/$$/\\\\/")\";" > "$@"

$(OBJDIR)/%.js: data/mwb/%.mwb | $(OBJDIR)
	echo "nanowasp.data.mwbs['$*.mwb'] = \"$$(openssl base64 -in "$<" | sed -e "$$ ! s/$$/\\\\/")\";" > "$@"

$(OBJDIR)/%.js: data/mac/%.mac | $(OBJDIR)
	echo "nanowasp.data.mwbs['$*.mac'] = \"$$(openssl base64 -in "$<" | sed -e "$$ ! s/$$/\\\\/")\";" > "$@"


.PHONY: z80
z80:
	cd z80 && $(MAKE)

$(OUTPUTDIR):
	mkdir -p $@

$(OBJDIR):
	mkdir -p $@

$(COREDIR):
	mkdir -p $@
