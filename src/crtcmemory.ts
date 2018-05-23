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

import { Rom, Ram } from './memory'
import { Crtc } from './crtc'
import { LatchRom } from './latchrom'
import { getBit, getBits } from './utils'

export class CrtcMemory {
    _charRom: Rom;
    _pcgRam: Ram;
    _videoRam: Ram;

    _graphicsContext: CanvasRenderingContext2D;
    
    _pcgImages: { [character: number]: ImageData };
    _charRomImages: { [character: number]: ImageData };

    _crtc: Crtc;
    _latchRom: LatchRom;

    _dirtyVideoRam: { [address: number] : boolean };
    _dirtyPcgImages: { [address: number] : boolean };

    constructor(charRomData, graphicsContext) {
        this._charRom = new Rom(charRomData);
        this._pcgRam = new Ram(CrtcMemory.PCG_RAM_SIZE);
        this._videoRam = new Ram(CrtcMemory.VIDEO_RAM_SIZE);

        this._graphicsContext = graphicsContext;
        
        this._pcgImages = {};
        this._charRomImages = {};
        this._buildAllCharacters(this._charRomImages, this._charRom);
        
        this.clearDirtyStatus();
    }

    static GRAPHICS_MEMORY_SIZE = 4096;
    static VIDEO_RAM_SIZE = 2048;
    static PCG_RAM_SIZE = 2048;
    static BIT_MA13 = 13;
    static CHAR_WIDTH = 8;
    static MAX_CHAR_HEIGHT = 16;
    static FOREGROUND_COLOR = [247, 211, 49, 220];
    static BACKGROUND_COLOR = [0, 0, 0, 0];
    static BACKGROUND_COLOR_CSS = "rgba(0; 0, 0, 0)";
    static BIT_PCG = 7;
    static INDEX_START = 0;
    static INDEX_COUNT = 7;


    reset() {
        this._charRom.reset();
        this._pcgRam.reset();
        this._videoRam.reset();
    }
    
    restoreState(state) {
        this._videoRam.restoreState(state);
        this._pcgRam.restoreState(state);
        this._buildAllCharacters(this._pcgImages, this._pcgRam);
    }
    
    connect(crtc, latchRom) {
        this._crtc = crtc;
        this._latchRom = latchRom;
    }
    
    getSize() {
        return CrtcMemory.GRAPHICS_MEMORY_SIZE;
    }
    
    read(address) {
        if (address < CrtcMemory.VIDEO_RAM_SIZE) {
            if (this._latchRom.isLatched()) {
                var baseAddress = getBit(this._crtc.getDisplayStart(), CrtcMemory.BIT_MA13) * CrtcMemory.VIDEO_RAM_SIZE;
                return this._charRom.read(baseAddress + address);
            } else {
                return this._videoRam.read(address);
            }
        } else {
            return this._pcgRam.read((address - CrtcMemory.VIDEO_RAM_SIZE) % CrtcMemory.PCG_RAM_SIZE);
        }
    }
    
    write(address, value) {
        if (address < CrtcMemory.VIDEO_RAM_SIZE) {
            if (!this._latchRom.isLatched()) {
                this._videoRam.write(address, value);
                this._dirtyVideoRam[address] = true;  // Assume the new value is different.
            }
        }
        else {
            var pcgAddress = (address - CrtcMemory.VIDEO_RAM_SIZE) % CrtcMemory.PCG_RAM_SIZE;
            this._pcgRam.write(pcgAddress, value);
            var character = pcgAddress / CrtcMemory.MAX_CHAR_HEIGHT | 0;
            var row = pcgAddress % CrtcMemory.MAX_CHAR_HEIGHT;
            this._pcgImages[character] = this._buildCharacterRow(this._pcgImages[character], value, row);
            this._dirtyPcgImages[character] = true;
        }
    }
  
    /* Determines whether the character data for the given address has changed since the last render.
     * 
     * The character data is dirty if the character in video memory or its corresponding bitmap data has changed.
     */
    isDirty(crtcAddress) {
        var videoAddress = crtcAddress % CrtcMemory.VIDEO_RAM_SIZE;
        if (videoAddress in this._dirtyVideoRam) {
            return true;
        }
        
        var b = this._videoRam.read(crtcAddress % CrtcMemory.VIDEO_RAM_SIZE);
        var isPcg = getBit(b, CrtcMemory.BIT_PCG) == 1;
        if (!isPcg) {
            return false;  // ROM-based bitmaps cannot change.
        }
        
        var character = getBits(b, CrtcMemory.INDEX_START, CrtcMemory.INDEX_COUNT);
        return character in this._dirtyPcgImages;
    }
    
    clearDirtyStatus() {
        this._dirtyVideoRam = {};
        this._dirtyPcgImages = {};
    }
    
    getCharacterData(crtcAddress, scansPerRow, cursor) {
        var b = this._videoRam.read(crtcAddress % CrtcMemory.VIDEO_RAM_SIZE);
        var character = getBits(b, CrtcMemory.INDEX_START, CrtcMemory.INDEX_COUNT);
        var isPcg = getBit(b, CrtcMemory.BIT_PCG) == 1;
        
        if (!isPcg) {
            // Select character ROM bank
            character += getBit(crtcAddress, CrtcMemory.BIT_MA13) * CrtcMemory.VIDEO_RAM_SIZE / CrtcMemory.MAX_CHAR_HEIGHT;
        }
        
        if (cursor == null || cursor == undefined) {
            var imageCache = isPcg ? this._pcgImages : this._charRomImages;
            return imageCache[character];
        } else {
            var memory = isPcg ? this._pcgRam : this._charRom;
            return this._buildCharacter(null, memory, character * CrtcMemory.MAX_CHAR_HEIGHT, cursor);
        }
    }
    
    _buildAllCharacters(cache, memory) {
        for (var i = 0; i < memory.getSize() / CrtcMemory.MAX_CHAR_HEIGHT; ++i) {
            cache[i] = this._buildCharacter(cache[i], memory, i * CrtcMemory.MAX_CHAR_HEIGHT);
        }
    }
    
    _buildCharacter(image, memory, offset, cursor?) {
        var haveCursor = cursor != null && cursor != undefined;
        
        for (var i = 0; i < CrtcMemory.MAX_CHAR_HEIGHT; ++i) {
            var data = memory.read(offset + i);
            
            if (haveCursor && i >= cursor[0] && i <= cursor[1]) {
                data ^= 0xff;
            }
            
            image = this._buildCharacterRow(image, data, i);
        }
        
        return image;
    }
    
    _buildCharacterRow(image: ImageData, data: number, row: number): ImageData {
        if (image == null || image == undefined) {
            image = this._graphicsContext.createImageData(CrtcMemory.CHAR_WIDTH, CrtcMemory.MAX_CHAR_HEIGHT);
        }
        
        var imageOffset = row * CrtcMemory.CHAR_WIDTH * 4;
        for (var i = CrtcMemory.CHAR_WIDTH - 1; i >= 0; --i) {
            var color = ((data & (1 << i)) != 0) ? CrtcMemory.FOREGROUND_COLOR : CrtcMemory.BACKGROUND_COLOR;
            for (var j = 0; j < color.length; ++j) {
                image.data[imageOffset++] = color[j];
            }
        }
        
        return image;
    }
}
