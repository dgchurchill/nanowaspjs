



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
    
    // The run loop
    var runnables = [nanowasp.z80cpu, crtc];
    
    var MAX_MICROS_TO_RUN = 200000;
    var microsToRun = MAX_MICROS_TO_RUN;
    var nextMicros = 0;
    var emulationTime = 0;
    
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
        
        pc_span.textContent = z80.pc.toString(); 
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
