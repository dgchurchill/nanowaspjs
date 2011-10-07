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

nanowasp.VirtualTape = function (name, data, typeCode, startAddress, autoStartAddress, isAutoStart, extra) {
    if (data.length > 0xFFFF) {
        throw {
            name: "ArgumentError",
            message: "'data' must be less than 64k in size."
        };
    }
    
    this.name = name;
    this.data = data;
    this.typeCode = typeCode;
    this.startAddress = startAddress;
    this.autoStartAddress = autoStartAddress;
    this.isAutoStart = isAutoStart;
    this.extra = extra;
};

nanowasp.VirtualTape.createAutoTape = function (name, data) {
    var tapeTypes = {
        default_: ['B', 0x08C0, 0x0000, false, 0x47],  // 0x47 extra byte temporary set here, for frank.mwb
        bee: ['M', 0x0900, 0x0900, true, 0x00],
        bin: ['M', 0x0900, 0x0900, true, 0x00],
        z80: ['M', 0x0900, 0x0900, true, 0x00],
        com: ['M', 0x0100, 0x0100, true, 0x00],
        asm: ['S', 0x1000, 0x0000, false, 0x00],
        edt: ['S', 0x1000, 0x0000, false, 0x00],
        mac: ['S', 0x1000, 0x0000, false, 0x00],
        pas: ['S', 0x1000, 0x0000, false, 0x00],
        txt: ['S', 0x1000, 0x0000, false, 0x00],
        wbf: ['W', 0x0900, 0x0000, false, 0x00]
    };
    
    var tapeParameters = tapeTypes.default_;
    
    var match = name.match(/\.(...)$/);
    if (match != null) {
        var extension = match[1].toLowerCase();
        if (extension in tapeTypes) {
            tapeParameters = tapeTypes[extension];
        }
    }
    
    var p = tapeParameters;
    return new nanowasp.VirtualTape(name, data, p[0], p[1], p[2], p[3], p[4]);
};

nanowasp.VirtualTape.prototype = {
    // Returns a byte array containing the data as it would be stored on tape (i.e. including tape header and checksummed blocks).
    getFormattedData: function () {
        var headerLength = 40 + 1 + 16 + 1;
        var blockSize = 256;
        var fullBlockCount = Math.floor(this.data.length / blockSize);
        var finalBlockSize = this.data.length % blockSize;
        var dataLength = fullBlockCount * (blockSize + 1);
        if (finalBlockSize > 0) {
            dataLength += finalBlockSize + 1;
        }

        var formattedData = utils.makeUint8Array(headerLength + dataLength);
        var stream = new utils.MemoryStream(formattedData);
        
        // lead-in
        for (var i = 0; i < 40; ++i) {
            stream.write(0);
        }
        
        // header indicator
        stream.write(1);
        
        // header
        stream.clearChecksum8();
        
        for (var i = 0; i < 6; ++i) {
            if (i < this.name.length) {
                stream.write(this.name.charCodeAt(i));
            } else {
                stream.write(' '.charCodeAt(0));
            }
        }
        
        stream.write(this.typeCode.charCodeAt(0));
        
        stream.write(this.data.length & 0xFF);  // TODO: Add a stream write function that writes shorts.
        stream.write(this.data.length >> 8);
        
        stream.write(this.startAddress & 0xFF);
        stream.write(this.startAddress >> 8);
        
        stream.write(this.autoStartAddress & 0xFF);
        stream.write(this.autoStartAddress >> 8);
        
        stream.write(0x00); // baud flag
        
        if (this.isAutoStart) {
            stream.write(0xFF);
        } else {
            stream.write(0x00);
        }
        
        stream.write(this.extra);
        
        stream.writeChecksum8();
        
        // data
        var dataStream = new utils.MemoryStream(this.data);
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
        
        return formattedData;
    }
};


