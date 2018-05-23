
TYPE=debug

ifeq ($(TYPE),release)
OUTPUTDIR=release
YUI=java -jar tools/yuicompressor-2.4.7.jar --type js
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

$(OBJDIR)/nanowasp-data.ts: $(ROMS_JS) | $(OBJDIR)
	echo "export var data = {};" >> $@
	echo "data.roms = {};" >> $@
	cat $(ROMS_JS:%="%") >> $@

$(OBJDIR)/%.ts: data/roms/%.rom | $(OBJDIR)
	echo "data.roms['$*'] = \"$$(openssl base64 -in "$<" | sed -e "$$ ! s/$$/\\\\/")\";" > "$@"

z80/disassembler_dicts.js: z80/gen_disassembler_dicts.py
	python $< > $@

.PHONY: z80
z80:
	cd z80 && $(MAKE)

.PHONY: FileSaver/FileSaver.js
FileSaver/FileSaver.js:
	git submodule update --init

$(OUTPUTDIR):
	mkdir -p $@

$(OBJDIR):
	mkdir -p $@

$(COREDIR):
	mkdir -p $@
