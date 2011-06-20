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

var nanowasp = nanowasp || {};

nanowasp.main = function () {
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

    /*
    var states = [
        [ "island", "Shipwreck Island"],
        [ "basic", "BASIC"],
        [ "shell", "Shell"]
    ];
    
    microbee.restoreState(nanowasp.data[states[stateSelector.selectedIndex][0]]);
    */

    var tapeSelector = document.getElementById("tape_selector");
    
    for (var i in nanowasp.data.mwbs) {
        var option = document.createElement("option");
        option.value = i;
        option.text = i;
        tapeSelector.add(option, null);
    }
    
    var loadSelectedTape = function () {
        var name = tapeSelector.value;
        microbee.loadMwbTape(name, utils.decodeBase64(nanowasp.data.mwbs[name]));
    };
    
    tapeSelector.onchange = loadSelectedTape;

    loadSelectedTape();
    
    document.getElementById("reset_button").onclick = function () { microbee.reset(); };

    document.getElementById("controls").style.visibility = "visible";
    
    window.onblur = utils.bind0(microbee.stop, microbee);
    window.onfocus = utils.bind0(microbee.start, microbee);

    microbee.start();
};

window.onload = function () {
    // The intention is that this is the first piece of code that actually does anything serious.
    // Up until this point in execution only definitions of functions and simple objects should
    // have been made.  That is, nothing should have been done that would fail in browsers 
    // released in the last few years.
    //
    // The following try/catch should pick up any issues we have that will arise due to missing
    // features as all the features we require are used during the nanowasp.main() call.
    // TODO: It may be a good idea to put a similar try/catch around MicroBee._runSliceBody.
    
    try {
        nanowasp.main();
    } catch (e) {
        if (typeof(console) != "undefined" && console.log) {
            console.log(e);
        }
        
        // Hopefully at least this will work...
        document.getElementById("error_message").style.display = "block";
    }
};
