
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
SOFTWAREDIR=$(OUTPUTDIR)/software

NANOWASP_JS=nanowasp.js crtc.js crtcmemory.js keyboard.js latchrom.js memmapper.js memory.js \
            microbee.js utils.js z80cpu.js virtualtape.js tapeinjector.js tapeview.js \
            software.js debugger.js z80/disassembler_dicts.js z80/disassembler.js \
            FileSaver/FileSaver.js
Z80_JS=z80/z80_full.js z80/z80_ops_full.js

ROMS=$(wildcard data/roms/*.rom)
ROMS_JS=$(ROMS:data/roms/%.rom=$(OBJDIR)/%.js)

SOFTWARE_IN=data/software/

HTML=$(OUTPUTDIR)/index.html $(OUTPUTDIR)/maintenance.html $(COREDIR)/main.css
JAVASCRIPT=$(COREDIR)/nanowasp.js $(COREDIR)/z80.js $(COREDIR)/data.js
IMAGES=$(COREDIR)/monitor.jpg
HTACCESS=$(COREDIR)/.htaccess

.PHONY: nanowasp
nanowasp: $(HTML) $(JAVASCRIPT) $(IMAGES) software $(HTACCESS)

# Used as a dependency for targets that should always be built (e.g. targets that need to update if $(VERSION) changes).
.PHONY: force_build
force_build:

$(OUTPUTDIR)/index.html: nanowasp.html force_build | $(OUTPUTDIR)
	cat "$<" | sed -e 's/#UPDATE_DATE#/$(UPDATE_DATE)/g' | sed -e 's/#VERSION#/$(VERSION)/g' > "$@"

$(OUTPUTDIR)/maintenance.html: maintenance.html force_build | $(OUTPUTDIR)
	cat "$<" | sed -e 's/#UPDATE_DATE#/$(UPDATE_DATE)/g' | sed -e 's/#VERSION#/$(VERSION)/g' > "$@"


$(COREDIR)/.htaccess: htaccess | $(COREDIR)
	cp $< $@

$(COREDIR)/main.css: main.css | $(COREDIR)
	cp $< $@

$(IMAGES): $(COREDIR)/%: images/% | $(COREDIR)
	cp $< $@

.PHONY: software
software:
	mkdir -p "$(SOFTWAREDIR)"
	cp -R "$(SOFTWARE_IN)" "$(SOFTWAREDIR)"

$(COREDIR)/nanowasp.js: $(NANOWASP_JS) | $(COREDIR)
	cat $(NANOWASP_JS) | $(YUI) > $@
	gzip -c $@ > $@.gz

$(COREDIR)/z80.js: $(Z80_JS) | $(COREDIR) z80
	cat $(Z80_JS) | $(YUI) > $@
	gzip -c $@ > $@.gz

$(COREDIR)/data.js: $(OBJDIR)/nanowasp-data.js | $(COREDIR)
	cat $< | $(YUI) > $@
	gzip -c $@ > $@.gz

$(OBJDIR)/nanowasp-data.js: $(ROMS_JS) | $(OBJDIR)
	echo "var nanowasp = nanowasp || {};" > $@
	echo "nanowasp.data = {};" >> $@
	echo "nanowasp.data.roms = {};" >> $@
	cat $(ROMS_JS:%="%") >> $@

$(OBJDIR)/%.js: data/roms/%.rom | $(OBJDIR)
	echo "nanowasp.data.roms['$*'] = \"$$(openssl base64 -in "$<" | sed -e "$$ ! s/$$/\\\\/")\";" > "$@"


.PHONY: z80
z80:
	cd z80 && $(MAKE)

$(OUTPUTDIR):
	mkdir -p $@

$(OBJDIR):
	mkdir -p $@

$(COREDIR):
	mkdir -p $@
