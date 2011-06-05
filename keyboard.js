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

nanowasp.Keyboard = function (pressedKeys) {
    this._pressedKeys = pressedKeys;
};

nanowasp.Keyboard.prototype = {
    KEY_START: 4,
    KEY_BITS: 6,

    connect: function (crtc, latchrom) {
        this._crtc = crtc;
        this._latchrom = latchrom;
    },

    reset: function () {
    },
        
    check: function (crtcAddress) {
        
        var keyCode = this._keyMap[utils.getBits(crtcAddress, this.KEY_START, this.KEY_BITS)];
        if (this._pressedKeys[keyCode]) {
            this._crtc.triggerLpen(crtcAddress);
        }
    },
    
    checkAll: function() {
        if (this._latchrom.isLatched()) {
            return;
        }
        
        // Scan in reverse order because higher addressed keys supplant lower addressed keys.
        for (var i = this._keyMap.length - 1; i >= 0; --i) {
            if (this._pressedKeys[this._keyMap[i]]) {
                this._crtc.triggerLpen(i << this.KEY_START);
                break;
            }
        }
    },
    
    _keyMap: [
        222,   // '
        65,    // A
        66,
        67,
        68,
        69,
        70,
        71,
        72,
        73,
        74,
        75,
        76,
        77,
        78,
        79,
        80,
        81,
        82,
        83,
        84,
        85,
        86,
        87,
        88,
        89,
        90,    // Z
        219,   // [
        220,   // \
        221,   // ]
        192,   // `
        46,    // Delete
        48,    // 0
        49,
        50,
        51,
        52,
        53,
        54,
        55,
        56,
        57,    // 9
        186,   // ;
        187,   // =
        188,   // ,
        189,   // -
        190,   // .
        191,   // /
        27,    // Escape
        8,     // Backspace
        9,     // Tab
        34,    // (PgDn) LF
        13,    // Enter
        20,    // Capslock
        35,    // (End) Break
        32,    // Space
        -1,    // Extra key 61  TODO: Map this?
        17,    // Control
        -1,    // Extra key 62  TODO: Map this?
        -1,    // Extra key 65  TODO: Map this?
        -1,    // Extra key 64  TODO: Map this?
        -1,    // Extra key 63  TODO: Map this?
        -1,    // Extra key 66  TODO: Map this?
        16     // Shift
     ]
};