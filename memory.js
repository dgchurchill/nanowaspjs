/**
 * 
 */

var nanowasp = nanowasp || {};

nanowasp.Ram = function (size) {
	this._memory = new Uint8Array(size);
};

nanowasp.Ram.prototype = {
    reset: function () {
        this._memory = new Uint8Array(this.getSize());
    },
        
    getSize: function () {
        return this._memory.length;
    },
    
    restoreState: function (state) {
        this._memory = state.readBuffer(this.getSize());
    },
        
	read: function (address) {
		return this._memory[address];
	},

	write: function (address, value) {
		this._memory[address] = value;
	}
};


nanowasp.Rom = function (data) {
	this._memory = data;
};

nanowasp.Rom.prototype = {
    reset: function () {
    },
        
    getSize: function () {
        return this._memory.length;
    },
        
	read: function (address) {
		return this._memory[address];
	},
	
	write: function (address, value) {
		// no-op (writing to ROM)
	}
};
