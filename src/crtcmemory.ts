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
import { getBit, getBits, DataBlock, BinaryReader } from './utils'

interface CharacterImageCache {
    [character: number]: ImageData;
}

export const CHAR_WIDTH = 8;
export const BACKGROUND_COLOR_CSS = "rgba(0; 0, 0, 0)";

const GRAPHICS_MEMORY_SIZE = 4096;
const VIDEO_RAM_SIZE = 2048;
const PCG_RAM_SIZE = 2048;
const BIT_MA13 = 13;
const MAX_CHAR_HEIGHT = 16;
const FOREGROUND_COLOR = [247, 211, 49, 220];
const BACKGROUND_COLOR = [0, 0, 0, 0];
const BIT_PCG = 7;
const INDEX_START = 0;
const INDEX_COUNT = 7;

export class CrtcMemory {
    _charRom: Rom;
    _pcgRam: Ram;
    _videoRam: Ram;

    _graphicsContext: CanvasRenderingContext2D;
    
    _pcgImages: CharacterImageCache;
    _charRomImages: CharacterImageCache;

    _crtc!: Crtc;
    _latchRom!: LatchRom;

    _dirtyVideoRam: { [address: number] : boolean };
    _dirtyPcgImages: { [address: number] : boolean };

    constructor(charRomData: DataBlock, graphicsContext: CanvasRenderingContext2D) {
        this._charRom = new Rom(charRomData);
        this._pcgRam = new Ram(PCG_RAM_SIZE);
        this._videoRam = new Ram(VIDEO_RAM_SIZE);

        this._graphicsContext = graphicsContext;
        
        this._pcgImages = {};
        this._charRomImages = {};
        this._buildAllCharacters(this._charRomImages, this._charRom);
        
        this._dirtyVideoRam = {};
        this._dirtyPcgImages = {};
        this.clearDirtyStatus();
    }

    reset() {
        this._charRom.reset();
        this._pcgRam.reset();
        this._videoRam.reset();
    }
    
    restoreState(state: BinaryReader) {
        this._videoRam.restoreState(state);
        this._pcgRam.restoreState(state);
        this._buildAllCharacters(this._pcgImages, this._pcgRam);
    }
    
    connect(crtc: Crtc, latchRom: LatchRom) {
        this._crtc = crtc;
        this._latchRom = latchRom;
    }
    
    getSize() {
        return GRAPHICS_MEMORY_SIZE;
    }
    
    read(address: number) {
        if (address < VIDEO_RAM_SIZE) {
            if (this._latchRom.isLatched()) {
                var baseAddress = getBit(this._crtc.getDisplayStart(), BIT_MA13) * VIDEO_RAM_SIZE;
                return this._charRom.read(baseAddress + address);
            } else {
                return this._videoRam.read(address);
            }
        } else {
            return this._pcgRam.read((address - VIDEO_RAM_SIZE) % PCG_RAM_SIZE);
        }
    }
    
    write(address: number, value: number) {
        if (address < VIDEO_RAM_SIZE) {
            if (!this._latchRom.isLatched()) {
                this._videoRam.write(address, value);
                this._dirtyVideoRam[address] = true;  // Assume the new value is different.
            }
        }
        else {
            var pcgAddress = (address - VIDEO_RAM_SIZE) % PCG_RAM_SIZE;
            this._pcgRam.write(pcgAddress, value);
            var character = pcgAddress / MAX_CHAR_HEIGHT | 0;
            var row = pcgAddress % MAX_CHAR_HEIGHT;
            this._pcgImages[character] = this._buildCharacterRow(this._pcgImages[character], value, row);
            this._dirtyPcgImages[character] = true;
        }
    }
  
    /* Determines whether the character data for the given address has changed since the last render.
     * 
     * The character data is dirty if the character in video memory or its corresponding bitmap data has changed.
     */
    isDirty(crtcAddress: number) {
        var videoAddress = crtcAddress % VIDEO_RAM_SIZE;
        if (videoAddress in this._dirtyVideoRam) {
            return true;
        }
        
        var b = this._videoRam.read(crtcAddress % VIDEO_RAM_SIZE);
        var isPcg = getBit(b, BIT_PCG) == 1;
        if (!isPcg) {
            return false;  // ROM-based bitmaps cannot change.
        }
        
        var character = getBits(b, INDEX_START, INDEX_COUNT);
        return character in this._dirtyPcgImages;
    }
    
    clearDirtyStatus() {
        this._dirtyVideoRam = {};
        this._dirtyPcgImages = {};
    }
    
    getCharacterData(crtcAddress: number, scansPerRow: number, cursor: [number, number]|null) {
        var b = this._videoRam.read(crtcAddress % VIDEO_RAM_SIZE);
        var character = getBits(b, INDEX_START, INDEX_COUNT);
        var isPcg = getBit(b, BIT_PCG) == 1;
        
        if (!isPcg) {
            // Select character ROM bank
            character += getBit(crtcAddress, BIT_MA13) * VIDEO_RAM_SIZE / MAX_CHAR_HEIGHT;
        }
        
        if (cursor == null) {
            var imageCache = isPcg ? this._pcgImages : this._charRomImages;
            return imageCache[character];
        } else {
            var memory = isPcg ? this._pcgRam : this._charRom;
            return this._buildCharacter(null, memory, character * MAX_CHAR_HEIGHT, cursor);
        }
    }
    
    _buildAllCharacters(cache: CharacterImageCache, memory: Rom) {
        for (var i = 0; i < memory.getSize() / MAX_CHAR_HEIGHT; ++i) {
            cache[i] = this._buildCharacter(cache[i], memory, i * MAX_CHAR_HEIGHT, null);
        }
    }
    
    _buildCharacter(image: ImageData|null, memory: Rom, offset: number, cursor: [number, number]|null): ImageData {
        for (var i = 0; i < MAX_CHAR_HEIGHT; ++i) {
            var data = memory.read(offset + i);
            
            if (cursor != null && i >= cursor[0] && i <= cursor[1]) {
                data ^= 0xff;
            }
            
            image = this._buildCharacterRow(image, data, i);
        }
        
        return image!;
    }
    
    _buildCharacterRow(image: ImageData|null, data: number, row: number): ImageData {
        if (image == null) {
            image = this._graphicsContext.createImageData(CHAR_WIDTH, MAX_CHAR_HEIGHT);
        }
        
        var imageOffset = row * CHAR_WIDTH * 4;
        for (var i = CHAR_WIDTH - 1; i >= 0; --i) {
            var color = ((data & (1 << i)) != 0) ? FOREGROUND_COLOR : BACKGROUND_COLOR;
            for (var j = 0; j < color.length; ++j) {
                image.data[imageOffset++] = color[j];
            }
        }
        
        return image;
    }
}
