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
