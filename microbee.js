/**
 * 
 */

var nanowasp = nanowasp || {};

nanowasp.MicroBee = function (graphicsContext, pressedKeys) {
    this._intervalId = null;
    this._runSlice = this._runSliceBody.bind(this);
    this._sliceDoneCallback = null;
    
    // Create the devices
    this._devices = {};
    nanowasp.z80cpu = new nanowasp.Z80Cpu();  // TODO: Code in z80cpu relies on the Z80Cpu instance being available here.  Need to eliminate the globals from the z80 emulation code so this restriction can be removed.
    this._devices.z80 = nanowasp.z80cpu;
    this._devices.keyboard = new nanowasp.Keyboard(pressedKeys);
    this._devices.latchrom = new nanowasp.LatchRom();
    this._devices.crtc = new nanowasp.Crtc(graphicsContext);
    this._devices.memMapper = new nanowasp.MemMapper();
    this._devices.rom1 = new nanowasp.Rom(utils.decodeBase64(nanowasp.data.bios));
    this._devices.rom2 = new nanowasp.Rom(new Uint8Array(16384));
    this._devices.rom3 = new nanowasp.Rom(new Uint8Array(16384));
    this._devices.ram0 = new nanowasp.Ram(32768);
    this._devices.ram1 = new nanowasp.Ram(32768);
    this._devices.ram2 = new nanowasp.Ram(32768);
    this._devices.ram3 = new nanowasp.Ram(32768);
    this._devices.crtcMemory = new nanowasp.CrtcMemory(utils.decodeBase64(nanowasp.data.charRom), graphicsContext);

    this._runnables = [this._devices.z80, this._devices.crtc];

    // Connect the devices
    var roms = [ this._devices.rom1, this._devices.rom2, this._devices.rom3 ];
    var rams = [ this._devices.ram0, this._devices.ram1, this._devices.ram2, this._devices.ram3 ];
    this._devices.memMapper.connect(this._devices.z80, rams, roms, this._devices.crtcMemory);
    this._devices.keyboard.connect(this._devices.crtc, this._devices.latchrom);
    this._devices.crtc.connect(this, this._devices.keyboard, this._devices.crtcMemory);
    this._devices.crtcMemory.connect(this._devices.crtc, this._devices.latchrom);
    
    // Register the ports
    nanowasp.z80cpu.registerPortDevice(0x0b, this._devices.latchrom);
    
    nanowasp.z80cpu.registerPortDevice(0x0c, this._devices.crtc);
    nanowasp.z80cpu.registerPortDevice(0x0e, this._devices.crtc);
    nanowasp.z80cpu.registerPortDevice(0x1c, this._devices.crtc);
    nanowasp.z80cpu.registerPortDevice(0x1e, this._devices.crtc);
    
    for (var i = 0x50; i <= 0x57; ++i) {
        nanowasp.z80cpu.registerPortDevice(i, this._devices.memMapper);
    }
    
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
        
        // Note: Setting _microsToRun to MAX_MICROS_TO_RUN on reset solves a problem where when the CRTC
        //       is reset it will indicate a frame time of 1us.  If the initial slice executes enough code
        //       to initialise the CRTC then everything is OK.  If we start running slices of only 1us
        //       duration then everything slows to a crawl.  TODO: Fix this properly (e.g. ensure CRTC never
        //       returns to small an interval; or, implement a MIN_MICROS_TO_RUN).
        this._microsToRun = this.MAX_MICROS_TO_RUN;
    },

    restoreState: function (state) {
        for (var key in state) {
            var reader = new utils.BinaryReader(utils.decodeBase64(state[key]));
            this._devices[key].restoreState(reader);
        }
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