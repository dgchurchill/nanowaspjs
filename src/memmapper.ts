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

import { Z80Cpu } from './z80cpu';
import { CrtcMemory } from './crtcmemory';
import { Rom, Ram } from './memory';
import { BinaryReader } from './utils';

export class MemMapper {
    _z80!: Z80Cpu;
    _rams!: Ram[];
    _roms!: Rom[];
    _crtcMemory!: CrtcMemory;

    connect(z80: Z80Cpu, rams: Ram[], roms: Rom[], crtcMemory: CrtcMemory) {
        this._z80 = z80;
        this._rams = rams;
        this._roms = roms;
        this._crtcMemory = crtcMemory;
    }
    
    reset() {
        this.write(0, 0);
    }
    
    restoreState(state: BinaryReader) {
        this.write(0, state.readByte());
    }
    
    getSize() {
        return 1;
    }
        
    read(address: number) {
        return 0;  // MemMapper cannot be read.
    }

    write(address: number, value: number) {
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
}
