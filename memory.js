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
