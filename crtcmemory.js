/**
 * 
 */

var nanowasp = nanowasp || {};

nanowasp.CrtcMemory = function (charRomData, graphicsContext) {
    this._charRom = new nanowasp.Rom(charRomData);
    this._pcgRam = new nanowasp.Ram(this.PCG_RAM_SIZE);
    this._videoRam = new nanowasp.Ram(this.VIDEO_RAM_SIZE);
    
    this._graphicsContext = graphicsContext;
};

nanowasp.CrtcMemory.prototype = {
    GRAPHICS_MEMORY_SIZE: 4096,
    VIDEO_RAM_SIZE: 2048,
    PCG_RAM_SIZE: 2048,
    BIT_MA13: 13,
    CHAR_WIDTH: 8,
        
    reset: function () {
        this._charRom.reset();
        this._pcgRam.reset();
        this._videoRam.reset();
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
            this._pcgRam.write((address - this.VIDEO_RAM_SIZE) % this.PCG_RAM_SIZE, value);
        }
    },
   
    getCharacterData: function (crtcAddress, scansPerRow) {
        var BIT_PCG = 7;
        var INDEX_START = 0;
        var INDEX_COUNT = 7;
        var BITMAP_SIZE = 16;  // Bytes per character image
        
        // TODO: Cache the image data for each character.  Probably cache the entire character (i.e. for max value of scansPerRow - 16?) and use 'dirty' parameters to putImageData. 

        var b = this._videoRam.read(crtcAddress % this.VIDEO_RAM_SIZE);
        var bitmapOffset = utils.getBits(b, INDEX_START, INDEX_COUNT) * BITMAP_SIZE;
        var bitmapData = this._charRom;
        if (utils.getBit(b, BIT_PCG) == 1) {
            bitmapData = this._pcgRam;
        } else {
            // Select character ROM bank
            bitmapOffset += utils.getBit(crtcAddress, this.BIT_MA13) * this.VIDEO_RAM_SIZE;
        }
        
        var image = this._graphicsContext.createImageData(this.CHAR_WIDTH, scansPerRow);
        var imageOffset = 0;
        
        for (var row = 0; row < scansPerRow; ++row) {
            for (var i = this.CHAR_WIDTH - 1; i >= 0; --i) {
                var color = ((bitmapData.read(bitmapOffset) & (1 << i)) != 0) ? 255 : 0;
                image.data[imageOffset++] = color;
                image.data[imageOffset++] = color;
                image.data[imageOffset++] = color;
                image.data[imageOffset++] = 255;
            }
            
            bitmapOffset++;
        }
        
        return image;
    }
};