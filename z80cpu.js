/*  NanoWasp - A MicroBee emulator
 *  Copyright (C) 2007, 2011 David G. Churchill
 *
 *  This file is part of NanoWasp.
 *
 *  NanoWasp is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  NanoWasp is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

/* Functions called by the z80 emulation code */

function readbyte_internal(address) {
    var entry = nanowasp.z80cpu._memoryHandlers[address / nanowasp.z80cpu._memoryBlockSize | 0];  // (x | 0) coerces x into an integer
    return entry.handler.read(address - entry.base);
}

function writebyte_internal(address, value) {
    var entry = nanowasp.z80cpu._memoryHandlers[address / nanowasp.z80cpu._memoryBlockSize | 0];  // (x | 0) coerces x into an integer
    entry.handler.write(address - entry.base, value);
}

function readport(address) {
    address &= 0xff;
    var entry = nanowasp.z80cpu._portHandlers[address / nanowasp.z80cpu._portBlockSize | 0];  // (x | 0) coerces x into an integer
    return entry.handler.read(address - entry.base);
}

function writeport(address, value) {
    address &= 0xff;
    var entry = nanowasp.z80cpu._portHandlers[address / nanowasp.z80cpu._portBlockSize | 0];  // (x | 0) coerces x into an integer
    entry.handler.write(address - entry.base, value);    
}


var nanowasp = nanowasp || {};

/* Z80Cpu currently only supports a single instance because the emulation code uses a bunch of globals */
nanowasp.Z80Cpu = function () {
    if (nanowasp.Z80Cpu.IsInstantiated) {
        throw "Only supports one instance";
    }
    nanowasp.Z80Cpu.IsInstantiated = true;
    
    z80_init();
    
    var nullHandler = {
        read: function (address) {
            return 0;
        },
        
        write: function (address, value) {
        }
    };
    
    this._memoryBlockSize = this.MEMORY_SIZE;
    this._memoryHandlers = [{ handler: nullHandler, base: 0 }];
    
    this._portBlockSize = this.PORT_SIZE;
    this._portHandlers = [{ handler: nullHandler, base: 0 }];
};

nanowasp.Z80Cpu.IsInstantiated = false;

nanowasp.Z80Cpu.prototype = {
    FREQUENCY_HZ: 3375000,
    MEMORY_SIZE: 65536,
    PORT_SIZE: 256,
    
    reset: function () {
        z80_reset();
    },
    
    restoreState: function(state) {
        z80.f = state.readByte();
        z80.a = state.readByte();
        z80.c = state.readByte();
        z80.b = state.readByte();
        z80.e = state.readByte();
        z80.d = state.readByte();
        z80.l = state.readByte();
        z80.h = state.readByte();
        z80.ixl = state.readByte();
        z80.ixh = state.readByte();
        z80.iyl = state.readByte();
        z80.iyh = state.readByte();
        z80.sp = state.readWord();
        
        z80.f_ = state.readByte();
        z80.a_ = state.readByte();
        z80.c_ = state.readByte();
        z80.b_ = state.readByte();
        z80.e_ = state.readByte();
        z80.d_ = state.readByte();
        z80.l_ = state.readByte();
        z80.h_ = state.readByte();
        
        state.readWord();  // For some reason the Z80 emulator used by the C++ code stores alternate copies of IX, IY and SP.
        state.readWord();
        state.readWord();

        z80.pc = state.readWord();
        z80.r = state.readByte();
        z80.i = state.readByte();
        z80.iff1 = state.readByte();
        z80.iff2 = state.readByte();
        z80.im = state.readByte();
    },
    
    execute: function (time, duration) {
        tstates = 0;
        event_next_event = duration * this.FREQUENCY_HZ / 1000000;  // TODO: Should check how many cycles we did last time and adjust this.  See original C++ code.
        z80_do_opcodes();
        return 0;  // Execute again as soon as possible.
    },
    
    getCurrentExecutionTime: function () {
        return tstates * 1000000 / this.FREQUENCY_HZ;
    },
    
    setBreakpoint: function (address, handler) {
        z80_set_breakpoint(address, handler);
    },
    
    clearBreakpoint: function () {
        z80_clear_breakpoints();
    },
    
    registerMemoryDevice: function (address, handler) {
        var updated = this._registerDevice(address, handler, this.MEMORY_SIZE, this._memoryBlockSize, this._memoryHandlers);
        this._memoryBlockSize = updated.blockSize;
        this._memoryHandlers = updated.handlers;
    },
    
    registerPortDevice: function (address, handler) {
        var updated = this._registerDevice(address, handler, this.PORT_SIZE, this._portBlockSize, this._portHandlers);
        this._portBlockSize = updated.blockSize;
        this._portHandlers = updated.handlers;
    },
    
    _registerDevice: function (address, handler, limit, blockSize, handlers) {
        var start = address;
        var end = start + handler.getSize();
        
        var startAlignment = 1;
        var endAlignment = 1;
        
        if (end > limit) {
            throw "Handler doesn't fit in range";
        }
        
        while ((start & startAlignment) == 0 && startAlignment < limit) {
            startAlignment <<= 1;
        }
        
        while ((end & endAlignment) == 0 && endAlignment < limit) {
            endAlignment <<= 1;
        }
        
        var alignment = Math.min(startAlignment, endAlignment);
        
        if (alignment < blockSize) {
            // Smaller blocks are required to store the details of this handler, so rebuild 
            // the mem_handlers vector at the new size.

            var newHandlers = [];
            
            for (var i = 0; i < handlers.length; ++i) {
                for (var j = 0; j < blockSize / alignment; ++j) {
                    newHandlers.push(handlers[i]);
                }
            }
            
            handlers = newHandlers;
            blockSize = alignment;
        }
        
        // Install the new handler
        var entry = { handler: handler, base: address };
        for (var i = start / blockSize; i < end / blockSize; ++i) {
            handlers[i] = entry;
        }
        
        return {
            blockSize: blockSize,
            handlers: handlers
        };
    }
};

