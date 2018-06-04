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

import { MicroBee } from './microbee'
import { Keyboard } from './keyboard'
import { CrtcMemory, BACKGROUND_COLOR_CSS, CHAR_WIDTH } from './crtcmemory'
import { BinaryReader, getBits, copyBits, listsMatch } from './utils';

const enum RegisterIndex {
    HTot = 0,
    HDisp = 1,
    HSyncPos = 2,
    SyncWidth = 3,
    VTot = 4,
    VTotAdj = 5,
    VDisp = 6,
    VSyncPos = 7,
    Mode = 8,
    Scanlines = 9,
    CursorStart = 10,
    CursorEnd = 11,
    DispStartH = 12,
    DispStartL = 13,
    CursorPosH = 14,
    CursorPosL = 15,
    LPenH = 16,
    LPenL = 17,
    SetAddrH = 18,
    SetAddrL = 19,
    
    DoSetAddr = 31,
    NumRegs = 32
}

const enum PortIndex {
    Address = 0,
    Status = 0,
    Data = 1,
    NumPorts = 2
}

const enum CursorMode {
    NoBlink = 0,
    NoCursor = 1,
    Blink16 = 2,
    Blink32 = 3
}

export class Crtc {
    _graphicsContext: CanvasRenderingContext2D;

    _selectedRegister: number = 0;

    _lpenValid: boolean = false;
    _lpen: number = 0;

    _emulationTime: number = 0;
    _lastFrameTime: number = 0;

    _frameTime: number = 0;
    _vblankTime: number = 0;

    _cursorPosition: number = 0;
    _cursorStart: number = 0;
    _cursorEnd: number = 0;
    _cursorMode: number = 0;
    _cursorOn = false;
    _blinkRate: number = 0;
    _frameCounter: number = 0;
    
    _displayStart: number = 0;
    _hTotal: number = 0;
    _hDisplayed: number = 0;
    _vTotal: number = 0;
    _vTotalAdjustment: number = 0;
    _vDisplayed: number = 0;
    _scansPerRow: number = 0;
    
    _memoryAddress: number = 0;
    
    _previousRenderState: number[] = [];  // Used to determine if any state has changed that should force a full render.
    _lastCursorPosition: number = 0;

    _microbee!: MicroBee;
    _keyboard!: Keyboard;
    _crtcMemory!: CrtcMemory;

    constructor(graphicsContext: CanvasRenderingContext2D) {
        this.reset();
        this._graphicsContext = graphicsContext;
    }

    reset() {
        this._selectedRegister = 0;

        this._lpenValid = false;
        this._lpen = 0;
        
        this._emulationTime = 0;
        this._lastFrameTime = 0;

        this._frameTime = 1;  // _frameTime is assumed != 0
        this._vblankTime = 0;
        
        this._cursorPosition = 0;
        this._cursorStart = 0;
        this._cursorEnd = 0;
        this._cursorMode = CursorMode.NoBlink;
        this._cursorOn = false;
        this._blinkRate = 0;
        this._frameCounter = 0;
        
        this._displayStart = 0;
        this._hTotal = 0;
        this._hDisplayed = 0;
        this._vTotal = 0;
        this._vTotalAdjustment = 0;
        this._vDisplayed = 0;
        this._scansPerRow = 0;
        
        this._memoryAddress = 0;
        
        this._previousRenderState = [];  // Used to determine if any state has changed that should force a full render.
        this._lastCursorPosition = 0;
    }
    
    restoreState(state: BinaryReader) {
        this._selectedRegister = state.readByte();
        
        this._memoryAddress = state.readWord();
        
        this._displayStart = state.readWord();
        
        this._hTotal = state.readWord();
        this._hDisplayed = state.readWord();
        this._vTotal = state.readWord();
        this._vTotalAdjustment = state.readWord();
        this._vDisplayed = state.readWord();
        this._scansPerRow = state.readWord();
        
        this._cursorStart = state.readWord();
        this._cursorEnd = state.readWord();
        this._cursorMode = state.readWord();
        this._cursorPosition = state.readWord();
        this._cursorOn = state.readBool();
        this._blinkRate = state.readWord();
        
        this._lpen = state.readWord();
        this._lpenValid = state.readBool();
        
        this._calculateVBlank();
    }
    
    getSize() {
        return PortIndex.NumPorts;
    }

    connect(microbee: MicroBee, keyboard: Keyboard, crtcMemory: CrtcMemory) {
        this._microbee = microbee;
        this._keyboard = keyboard;
        this._crtcMemory = crtcMemory;
    }
    
    read(address: number) {
        switch (address % PortIndex.NumPorts) {
        case PortIndex.Status:
            var STATUS_STROBE = 0x80;
            var STATUS_LPEN = 0x40;
            var STATUS_VBLANK = 0x20;

            var status = STATUS_STROBE;
            
            if (!this._lpenValid) {
                this._keyboard.checkAll();
            }
            
            if (this._lpenValid) {
                status |= STATUS_LPEN;
            }

            if (this._microbee.getTime() % this._frameTime < this._vblankTime) {
                status |= STATUS_VBLANK;
            }
            
            return status;
            
        case PortIndex.Data:
            switch (this._selectedRegister) {
            case RegisterIndex.CursorPosH:
                return getBits(this._cursorPosition, 8, 6);

            case RegisterIndex.CursorPosL:
                return getBits(this._cursorPosition, 0, 8);

            case RegisterIndex.LPenH:
                this._lpenValid = false;
                return getBits(this._lpen, 8, 6);

            case RegisterIndex.LPenL:
                this._lpenValid = false;
                return getBits(this._lpen, 0, 8);
            
            default:
                return 0xFF;
            }
            
        default:
            return 0xFF;
        }
    }
    
    write(address: number, value: number) {
        switch (address % PortIndex.NumPorts) {
        case PortIndex.Address:
            this._selectedRegister = value % RegisterIndex.NumRegs;
            break;
            
        case PortIndex.Data:
            switch (this._selectedRegister) {
            case RegisterIndex.HTot:
                 this._hTotal = value + 1;
                 this._calculateVBlank();
                 break;

             case RegisterIndex.HDisp:
                 this._hDisplayed = value;
                 break;

             case RegisterIndex.VTot:
                 this._vTotal = getBits(value, 0, 7) + 1;
                 this._calculateVBlank();
                 break;

             case RegisterIndex.VTotAdj:
                 this._vTotalAdjustment = getBits(value, 0, 5);
                 this._calculateVBlank();
                 break;

             case RegisterIndex.VDisp:
                 this._vDisplayed = getBits(value, 0, 7);
                 break;

             case RegisterIndex.Scanlines:
                 this._scansPerRow = getBits(value, 0, 5) + 1;
                 this._calculateVBlank();
                 break;

             case RegisterIndex.CursorStart:
                 var BLINK_MODE_OFFSET = 5;   
                 
                 this._cursorStart = getBits(value, 0, 5);
                 this._cursorMode = getBits(value, BLINK_MODE_OFFSET, 2);
                 
                 switch (this._cursorMode) {
                 case CursorMode.NoBlink:
                      this._cursorOn = true;
                      this._blinkRate = 0;
                      break; 

                 case CursorMode.NoCursor:
                      this._cursorOn = false;
                      this._blinkRate = 0;
                      break;

                 case CursorMode.Blink16:
                      this._blinkRate = 16;
                      break;

                 case CursorMode.Blink32:
                      this._blinkRate = 32;
                      break;
                 }
                 break;

             case RegisterIndex.CursorEnd:
                 this._cursorEnd = getBits(value, 0, 5);
                 break;

             case RegisterIndex.DispStartH:
                 this._displayStart = copyBits(this._displayStart, 8, 6, value);
                 break;

             case RegisterIndex.DispStartL:
                 this._displayStart = copyBits(this._displayStart, 0, 8, value);
                 break;

             case RegisterIndex.CursorPosH:
                 this._cursorPosition = copyBits(this._cursorPosition, 8, 6, value);
                 break;

             case RegisterIndex.CursorPosL:
                 this._cursorPosition = copyBits(this._cursorPosition, 0, 8, value);
                 break;

             case RegisterIndex.SetAddrH:
                 this._memoryAddress = copyBits(this._memoryAddress, 8, 6, value);
                 break;

             case RegisterIndex.SetAddrL:
                 this._memoryAddress = copyBits(this._memoryAddress, 0, 8, value);
                 break;

             case RegisterIndex.DoSetAddr:
                 this._keyboard.check(this._memoryAddress);
                 break;
            }
            break;
        }
    }
    
    execute(time: number, duration: number) {
        this._emulationTime = time + duration;  // Time to update up to.
        var delta = this._emulationTime - this._lastFrameTime;
        
        if (delta >= this._frameTime) {
            this._render();  // duration may be longer than one frame(?), so this could skip frames.
            
            this._frameCounter += Math.floor(delta / this._frameTime);  // FIXME: This probably drops frames as a result of ignoring the fraction, but it's only used for cursor blinking.
            this._lastFrameTime = this._emulationTime - delta % this._frameTime;  // The emulated time the frame really finished.
            
            if (this._blinkRate > 0 && this._frameCounter > this._blinkRate) {
                this._cursorOn = !this._cursorOn;  // TODO: Verify this.  Modified during porting because the old code didn't seem to make any sense (if condition would always be true?).
                this._frameCounter %= this._blinkRate;
            }
        }
        
        return this._lastFrameTime + this._frameTime - this._emulationTime;
    }
    
    triggerLpen(address: number) {
        if (this._lpenValid) {
            return;  // Already triggered, ignore new triggers until previous value is read.
        }
        
        this._lpenValid = true;
        this._lpen = address;
    }
    
    getDisplayStart() {
        return this._displayStart;
    }
    
    _calculateVBlank() {
        var CHAR_CLOCK_HZ = 1687500; 

        this._graphicsContext.canvas.width = this._hDisplayed * CHAR_WIDTH;
        this._graphicsContext.canvas.height = this._vDisplayed * this._scansPerRow;
        
        this._frameTime = this._hTotal * (this._vTotal * this._scansPerRow + this._vTotalAdjustment) * 1000000 / CHAR_CLOCK_HZ;
        this._vblankTime = this._hTotal * ((this._vTotal - this._vDisplayed) * this._scansPerRow + this._vTotalAdjustment) * 1000000 / CHAR_CLOCK_HZ;
        
        if (this._frameTime == 0) {
            this._frameTime = 1;  // _frameTime is assumed != 0
        }
    }
    
    _render() {
        var newRenderState = [this._displayStart, this._vDisplayed, this._hDisplayed, this._scansPerRow];
        var fullRenderRequired = false;
        if (!listsMatch(this._previousRenderState, newRenderState)) {
            fullRenderRequired = true;
            this._previousRenderState = newRenderState;
        }
        
        if (fullRenderRequired) {
            this._graphicsContext.fillStyle = BACKGROUND_COLOR_CSS;
            this._graphicsContext.fillRect(0, 0, this._graphicsContext.canvas.width, this._graphicsContext.canvas.height);
        }
    
        var address = this._displayStart;
        var x = 0;
        var y = 0;
        for (var row = 0; row < this._vDisplayed; ++row) {
            for (var column = 0; column < this._hDisplayed; ++column) {
                var cursor: [number, number]|null = null;
                if (this._cursorOn && address == this._cursorPosition) {
                    cursor = [this._cursorStart, this._cursorEnd];
                }
                
                if (fullRenderRequired || cursor != null || address == this._lastCursorPosition || this._crtcMemory.isDirty(address)) {
                    var characterImage = this._crtcMemory.getCharacterData(address, this._scansPerRow, cursor);
                    this._graphicsContext.putImageData(characterImage, x, y, 0, 0, CHAR_WIDTH, this._scansPerRow);
                }

                x += CHAR_WIDTH;
                var CRTC_ADDRESS_SIZE = 16384;
                address = (address + 1) % CRTC_ADDRESS_SIZE; 
            }
            
            y += this._scansPerRow;
            x = 0;
        }
        
        this._lastCursorPosition = this._cursorPosition;
        this._crtcMemory.clearDirtyStatus();
    }
}
