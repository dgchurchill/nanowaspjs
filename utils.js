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

var utils = {
    // Bit manipulation functions
        
    getBit: function (value, bit) {
        return (value >> bit) & 1;
    },
    
    getBits: function (value, start, count) {
        return (value >> start) % (1 << count);
    },
    
    clearBits: function (value, start, count) {
        return value & ~(((1 << count) - 1) << start);
    },
    
    copyBits: function (old, start, count, value) {
        return utils.clearBits(old, start, count) | (utils.getBits(value, 0, count) << start);
    },
    
    
    // Missing feature implementation
    
    /* Creates a function that calls func with this === target with no parameters. */
    bind0: (function () {}).bind == undefined
        ? function (func, target) { return function () { func.call(target); }; }
        : function (func, target) { return func.bind(target); },
                
    makeUint8Array: typeof(Uint8Array) == "undefined"
        ? function (size) { return new Array(size); }
        : function (size) { return new Uint8Array(size); },

        
    // Base64 decoder
        
    decodeBase64: function (s) {
        var encode = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var decode = {};
        for (var i = 0; i < encode.length; ++i) {
            decode[encode.charAt(i)] = i;
        }
        
        s = s.replace(/=/g, "");
        
        var len = (s.length / 4 | 0) * 3;
        if (s.length % 4 > 0) {
            len += s.length % 4 - 1;
        }
        var result = utils.makeUint8Array(len);
        
        var resultIndex = 0;
        for (var i = 0; i < s.length; i += 4) {
            var packet = s.substring(i, i + 4);
            
            var bytes = 3;
            switch (packet.length) {
            case 0:
            case 1:
                throw "Unexpected packet length";
                
            case 2:
                bytes = 1;
                break;
            
            case 3:
                bytes = 2;
                break;
            }
            
            while (packet.length < 4) {
                packet += "A";  // zero padding;
            }

            var bits = 0;
            for (var j = 0; j < packet.length; ++j)
            {
                var val = decode[packet[j]];
                if (val === undefined) {
                    throw "Unexpected character";
                }
                
                bits <<= 6;
                bits |= val;
            }
            
            var shift = 16;
            while (bytes > 0) {
                result[resultIndex++] = (bits >> shift) & 0xff;
                bytes--;
                shift -= 8;
            }
        }
        
        return result;
    }
};

utils.BinaryReader = function(array) {
    this._array = array;
    this._offset = 0;
};

utils.BinaryReader.prototype = {
    readByte: function () {
        var result = this._array[this._offset];
        this._offset++;
        return result;
    },
    
    readWord: function () {
        return this.readByte() | (this.readByte() << 8);
    },
    
    readBool: function () {
        return this.readByte() != 0;
    },
    
    readBuffer: function(length) {
        var buffer = utils.makeUint8Array(length);
        for (var i = 0; i < length; ++i) {
            buffer[i] = this.readByte();
        }
        
        return buffer;
    }
};

utils.MemoryStream = function(array) {
    this._array = array;
    this._offset = 0;
    this._checksum8 = 0;
};

utils.MemoryStream.prototype = {
    write: function (b) {
        this._array[this._offset++] = b;
        this._checksum8 = ((256 + b - this._checksum8) & 0xFF) ^ 0xFF;
    },
    
    clearChecksum8: function () {
        this._checksum8 = 0;
    },
    
    writeChecksum8: function () {
        this.write(this._checksum8);
        this.clearChecksum8();
    },
    
    read: function () {
        if (this._offset >= this._array.length) {
            return undefined;
        }
        
        return this._array[this._offset++];
    }
};
