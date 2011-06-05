/*!  NanoWasp - A MicroBee emulator
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

window.onload = function () {
    var usedKeys = {};
    var keyMap = nanowasp.Keyboard.prototype.keyMap;
    for (var i = 0; i < keyMap.length; ++i) {
        usedKeys[keyMap[i]] = true;
    }
    
    var ignoreKey = function (event) {
        return event.metaKey || !(event.keyCode in usedKeys);
    };
    
    var pressedKeys = [];
    window.onkeydown = function (event) {
        if (ignoreKey(event)) {
            return true;
        }

        pressedKeys[event.keyCode] = true;
        return false;
    };

    window.onkeypress = function (event) {
        return ignoreKey(event);
    };

    window.onkeyup = function (event) {
        if (ignoreKey(event)) {
            return true;
        }

        pressedKeys[event.keyCode] = false;
        return false;
    };

    var graphicsContext = document.getElementById("vdu").getContext('2d');
    
    // microbee variable is global to make debugging easier.
    microbee = new nanowasp.MicroBee(graphicsContext, pressedKeys);

    window.onblur = microbee.stop.bind(microbee);
    window.onfocus = microbee.start.bind(microbee);

    microbee.restoreState(nanowasp.data.island);
    microbee.start();
};
