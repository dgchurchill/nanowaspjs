



window.onload = function () {
    var pressedKeys = [];
    window.onkeydown = function (event) {
        pressedKeys[event.keycode] = true;
    };
    
    window.onkeyup = function (event) {
        pressedKeys[event.keycode] = false;
    };
    
    // Create the devices
    nanowasp.z80cpu = new nanowasp.Z80Cpu();  // TODO: Code in z80cpu relies on the Z80Cpu instance being available here.  Need to eliminate the globals from the z80 emulation code so this restriction can be removed.

    var keyboard = new nanowasp.Keyboard(pressedKeys);

    var latchrom = new nanowasp.LatchRom();

    var crtc = new nanowasp.Crtc();

    var memMapper = new nanowasp.MemMapper();
    
    var roms = [
                new nanowasp.Rom(new Uint8Array(16384)),   // TODO: Load BIOS code here
                new nanowasp.Rom(new Uint8Array(16384)),
                new nanowasp.Rom(new Uint8Array(16384))
            ];
    
    var rams = [
                new nanowasp.Ram(32768),
                new nanowasp.Ram(32768),
                new nanowasp.Ram(32768),
                new nanowasp.Ram(32768)
            ];
    
    var charRomData = new Uint8Array(4096);
    var crtcMemory = new nanowasp.CrtcMemory(charRomData);
    
    // Connect the devices
    keyboard.connect(crtc, latchrom);
    crtc.connect(keyboard);
    memMapper.connect(nanowasp.z80cpu, rams, roms, crtcMemory);
    crtcMemory.connect(crtc, latchrom);
    
    
    
    
};
