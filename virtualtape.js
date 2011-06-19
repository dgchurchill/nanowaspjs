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

/*!
 *   Virtual tape support based on TAP file idea in uBee512. 
 */

var nanowasp = nanowasp || {};

nanowasp.VirtualTape = function (z80cpu, data) {
    this._z80cpu = z80cpu;
    this._data = data;
    this._offset = 0;
    this._readByte = utils.bind0(this._readByteBody, this);
};

nanowasp.VirtualTape.prototype = {
    LOCATION: 0xAB6D,
     
    reset: function () {
        this._offset = 0;
        this._z80cpu.setBreakpoint(this.LOCATION, this._readByte);
    },
    
    _readByteBody: function () {
        var value = 0;
        if (this._offset < this._data.length) {
            value = this._data[this._offset];
            this._offset++;
        }
        
        z80.a = value;
        z80_ret();
    }
};


