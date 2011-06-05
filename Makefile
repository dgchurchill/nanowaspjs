
YUI=java -jar tools/yuicompressor-2.4.6.jar

NANOWASP_JS=nanowasp.js crtc.js crtcmemory.js data.js keyboard.js latchrom.js memmapper.js memory.js microbee.js utils.js z80cpu.js
Z80_JS=z80/z80_full.js z80/z80_ops_full.js
CONTENT=nanowasp.html about.html images/dave.jpg images/monitor.jpg htaccess

all: nanowasp

nanowasp: nanowasp_js z80_js $(CONTENT)
	cp $(CONTENT) build
	mv build/htaccess build/.htaccess
	mv build/nanowasp.html build/index.html

nanowasp_js: $(NANOWASP_JS)
	mkdir -p build
	cat $(NANOWASP_JS) | $(YUI) --type js > build/nanowasp.js
	gzip -c build/nanowasp.js > build/nanowasp.js.gz

z80_js: z80/*
	cd z80 && make
	mkdir -p build
	cat $(Z80_JS) | $(YUI) --type js > build/z80.js
	gzip -c build/z80.js > build/z80.js.gz

