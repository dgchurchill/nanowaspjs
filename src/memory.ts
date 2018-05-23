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

import { DataBlock, makeUint8Array } from './utils'

export class Ram {
    _memory: DataBlock;

    constructor(size) {
        this._memory = makeUint8Array(size);
    }

    reset() {
        this._memory = makeUint8Array(this.getSize());
    }
        
    getSize() {
        return this._memory.length;
    }
    
    restoreState(state) {
        this._memory = state.readBuffer(this.getSize());
    }
        
	read(address) {
		return this._memory[address];
	}

	write(address, value) {
		this._memory[address] = value;
    }
}

export class Rom {
    _memory: DataBlock;

    constructor(data) {
        this._memory = data;
    }

    reset() {
    }
        
    getSize() {
        return this._memory.length;
    }
        
	read(address) {
		return this._memory[address];
	}
	
	write(address, value) {
		// no-op (writing to ROM)
    }
}
