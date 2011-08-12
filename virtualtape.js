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

nanowasp.VirtualTape = function (z80cpu) {
    this._z80cpu = z80cpu;
    this._data = [];
    this._offset = 0;
    this._readByte = utils.bind0(this._readByteBody, this);
};

nanowasp.VirtualTape.prototype = {
    LOCATION: 0xAB6D,
     
    reset: function () {
        this._offset = 0;
        this._z80cpu.setBreakpoint(this.LOCATION, this._readByte);
    },
    
    loadMwb: function (name, data) {
        var extra = 0x47;  // temporary, for frank.mwb
        this.loadTape(name, data, 'B', 0x08C0, 0x0000, false, extra);
    },
    
    loadMac: function (name, data) {
        this.loadTape(name, data, 'M', 0x0900, 0x0900, true, 0x00);
    },
    
    loadTape: function (name, data, typeCode, startAddress, autoStartAddress, isAutoStart, extra) {
        var headerLength = 40 + 1 + 16 + 1;
        var blockSize = 256;
        var fullBlockCount = Math.floor(data.length / blockSize);
        var finalBlockSize = data.length % blockSize;
        var dataLength = fullBlockCount * (blockSize + 1);
        if (finalBlockSize > 0) {
            dataLength += finalBlockSize + 1;
        }

        this._offset = 0;
        this._data = utils.makeUint8Array(headerLength + dataLength);
        var stream = new utils.MemoryStream(this._data);
        
        // lead-in
        for (var i = 0; i < 40; ++i) {
            stream.write(0);
        }
        
        // header indicator
        stream.write(1);
        
        // header
        stream.clearChecksum8();
        
        for (var i = 0; i < 6; ++i) {
            if (i < name.length) {
                stream.write(name.charCodeAt(i));
            } else {
                stream.write(' '.charCodeAt(0));
            }
        }
        
        stream.write(typeCode.charCodeAt(0));
        
        stream.write(data.length & 0xFF);  // TODO: Make robust to lengths > 64k (really want a binary writer that writes words).
        stream.write(data.length >> 8);
        
        stream.write(startAddress & 0xFF);
        stream.write(startAddress >> 8);
        
        stream.write(autoStartAddress & 0xFF);
        stream.write(autoStartAddress >> 8);
        
        stream.write(0x00); // baud flag
        
        if (isAutoStart) {
            stream.write(0xFF);
        } else {
            stream.write(0x00);
        }
        
        stream.write(extra);
        
        stream.writeChecksum8();
        
        // data
        var dataStream = new utils.MemoryStream(data);
        for (var i = 0; i < fullBlockCount; ++i) {
            for (var j = 0; j < blockSize; ++j) {
                stream.write(dataStream.read());
            }
            stream.writeChecksum8();
        }
        
        if (finalBlockSize > 0) {
            for (var j = 0; j < finalBlockSize; ++j) {
                stream.write(dataStream.read());
            }
            stream.writeChecksum8();
        }
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


