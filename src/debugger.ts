/*!  NanoWasp - A MicroBee emulator
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

import { setTextContent } from './utils'
import { Z80 } from './z80/z80'
import { disassemble } from './z80/disassembler'

export class Debugger {
    _z80: Z80;
    _registersElement: HTMLElement;

    constructor(z80: Z80, registersElement: HTMLElement) {
        this._z80 = z80;
        this._registersElement = registersElement;
    }

    update() {
        setTextContent(this._registersElement,
            "PC: " + this._formatHex(this._z80.pc, 4) + "  " +
            "SP: " + this._formatHex(this._z80.sp, 4) + "\n" +
            "AF: " + this._formatHex(this._z80.a, 2) + this._formatHex(this._z80.f, 2) + "  " +
            "BC: " + this._formatHex(this._z80.b, 2) + this._formatHex(this._z80.c, 2) + "\n" +
            "DE: " + this._formatHex(this._z80.d, 2) + this._formatHex(this._z80.e, 2) + "  " +
            "HL: " + this._formatHex(this._z80.h, 2) + this._formatHex(this._z80.l, 2) + "\n" +
            "IX: " + this._formatHex(this._z80.ixh, 2) + this._formatHex(this._z80.ixl, 2) + "  " +
            "IY: " + this._formatHex(this._z80.iyh, 2) + this._formatHex(this._z80.iyl, 2) + "\n" +
            "\n" +
            disassemble(this._z80, this._z80.pc, 5));
    }
    
    _formatHex(data: number, length: number) {
        var result = data.toString(16).toUpperCase();
        while (result.length < length) {
            result = "0" + result;
        }
            
        return result;
    }
}
