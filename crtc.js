/**
 * 
 */

var nanowasp = nanowasp || {};

nanowasp.Crtc = function () {
    
    this.reset = function() {
        this._selectedRegister = 0;

        this._lpenValid = false;
        this._lpen = 0;
        
        this._frameTime = 0;
        this._vblankTime = 0;
        
        this._cursorPosition = 0;
        this._cursorStart = 0;
        this._cursorEnd = 0;
        this._cursorMode = this.CursorMode.NoBlink;
        this._cursorOn = false;
        this._blinkRate = 0;
        
        this._hTotal = 0;
        this._hDisplayed = 0;
        this._vTotalAdjustment = 0;
        this._vDisplayed = 0;
        this._scansPerRow = 0;
        
        this._memoryAddress = 0;
    };
    
    this.reset();
    
    this.read = function (address) {
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
    };
    
    this.write = function (adddress, value) {
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
    };
    
    this.execute = function(time, duration) {
        
    };
    
    this._calculateVBlank = function() {
        
    };
};

nanowasp.Crtc.prototype = {
    RegisterIndex: Object.freeze({
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
    }),
    
    PortIndex: Object.freeze({
        Address:  0,
        Status:   0,
        Data:     1,
        NumPorts: 2
    }),
    
    CursorMode: Object.freeze({
        NoBlink:  0,
        NoCursor: 1,
        Blink16:  2,
        Blink32:  3
    })
};
