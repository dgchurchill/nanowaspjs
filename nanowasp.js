



window.onload = function () {
    nanowasp.z80cpu = new nanowasp.Z80Cpu();  // TODO: Code in z80cpu relies on the Z80Cpu instance being available here.  Need to eliminate the globals from the z80 emulation code so this restriction can be removed.

    var memMapper = new nanowasp.MemMapper();
    var crtc = new nanowasp.Crtc();
    
    var charRomData = new Uint8Array(4096);
    var crtcMemory = new nanowasp.CrtcMemory(charRomData);
    
    var rams = [
        new nanowasp.Ram(32768),
        new nanowasp.Ram(32768),
        new nanowasp.Ram(32768),
        new nanowasp.Ram(32768)
    ];
    
    var roms = [
        new nanowasp.Rom(new Uint8Array(16384)),
        new nanowasp.Rom(new Uint8Array(16384)),
        new nanowasp.Rom(new Uint8Array(16384))
    ];
    
};
