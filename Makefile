
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
ROMS=$(OBJDIR)/basic_5_22e.js $(OBJDIR)/char.js $(OBJDIR)/bships.js
Z80_JS=z80/z80_full.js z80/z80_ops_full.js
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

$(OBJDIR)/data.js: $(ROMS) | $(OBJDIR)
	echo "var nanowasp = nanowasp || {};" > $(OBJDIR)/data.js
	echo "nanowasp.data = {};" >> $(OBJDIR)/data.js
	cat $(ROMS) >> $@

$(ROMS): $(OBJDIR)/%.js: roms/%.rom | $(OBJDIR)
	echo "nanowasp.data.$* = \"$$(openssl base64 -in $< | sed -e "$$ ! s/$$/\\\\/")\";" > $@


.PHONY: z80
z80:
	cd z80 && $(MAKE)

$(OUTPUTDIR):
	mkdir -p $@

$(OBJDIR):
	mkdir -p $@

