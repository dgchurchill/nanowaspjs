



window.onload = function () {
    var pressedKeys = [];
    window.onkeydown = function (event) {
        pressedKeys[event.keycode] = true;
    };
    
    window.onkeyup = function (event) {
        pressedKeys[event.keycode] = false;
    };
    
    var graphicsContext = document.getElementById("vdu").getContext('2d');
    
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
    crtc.connect(keyboard, crtcMemory);
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
    
    // TODO: Refactor this into a nice reset function.  Just resetting mem mapper here so the initial memory mappings are made.
    memMapper.reset();
    
    // The run loop
    var runnables = [nanowasp.z80cpu, crtc];
    
    var MAX_MICROS_TO_RUN = 200000;
    var microsToRun = MAX_MICROS_TO_RUN;
    var nextMicros = 0;
    emulationTime = 0;  // FIXME: Make this not global!!
    
    var pc_span = document.getElementById("pc");
    
    var runSlice = function () {
        nextMicros = MAX_MICROS_TO_RUN;
        
        for (var i in runnables) {
            var device = runnables[i];
            var deviceNextMicros = device.execute(emulationTime, microsToRun);
            if (deviceNextMicros != 0) {
                nextMicros = Math.min(nextMicros, deviceNextMicros);
            }
        }
        
        emulationTime += microsToRun;
        microsToRun = nextMicros;
        
        pc_span.textContent = z80.pc.toString() + " - " + readbyte_internal(z80.pc); 
        // TODO: Speed limiting to run at original clock speed.
    };
    
    var intervalId = null;
    
    document.getElementById("start_button").onclick = function () {
        if (intervalId == null) {
            intervalId = window.setInterval(runSlice, 1);
        }
    };
    
    document.getElementById("stop_button").onclick = function () {
        if (intervalId != null) {
            window.clearInterval(intervalId);
            intervalId = null;
        }
    };
    
    
};
