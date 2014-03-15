NanoWaspJS
==========

http://www.nanowasp.org/

NanoWasp is an emulator for the MicroBee computer.
The MicroBee was popular in Australia in the mid 1980s.
NanoWasp runs in any recent browser with JavaScript enabled.


Source code orientation
-----------------------

* nanowasp.html - Main HTML source
* nanowasp.js - Main JavaScript source
* debugger.js - Debugger view
* tapeview.js - Tape view

* microbee.js - Main emulation source
* crtc.js, crtcmemory.js, keyboard.js, latchrom.js, memmapper.js,
  memory.js, tapeinjector.js, virtualtape.js z80cpu.js - Emulation modules

See the [original NanoWasp project](https://github.com/dgchurchill/nanowasp) for more source documentation.


Building
--------

1. Obtain MicroBee character and BIOS ROMs and place them in ./data/roms/
2. Obtain MicroBee software and place it in ./data/software/ (and update software.js)
3. Ensure git submodules have been checked out
4. make z80
5. make OR make TYPE=release
