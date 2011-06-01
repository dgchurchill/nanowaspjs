/**
 * 
 */

var nanowasp = nanowasp || {};

nanowasp.Ram = function (size) {
	this._memory = new Uint8Array(size);
	
	this.read = function (address) {
		return this._memory[address];
	};
	
	this.write = function (address, value) {
		this._memory[address] = value;
	};
};

nanowasp.Rom = function (data) {
	this._memory = data;
	
	this.read = function (address) {
		return this._memory[address];
	};
	
	this.write = function (address, value) {
		// no-op (writing to ROM)
	};
};

nanowasp.CrtcMemory = function (charRomData) {
	var VIDEO_RAM_SIZE = 2048;
	var PCG_RAM_SIZE = 2048;
	var BIT_MA13 = 13;
	
	this._charRom = new nanowasp.Rom(charRomData);
	this._pcgRam = new nanowasp.Ram(PCG_RAM_SIZE);
	this._videoRam = new nanowasp.Ram(VIDEO_RAM_SIZE);
	
	this.connect = function (crtc, latchRom) {
	    this._crtc = crtc;
	    this._latchRom = latchRom;
	};
	
	this.read = function (address) {
	    if (address < VIDEO_RAM_SIZE) {
	        if (this._latchRom.getLatch()) {
	            var baseAddress = utils.getBit(this._crtc.getDispStart(), BIT_MA13) * VIDEO_RAM_SIZE;
	            return this._charRom.read(baseAddress + address);
	        } else {
	            return this._videoRam.read(address);
	        }
	    } else {
            return this._pcgRam.read((address - VIDEO_RAM_SIZE) % PCG_RAM_SIZE);
	    }
	};
	
	this.write = function (address, value) {
		if (address < VIDEO_RAM_SIZE) {
			if (!this._latchRom.getLatch()) {
		    	this._videoRam.write(address, value);
		    }
		}
		else {
	    	this._pcgRam.write((address - VIDEO_RAM_SIZE) % PCG_RAM_SIZE, value);
	    }
	};
};
