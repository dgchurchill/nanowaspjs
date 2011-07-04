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

nanowasp.Crtc = function (graphicsContext) {
    this.reset();
    this._graphicsContext = graphicsContext;
};

nanowasp.Crtc.prototype = {
    reset: function () {
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
        this._cursorMode = this.CursorMode.NoBlink;
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
    },
    
    restoreState: function (state) {
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
    },
    
    getSize: function () {
        return this.PortIndex.NumPorts;
    },

    connect: function (microbee, keyboard, crtcMemory) {
        this._microbee = microbee;
        this._keyboard = keyboard;
        this._crtcMemory = crtcMemory;
    },
    
    read: function (address) {
        switch (address % this.PortIndex.NumPorts) {
        case this.PortIndex.Status:
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
            
        case this.PortIndex.Data:
            switch (this._selectedRegister) {
            case this.RegisterIndex.CursorPosH:
                return utils.getBits(this._cursorPosition, 8, 6);

            case this.RegisterIndex.CursorPosL:
                return utils.getBits(this._cursorPosition, 0, 8);

            case this.RegisterIndex.LPenH:
                this._lpenValid = false;
                return utils.getBits(this._lpen, 8, 6);

            case this.RegisterIndex.LPenL:
                this._lpenValid = false;
                return utils.getBits(this._lpen, 0, 8);
            
            default:
                return 0xFF;
            }
            
        default:
            return 0xFF;
        }
    },
    
    write: function (address, value) {
        switch (address % this.PortIndex.NumPorts) {
        case this.PortIndex.Address:
            this._selectedRegister = value % this.RegisterIndex.NumRegs;
            break;
            
        case this.PortIndex.Data:
            switch (this._selectedRegister) {
            case this.RegisterIndex.HTot:
                 this._hTotal = value + 1;
                 this._calculateVBlank();
                 break;

             case this.RegisterIndex.HDisp:
                 this._hDisplayed = value;
                 break;

             case this.RegisterIndex.VTot:
                 this._vTotal = utils.getBits(value, 0, 7) + 1;
                 this._calculateVBlank();
                 break;

             case this.RegisterIndex.VTotAdj:
                 this._vTotalAdjustment = utils.getBits(value, 0, 5);
                 this._calculateVBlank();
                 break;

             case this.RegisterIndex.VDisp:
                 this._vDisplayed = utils.getBits(value, 0, 7);
                 break;

             case this.RegisterIndex.Scanlines:
                 this._scansPerRow = utils.getBits(value, 0, 5) + 1;
                 this._calculateVBlank();
                 break;

             case this.RegisterIndex.CursorStart:
                 var BLINK_MODE_OFFSET = 5;   
                 
                 this._cursorStart = utils.getBits(value, 0, 5);
                 this._cursorMode = utils.getBits(value, BLINK_MODE_OFFSET, 2);
                 
                 switch (this._cursorMode) {
                 case this.CursorMode.NoBlink:
                      this._cursorOn = true;
                      this._blinkRate = 0;
                      break; 

                 case this.CursorMode.NoCursor:
                      this._cursorOn = false;
                      this._blinkRate = 0;
                      break;

                 case this.CursorMode.Blink16:
                      this._blinkRate = 16;
                      break;

                 case this.CursorMode.Blink32:
                      this._blinkRate = 32;
                      break;
                 }
                 break;

             case this.RegisterIndex.CursorEnd:
                 this._cursorEnd = utils.getBits(value, 0, 5);
                 break;

             case this.RegisterIndex.DispStartH:
                 this._displayStart = utils.copyBits(this._displayStart, 8, 6, value);
                 break;

             case this.RegisterIndex.DispStartL:
                 this._displayStart = utils.copyBits(this._displayStart, 0, 8, value);
                 break;

             case this.RegisterIndex.CursorPosH:
                 this._cursorPosition = utils.copyBits(this._cursorPosition, 8, 6, value);
                 break;

             case this.RegisterIndex.CursorPosL:
                 this._cursorPosition = utils.copyBits(this._cursorPosition, 0, 8, value);
                 break;

             case this.RegisterIndex.SetAddrH:
                 this._memoryAddress = utils.copyBits(this._memoryAddress, 8, 6, value);
                 break;

             case this.RegisterIndex.SetAddrL:
                 this._memoryAddress = utils.copyBits(this._memoryAddress, 0, 8, value);
                 break;

             case this.RegisterIndex.DoSetAddr:
                 this._keyboard.check(this._memoryAddress);
                 break;
            }
            break;
        }
    },
    
    execute: function (time, duration) {
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
    },
    
    triggerLpen: function (address) {
        if (this._lpenValid) {
            return;  // Already triggered, ignore new triggers until previous value is read.
        }
        
        this._lpenValid = true;
        this._lpen = address;
    },
    
    getDisplayStart: function () {
        return this._displayStart;
    },
    
    _calculateVBlank: function () {
        var CHAR_CLOCK_HZ = 1687500; 

        this._graphicsContext.canvas.width = this._hDisplayed * nanowasp.CrtcMemory.prototype.CHAR_WIDTH;
        this._graphicsContext.canvas.height = this._vDisplayed * this._scansPerRow;
        
        this._frameTime = this._hTotal * (this._vTotal * this._scansPerRow + this._vTotalAdjustment) * 1000000 / CHAR_CLOCK_HZ;
        this._vblankTime = this._hTotal * ((this._vTotal - this._vDisplayed) * this._scansPerRow + this._vTotalAdjustment) * 1000000 / CHAR_CLOCK_HZ;
        
        if (this._frameTime == 0) {
            this._frameTime = 1;  // _frameTime is assumed != 0
        }
    },
    
    _render: function () {
        var newRenderState = [this._displayStart, this._vDisplayed, this._hDisplayed, this._scansPerRow];
        var fullRenderRequired = false;
        if (!utils.listsMatch(this._previousRenderState, newRenderState)) {
            fullRenderRequired = true;
            this._previousRenderState = newRenderState;
        }
        
        if (fullRenderRequired) {
            this._graphicsContext.fillStyle = nanowasp.CrtcMemory.prototype.BACKGROUND_COLOR_CSS;
            this._graphicsContext.fillRect(0, 0, this._graphicsContext.canvas.width, this._graphicsContext.canvas.height);
        }
    
        var address = this._displayStart;
        var x = 0;
        var y = 0;
        for (var row = 0; row < this._vDisplayed; ++row) {
            for (var column = 0; column < this._hDisplayed; ++column) {
                var cursor = null;
                if (this._cursorOn && address == this._cursorPosition) {
                    cursor = [this._cursorStart, this._cursorEnd];
                }
                
                if (fullRenderRequired || cursor != null || address == this._lastCursorPosition || this._crtcMemory.isDirty(address)) {
                    var characterImage = this._crtcMemory.getCharacterData(address, this._scansPerRow, cursor);
                    this._graphicsContext.putImageData(characterImage, x, y, 0, 0, nanowasp.CrtcMemory.prototype.CHAR_WIDTH, this._scansPerRow);
                }

                x += nanowasp.CrtcMemory.prototype.CHAR_WIDTH;
                var CRTC_ADDRESS_SIZE = 16384;
                address = (address + 1) % CRTC_ADDRESS_SIZE; 
            }
            
            y += this._scansPerRow;
            x = 0;
        }
        
        this._lastCursorPosition = this._cursorPosition;
        this._crtcMemory.clearDirtyStatus();
    },

    RegisterIndex: {
        HTot:        0,
        HDisp:       1,
        HSyncPos:    2,
        SyncWidth:   3,
        VTot:        4,
        VTotAdj:     5,
        VDisp:       6,
        VSyncPos:    7,
        Mode:        8,
        Scanlines:   9,
        CursorStart: 10,
        CursorEnd:   11,
        DispStartH:  12,
        DispStartL:  13,
        CursorPosH:  14,
        CursorPosL:  15,
        LPenH:       16,
        LPenL:       17,
        SetAddrH:    18,
        SetAddrL:    19,
        
        DoSetAddr:   31,
        NumRegs:     32
    },
    
    PortIndex: {
        Address:  0,
        Status:   0,
        Data:     1,
        NumPorts: 2
    },
    
    CursorMode: {
        NoBlink:  0,
        NoCursor: 1,
        Blink16:  2,
        Blink32:  3
    }
};

if (Object.freeze != undefined) {
    var p = nanowasp.Crtc.prototype;
    Object.freeze(p.RegisterIndex);
    Object.freeze(p.PortIndex);
    Object.freeze(p.CursorMode);
}
