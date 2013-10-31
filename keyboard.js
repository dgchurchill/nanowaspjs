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

nanowasp.Keyboard = function (keyboardContext) {
    this._keyboardContext = keyboardContext;
    this._strictMode = false;
};

nanowasp.Keyboard.microbeeToJavascriptKeyMap = [
    222,   // '
    65,    // A
    66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89,
    90,    // Z
    219,   // [
    220,   // \
    221,   // ]
    192,   // `
    46,    // Delete
    48,    // 0
    49, 50, 51, 52, 53, 54, 55, 56,
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
];

nanowasp.Keyboard.capturedKeys = {
    8: '\b'.charCodeAt(0),  // Backspace
    9: '\t'.charCodeAt(0),  // Tab
    13: '\n'.charCodeAt(0), // Enter
    27: '\033'.charCodeAt(0), // Escape
    32: ' '.charCodeAt(0),  // Space
    34: '\r', // PgDn
    35: '\x18'.charCodeAt(0), // End
    46: '\x7f'.charCodeAt(0)  // Delete
};

nanowasp.Keyboard.charactersToMicrobeeKeys = {};

nanowasp.Keyboard.init = function () {
    var toMicrobee = nanowasp.Keyboard.charactersToMicrobeeKeys;
    var shiftCode = 63;

    var unshifted = '@abcdefghijklmnopqrstuvwxyz[\\]' + '^\b0123456789'  + ':;,-./\x1b\x7f\r\t\n\x0f\x18 ';
    var shifted   = '`ABCDEFGHIJKLMNOPQRSTUVWXYZ{|}'  + '~\b0!"#$%&\'()' + '*+<=>?\x1b\x7f\r\t\n\x0f\x18 ';

    for (var i = 0; i < unshifted.length; ++i) {
        toMicrobee[shifted[i].charCodeAt(0)] = [shiftCode, i];  // Shifted first so the unshifted overwrites the shifted if the key doesn't have a shifted version.
        toMicrobee[unshifted[i].charCodeAt(0)] = [i];
    }
}

nanowasp.Keyboard.prototype = {
    KEY_START: 4,
    KEY_BITS: 6,
    BUFFERED_KEY_RATE: 10000,

    connect: function (microbee, crtc, latchrom) {
        this._microbee = microbee;
        this._crtc = crtc;
        this._latchrom = latchrom;
    },

    reset: function () {
        this._lastBufferedKey = undefined;
        this._lastBufferedKeyTime = 0;
        this._keyboardContext.pressed.length = 0;
        this._keyboardContext.buffer.length = 0;
    },
        
    check: function (crtcAddress) {        
        var keyCode = utils.getBits(crtcAddress, this.KEY_START, this.KEY_BITS);
        if (this._isPressed(keyCode)) {
            this._crtc.triggerLpen(crtcAddress);
        }
    },
    
    checkAll: function () {
        if (this._latchrom.isLatched()) {
            return;
        }
        
        // Scan in reverse order because higher addressed keys supplant lower addressed keys.
        for (var i = nanowasp.Keyboard.microbeeToJavascriptKeyMap.length - 1; i >= 0; --i) {
            if (this._isPressed(i)) {
                this._crtc.triggerLpen(i << this.KEY_START);
                break;
            }
        }
    },

    setStrictMode: function(enabled) {
        this._strictMode = enabled;
        this.reset();
    },

    _isPressed: function (microbeeCode) {
        if (this._strictMode) {
            return this._keyboardContext.pressed[nanowasp.Keyboard.microbeeToJavascriptKeyMap[microbeeCode]]
            this._keyboardContext.buffer.length = 0;
        } else {
            if (this._microbee.getTime() > this._lastBufferedKeyTime + this.BUFFERED_KEY_RATE) {
                this._lastBufferedKeyTime = this._microbee.getTime();

                if (this._lastBufferedKey == undefined) {
                    var charCode = this._keyboardContext.buffer.shift();
                    this._lastBufferedKey = nanowasp.Keyboard.charactersToMicrobeeKeys[charCode];                    
                } else {
                    this._lastBufferedKey = undefined; // simulate key release
                }
            }

            return this._lastBufferedKey != undefined && this._lastBufferedKey.indexOf(microbeeCode) >= 0;
        }
    }
};