/**
 * 
 */

var nanowasp = nanowasp || {};

nanowasp.MicroBee = function (graphicsContext, pressedKeys) {
    this._intervalId = null;
    this._runSlice = this._runSliceBody.bind(this);
    this._sliceDoneCallback = null;
    
    // Create the devices
    nanowasp.z80cpu = new nanowasp.Z80Cpu();  // TODO: Code in z80cpu relies on the Z80Cpu instance being available here.  Need to eliminate the globals from the z80 emulation code so this restriction can be removed.
    var keyboard = new nanowasp.Keyboard(pressedKeys);
    var latchrom = new nanowasp.LatchRom();
    var crtc = new nanowasp.Crtc(graphicsContext);
    var memMapper = new nanowasp.MemMapper();
    var roms = [
                new nanowasp.Rom(utils.decodeBase64(nanowasp.data.bios)),
                new nanowasp.Rom(new Uint8Array(16384)),
                new nanowasp.Rom(new Uint8Array(16384))
            ];
    var rams = [
                new nanowasp.Ram(32768),
                new nanowasp.Ram(32768),
                new nanowasp.Ram(32768),
                new nanowasp.Ram(32768)
            ];
    var charRomData = utils.decodeBase64(nanowasp.data.charRom);
    var crtcMemory = new nanowasp.CrtcMemory(charRomData, graphicsContext);
    
    // Connect the devices
    keyboard.connect(crtc, latchrom);
    crtc.connect(this, keyboard, crtcMemory);
    memMapper.connect(nanowasp.z80cpu, rams, roms, crtcMemory);
    crtcMemory.connect(crtc, latchrom);
    
    // Register the ports
    nanowasp.z80cpu.registerPortDevice(0x0b, latchrom);
    
    nanowasp.z80cpu.registerPortDevice(0x0c, crtc);
    nanowasp.z80cpu.registerPortDevice(0x0e, crtc);
    nanowasp.z80cpu.registerPortDevice(0x1c, crtc);
    nanowasp.z80cpu.registerPortDevice(0x1e, crtc);
    
    for (var i = 0x50; i <= 0x57; ++i) {
        nanowasp.z80cpu.registerPortDevice(i, memMapper);
    }

    // Build device arrays
    this._runnables = [nanowasp.z80cpu, crtc];
    this._devices = [nanowasp.z80cpu, crtc, keyboard, latchrom, memMapper, crtcMemory];
    this._devices = this._devices.concat(roms, rams);
    
    // Reset everything to get ready to start
    this.reset();
};

nanowasp.MicroBee.prototype = {
    MAX_MICROS_TO_RUN: 200000,
        
    reset: function () {
        for (var i in this._devices) {
            this._devices[i].reset();
        }
        
        this._emulationTime = 0;
        this._microsToRun = this.MAX_MICROS_TO_RUN;
    },

    setSliceDoneCallback: function (cb) {
        this._sliceDoneCallback = cb;
    },
    
    _runSliceBody: function () {
        var nextMicros = this.MAX_MICROS_TO_RUN;
        
        for (var i in this._runnables) {
            var device = this._runnables[i];
            var deviceNextMicros = device.execute(this._emulationTime, this._microsToRun);
            if (deviceNextMicros != 0) {
                nextMicros = Math.min(nextMicros, deviceNextMicros);
            }
        }
        
        this._emulationTime += this._microsToRun;
        this._microsToRun = nextMicros;

        // TODO: Speed limiting to run at original clock speed.
        
        if (this._sliceDoneCallback != null) {
            this._sliceDoneCallback();
        }
    },
    
    getTime: function () {
        // TODO: This doesn't match the original C++ implementation. May only matter for FDC emulation?
        return this._emulationTime;
    },
    
    start: function () {
        if (this._intervalId == null) {
            this._intervalId = window.setInterval(this._runSlice, 1);  // TODO: Different scheduling mechanism?  See docs for window.postMessage.
        }
    },
    
    stop: function () {
        if (this._intervalId != null) {
            window.clearInterval(this._intervalId);
            this._intervalId = null;
        }
    }
};