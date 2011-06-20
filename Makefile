
TYPE=debug

ifeq ($(TYPE),release)
OUTPUTDIR=release
YUI=java -jar tools/yuicompressor-2.4.6.jar --type js
else
OUTPUTDIR=debug
YUI=cat
endif

OBJDIR=$(OUTPUTDIR)/objs

NANOWASP_JS=nanowasp.js crtc.js crtcmemory.js keyboard.js latchrom.js memmapper.js memory.js microbee.js utils.js z80cpu.js virtualtape.js
Z80_JS=z80/z80_full.js z80/z80_ops_full.js

ROMS=$(wildcard data/roms/*.rom)
ROMS_JS=$(ROMS:data/roms/%.rom=$(OBJDIR)/%.js)

MWBS=$(wildcard data/mwb/*.mwb)
MWBS_JS=$(MWBS:data/mwb/%.mwb=$(OBJDIR)/%.js)

IMAGES=$(OUTPUTDIR)/dave.jpg $(OUTPUTDIR)/monitor.jpg



.PHONY: nanowasp
nanowasp: $(OUTPUTDIR)/nanowasp.js $(OUTPUTDIR)/z80.js $(OUTPUTDIR)/data.js $(OUTPUTDIR)/index.html $(OUTPUTDIR)/.htaccess $(OUTPUTDIR)/about.html $(IMAGES)

$(OUTPUTDIR)/index.html: nanowasp.html | $(OUTPUTDIR)
	cp $< $@

$(OUTPUTDIR)/about.html: about.html | $(OUTPUTDIR)
	cp $< $@

$(OUTPUTDIR)/.htaccess: htaccess | $(OUTPUTDIR)
	cp $< $@

$(IMAGES): $(OUTPUTDIR)/%: images/% | $(OUTPUTDIR)
	cp $< $@

$(OUTPUTDIR)/nanowasp.js: $(NANOWASP_JS) | $(OUTPUTDIR)
	cat $(NANOWASP_JS) | $(YUI) > $@
	gzip -c $@ > $@.gz

$(OUTPUTDIR)/z80.js: $(Z80_JS) | $(OUTPUTDIR) z80
	cat $(Z80_JS) | $(YUI) > $@
	gzip -c $@ > $@.gz

$(OUTPUTDIR)/data.js: $(OBJDIR)/data.js | $(OUTPUTDIR)
	cat $< | $(YUI) > $@
	gzip -c $@ > $@.gz

$(OBJDIR)/data.js: $(ROMS_JS) $(MWBS_JS) | $(OBJDIR)
	echo "var nanowasp = nanowasp || {};" > $(OBJDIR)/data.js
	echo "nanowasp.data = {};" >> $(OBJDIR)/data.js
	echo "nanowasp.data.roms = {};" >> $(OBJDIR)/data.js
	cat $(ROMS_JS) >> $@
	echo "nanowasp.data.mwbs = {};" >> $(OBJDIR)/data.js
	cat $(MWBS_JS) >> $@

$(OBJDIR)/%.js: data/roms/%.rom | $(OBJDIR)
	echo "nanowasp.data.roms.$* = \"$$(openssl base64 -in $< | sed -e "$$ ! s/$$/\\\\/")\";" > $@

$(OBJDIR)/%.js: data/mwb/%.mwb | $(OBJDIR)
	echo "nanowasp.data.mwbs.$* = \"$$(openssl base64 -in $< | sed -e "$$ ! s/$$/\\\\/")\";" > $@


.PHONY: z80
z80:
	cd z80 && $(MAKE)

$(OUTPUTDIR):
	mkdir -p $@

$(OBJDIR):
	mkdir -p $@

