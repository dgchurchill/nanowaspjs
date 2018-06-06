NanoWaspJS
==========

http://www.nanowasp.org/

NanoWasp is an emulator for the MicroBee computer.
The MicroBee was popular in Australia in the mid 1980s.
NanoWasp runs in any recent browser with JavaScript enabled.


Source code orientation
-----------------------

* nanowasp.html - Main HTML source
* nanowasp.ts - Main JavaScript source
* debugger.ts - Debugger view
* tapeview.ts - Tape view

* microbee.ts - Main emulation source
* crtc.ts, crtcmemory.ts, keyboard.ts, latchrom.ts, memmapper.ts,
  memory.ts, tapeinjector.ts, virtualtape.ts z80cpu.ts - Emulation modules

See the [original NanoWasp project](https://github.com/dgchurchill/nanowasp) for more source documentation.


Building
--------

1. Obtain MicroBee software and place it in ./dist/software/ (and update ./src/software.ts)
2. npm install
3. npx webpack --config webpack.prod.js OR webpack --config webpack.dev.js
