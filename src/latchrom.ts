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

import { getBit, BinaryReader } from './utils'

export class LatchRom {
    _isLatched: boolean;

    constructor() {
        this._isLatched = false;
    };

    reset() {
        this._isLatched = false;
    }
        
    restoreState(state: BinaryReader) {
        this._isLatched = state.readBool();
    }
    
    read(address: number) {
        return 0;  // Cannot be read
    }
    
    write(address: number, value: number) {
        this._isLatched = getBit(value, 0) == 1;
    }
    
    getSize() {
        return 1;
    }
    
    isLatched() {
        return this._isLatched;
    }
}
