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
    
    
    // Basic DOM stuff
    addHtmlClass: function (elementId, className) {
        var element = document.getElementById(elementId);
        var classes = element.className.split(/\s+/);
        for (var i = 0; i < classes.length; ++i) {
            if (classes[i] == className) {
                return;
            }
        }
        classes.push(className);
        element.className = classes.join(" ");
    },
    
    removeHtmlClass: function (elementId, className) {
        var element = document.getElementById(elementId);
        var classes = element.className.split(/\s+/);
        var newClasses = [];
        for (var i = 0; i < classes.length; ++i) {
            if (classes[i] != className) {
                newClasses.push(classes[i]);
            }
        }
        element.className = newClasses.join(" ");
    },
    
    // Removes the 'className' class from 'elementId' if it currently contains it and vice-versa.
    // Returns true if the class is now enabled or false otherwise.
    toggleHtmlClass: function (elementId, className) {
        var element = document.getElementById(elementId);
        var classes = element.className.split(/\s+/);
        var newClasses = [];
        var wasActive = false;
        for (var i = 0; i < classes.length; ++i) {
            if (classes[i] != className) {
                newClasses.push(classes[i]);
            } else {
                wasActive = true;
            }
        }
        if (!wasActive) {
            newClasses.push(className);
        }
        element.className = newClasses.join(" ");
        
        return !wasActive;
    },
    
    // Missing feature implementation
    
    bind: (function () {}).bind == undefined
        ? function (func, target) { return function () { func.apply(target, arguments); }; }
        : function (func, target) { return func.bind(target); },
                
    makeUint8Array: typeof(Uint8Array) == "undefined"
        ? function (size) { var arr = new Array(size); for (var i = 0; i < size; ++i) arr[i] = 0; return arr; }
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
    },
    
    listsMatch: function (l1, l2) {
        if (l1.length != l2.length) {
            return false;
        }
        
        for (var i = 0; i < l1.length; ++i) {
            if (l1[i] != l2[i]) {
                return false;
            }
        }
        
        return true;
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
