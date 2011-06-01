/**
 * 
 */

var nanowasp = nanowasp || {};

nanowasp.MemMapper = function() {
};

nanowasp.MemMapper.prototype = {
    connect: function (z80, rams, roms, crtcMemory) {
        this._z80 = z80;
        this._rams = rams;
        this._roms = roms;
        this._crtcMemory = crtcMemory;
    },
        
    read: function (address) {
        return 0;  // MemMapper cannot be read.
    },

    write: function (address, value) {
        var BANK_MASK = 0x07;
        var ROM_DISABLE_MASK = 0x04;
        var VIDEO_RAM_DISABLE_MASK = 0x08;
        var VIDEO_RAM_LOCATION_MASK = 0x10;
        var ROM_SELECT_MASK = 0x20;
        
        var LOW_BLOCK = 0x0000;
        var HIGH_BLOCK = 0x8000;
        var HIGH_BLOCK_A = HIGH_BLOCK;
        var HIGH_BLOCK_B = HIGH_BLOCK + 0x4000;
        var GRAPHICS_ADDRESS_A = 0x8000;
        var GRAPHICS_ADDRESS_B = 0xF000;
                
        // Lower 32k
        switch (value & BANK_MASK)
        {
        case 0:
        case 6:
            this._z80.registerMemoryDevice(LOW_BLOCK, this._rams[1]); 
            break;

        case 1:
        case 7:
            this._z80.registerMemoryDevice(LOW_BLOCK, this._rams[3]); 
            break;

        case 2:
        case 4:
            this._z80.registerMemoryDevice(LOW_BLOCK, this._rams[0]); 
            break;

        case 3:
        case 5:
            this._z80.registerMemoryDevice(LOW_BLOCK, this._rams[2]); 
            break;
        }

        // Upper 32k
        if (value & ROM_DISABLE_MASK) {
            this._z80.registerMemoryDevice(HIGH_BLOCK, this._rams[1]);
        } else {
            this._z80.registerMemoryDevice(HIGH_BLOCK_A, this._roms[0]);

            if (value & ROM_SELECT_MASK) {
                this._z80.registerMemoryDevice(HIGH_BLOCK_B, this._roms[2]);
            } else {
                this._z80.registerMemoryDevice(HIGH_BLOCK_B, this._roms[1]);
            }
        }

        // Video RAM - *this must be last* so that it overrides any other handlers already registered
        if (!(value & VIDEO_RAM_DISABLE_MASK))
        {
            // Enable video RAM
            if (value & VIDEO_RAM_LOCATION_MASK) {
                this._z80.registerMemoryDevice(GRAPHICS_ADDRESS_A, this._crtcMemory);
            } else {
                this._z80.registerMemoryDevice(GRAPHICS_ADDRESS_B, this._crtcMemory);
            }
        }
    }
};
