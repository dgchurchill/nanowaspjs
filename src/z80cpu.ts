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

import { Z80, z80_init, z80_reset, z80_do_opcodes, z80_set_breakpoint, z80_clear_breakpoints, z80_ret } from './z80/z80';
import { BinaryReader } from './utils';

interface Device {
    read: (address: number) => number;
    write: (address: number, value: number) => void;
    getSize: () => number;
}

interface Handler {
    handler: Device;
    base: number;
}

export class Z80Cpu {
    static FREQUENCY_HZ = 3375000;
    static MEMORY_SIZE = 65536;
    static PORT_SIZE = 256;
    
    _z80: Z80;

    _memoryBlockSize: number;
    _memoryHandlers: Handler[];
    
    _portBlockSize: number;
    _portHandlers: Handler[];

    constructor() {
        this._z80 = z80_init(this.readbyte_internal, this.writebyte_internal, this.readport, this.writeport);
        z80_reset(this._z80);
        
        var nullHandler = {
            read: (address: number) => 0,
            write: (address: number, value: number) => undefined,
            getSize: () => 0
        };
        
        this._memoryBlockSize = Z80Cpu.MEMORY_SIZE;
        this._memoryHandlers = [{ handler: nullHandler, base: 0 }];
        
        this._portBlockSize = Z80Cpu.PORT_SIZE;
        this._portHandlers = [{ handler: nullHandler, base: 0 }];
    };

    reset() {
        z80_reset(this._z80);
    }

    readbyte_internal = (address: number): number => {
        var entry = this._memoryHandlers[address / this._memoryBlockSize | 0];  // (x | 0) coerces x into an integer
        return entry.handler.read(address - entry.base);
    }

    writebyte_internal = (address: number, value: number): void => {
        var entry = this._memoryHandlers[address / this._memoryBlockSize | 0];  // (x | 0) coerces x into an integer
        entry.handler.write(address - entry.base, value);
    }

    readport = (address: number): number => {
        address &= 0xff;
        var entry = this._portHandlers[address / this._portBlockSize | 0];  // (x | 0) coerces x into an integer
        return entry.handler.read(address - entry.base);
    }

    writeport = (address: number, value: number): void => {
        address &= 0xff;
        var entry = this._portHandlers[address / this._portBlockSize | 0];  // (x | 0) coerces x into an integer
        entry.handler.write(address - entry.base, value);    
    }

    restoreState(state: BinaryReader) {
        this._z80.f = state.readByte();
        this._z80.a = state.readByte();
        this._z80.c = state.readByte();
        this._z80.b = state.readByte();
        this._z80.e = state.readByte();
        this._z80.d = state.readByte();
        this._z80.l = state.readByte();
        this._z80.h = state.readByte();
        this._z80.ixl = state.readByte();
        this._z80.ixh = state.readByte();
        this._z80.iyl = state.readByte();
        this._z80.iyh = state.readByte();
        this._z80.sp = state.readWord();
        
        this._z80.f_ = state.readByte();
        this._z80.a_ = state.readByte();
        this._z80.c_ = state.readByte();
        this._z80.b_ = state.readByte();
        this._z80.e_ = state.readByte();
        this._z80.d_ = state.readByte();
        this._z80.l_ = state.readByte();
        this._z80.h_ = state.readByte();
        
        state.readWord();  // For some reason the Z80 emulator used by the C++ code stores alternate copies of IX, IY and SP.
        state.readWord();
        state.readWord();

        this._z80.pc = state.readWord();
        this._z80.r = state.readByte();
        this._z80.i = state.readByte();
        this._z80.iff1 = state.readByte();
        this._z80.iff2 = state.readByte();
        this._z80.im = state.readByte();
    }
    
    execute(time: number, duration: number) {
        this._z80.tstates = 0;
        let event_next_event = duration * Z80Cpu.FREQUENCY_HZ / 1000000;  // TODO: Should check how many cycles we did last time and adjust this.  See original C++ code.
        z80_do_opcodes(this._z80, event_next_event);
        return 0;  // Execute again as soon as possible.
    }
    
    getCurrentExecutionTime() {
        return this._z80.tstates * 1000000 / Z80Cpu.FREQUENCY_HZ;
    }
    
    setBreakpoint(address: number, handler: () => void) {
        z80_set_breakpoint(this._z80, address, handler);
    }
    
    clearBreakpoint() {
        z80_clear_breakpoints(this._z80);
    }
    
    registerMemoryDevice(address: number, handler: Device) {
        var updated = this._registerDevice(address, handler, Z80Cpu.MEMORY_SIZE, this._memoryBlockSize, this._memoryHandlers);
        this._memoryBlockSize = updated.blockSize;
        this._memoryHandlers = updated.handlers;
    }
    
    registerPortDevice(address: number, handler: Device) {
        var updated = this._registerDevice(address, handler, Z80Cpu.PORT_SIZE, this._portBlockSize, this._portHandlers);
        this._portBlockSize = updated.blockSize;
        this._portHandlers = updated.handlers;
    }
    
    _registerDevice(address: number, handler: Device, limit: number, blockSize: number, handlers: Handler[]) {
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

    z80_ret() {
        z80_ret(this._z80);
    }
}
