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

nanowasp.LatchRom = function () {
    this._isLatched = false;
};

nanowasp.LatchRom.prototype = {
    reset: function () {
        this._isLatched = false;
    },
        
    restoreState: function (state) {
        this._isLatched = state.readBool();
    },
    
    read: function (address) {
        return 0;  // Cannot be read
    },
    
    write: function (address, value) {
        this._isLatched = utils.getBit(value, 0) == 1;
    },
    
    getSize: function () {
        return 1;
    },
    
    isLatched: function() {
        return this._isLatched;
    }
};