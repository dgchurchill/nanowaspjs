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

var nanowasp = nanowasp || {};

nanowasp.CrtcMemory = function (charRomData, graphicsContext) {
    this._charRom = new nanowasp.Rom(charRomData);
    this._pcgRam = new nanowasp.Ram(this.PCG_RAM_SIZE);
    this._videoRam = new nanowasp.Ram(this.VIDEO_RAM_SIZE);

    this._graphicsContext = graphicsContext;
    
    this._pcgImages = {};
    this._charRomImages = {};
    this._buildAllCharacters(this._charRomImages, this._charRom);
};

nanowasp.CrtcMemory.prototype = {
    GRAPHICS_MEMORY_SIZE: 4096,
    VIDEO_RAM_SIZE: 2048,
    PCG_RAM_SIZE: 2048,
    BIT_MA13: 13,
    CHAR_WIDTH: 8,
    MAX_CHAR_HEIGHT: 16,
    FOREGROUND_COLOR: [247, 211, 49, 220],
    BACKGROUND_COLOR: [0, 0, 0, 0],
    BACKGROUND_COLOR_CSS: "rgba(0, 0, 0, 0)",

    reset: function () {
        this._charRom.reset();
        this._pcgRam.reset();
        this._videoRam.reset();
    },
    
    restoreState: function (state) {
        this._videoRam.restoreState(state);
        this._pcgRam.restoreState(state);
        this._buildAllCharacters(this._pcgImages, this._pcgRam);
    },
    
    connect: function (crtc, latchRom) {
        this._crtc = crtc;
        this._latchRom = latchRom;
    },
    
    getSize: function () {
        return this.GRAPHICS_MEMORY_SIZE;
    },
    
    read: function (address) {
        if (address < this.VIDEO_RAM_SIZE) {
            if (this._latchRom.isLatched()) {
                var baseAddress = utils.getBit(this._crtc.getDisplayStart(), this.BIT_MA13) * this.VIDEO_RAM_SIZE;
                return this._charRom.read(baseAddress + address);
            } else {
                return this._videoRam.read(address);
            }
        } else {
            return this._pcgRam.read((address - this.VIDEO_RAM_SIZE) % this.PCG_RAM_SIZE);
        }
    },
    
    write: function (address, value) {
        if (address < this.VIDEO_RAM_SIZE) {
            if (!this._latchRom.isLatched()) {
                this._videoRam.write(address, value);
            }
        }
        else {
            var pcgAddress = (address - this.VIDEO_RAM_SIZE) % this.PCG_RAM_SIZE;
            this._pcgRam.write(pcgAddress, value);
            var character = pcgAddress / this.MAX_CHAR_HEIGHT | 0;
            var row = pcgAddress % this.MAX_CHAR_HEIGHT;
            this._pcgImages[character] = this._buildCharacterRow(this._pcgImages[character], value, row);
        }
    },
   
    getCharacterData: function (crtcAddress, scansPerRow, cursor) {
        var BIT_PCG = 7;
        var INDEX_START = 0;
        var INDEX_COUNT = 7;
        
        var b = this._videoRam.read(crtcAddress % this.VIDEO_RAM_SIZE);
        var character = utils.getBits(b, INDEX_START, INDEX_COUNT);
        var isPcg = utils.getBit(b, BIT_PCG) == 1;
        
        if (!isPcg) {
            // Select character ROM bank
            character += utils.getBit(crtcAddress, this.BIT_MA13) * this.VIDEO_RAM_SIZE / this.MAX_CHAR_HEIGHT;
        }
        
        if (cursor == null || cursor == undefined) {
            var imageCache = isPcg ? this._pcgImages : this._charRomImages;
            return imageCache[character];
        } else {
            var memory = isPcg ? this._pcgRam : this._charRom;
            return this._buildCharacter(null, memory, character * this.MAX_CHAR_HEIGHT, cursor);
        }
    },
    
    _buildAllCharacters: function (cache, memory) {
        for (var i = 0; i < memory.getSize() / this.MAX_CHAR_HEIGHT; ++i) {
            cache[i] = this._buildCharacter(cache[i], memory, i * this.MAX_CHAR_HEIGHT);
        }
    },
    
    _buildCharacter: function (image, memory, offset, cursor) {
        var haveCursor = cursor != null && cursor != undefined;
        
        for (var i = 0; i < this.MAX_CHAR_HEIGHT; ++i) {
            var data = memory.read(offset + i);
            
            if (haveCursor && i >= cursor[0] && i <= cursor[1]) {
                data ^= 0xff;
            }
            
            image = this._buildCharacterRow(image, data, i);
        }
        
        return image;
    },
    
    _buildCharacterRow: function (image, data, row) {
        if (image == null || image == undefined) {
            image = this._graphicsContext.createImageData(this.CHAR_WIDTH, this.MAX_CHAR_HEIGHT);
        }
        
        var imageOffset = row * this.CHAR_WIDTH * 4;
        for (var i = this.CHAR_WIDTH - 1; i >= 0; --i) {
            var color = ((data & (1 << i)) != 0) ? this.FOREGROUND_COLOR : this.BACKGROUND_COLOR;
            for (var j = 0; j < color.length; ++j) {
                image.data[imageOffset++] = color[j];
            }
        }
        
        return image;
    }
};
