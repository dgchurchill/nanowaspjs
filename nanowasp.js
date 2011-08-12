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
    
    document.getElementById("tape_menuitem").addEventListener(
        "click", //"DOMActivate",
        function () {
            utils.toggleHtmlClass("tape_menu", "selected");
        },
        false);
    
    nanowasp.tapes = {};
    for (var name in nanowasp.data.mwbs) {
        nanowasp.tapes[name] = utils.decodeBase64(nanowasp.data.mwbs[name]);
    }
    
    var tapeFileInput = document.getElementById("tape_file");
    tapeFileInput.onchange = function () {
        for (var i = 0; i < tapeFileInput.files.length; ++i) {
            var file = tapeFileInput.files[i];
            if (file.size > 65536) {
                continue; // TODO: Error message.
            }
            
            (function (f) {
                var reader = new FileReader();
                reader.onload = function (e) {
                    var data = utils.makeUint8Array(reader.result.length);
                    for (var i = 0; i < data.length; ++i) {
                        data[i] = reader.result.charCodeAt(i);
                    }
                    
                    nanowasp.tapes[f.fileName] = data;
                    nanowasp.update_tapes();
                };
                reader.readAsBinaryString(f);  // Not all browsers support readAsArrayBuffer
            })(file);
        }
    };
    
    nanowasp.update_tapes();
    
    document.getElementById("reset_button").onclick = function () { microbee.reset(); };
    
    window.onblur = utils.bind0(microbee.stop, microbee);
    window.onfocus = utils.bind0(microbee.start, microbee);

    microbee.start();
};

nanowasp.update_tapes = function () {    
    var tapeItems = document.createDocumentFragment();
    for (var name in nanowasp.tapes) {
        var li = document.createElement("li");
        li.className = "menuitem";
        var span = document.createElement("span");
        span.className = "link";
        span.onclick = (function(n) {
            return function () {
                if (/\.mac$/.test(n)) {
                    microbee.loadMacTape(n, nanowasp.tapes[n]);
                } else {
                    microbee.loadMwbTape(n, nanowasp.tapes[n]);
                }
                var selected_tape_name = document.getElementById("selected_tape_name");
                selected_tape_name.innerHTML = "";
                selected_tape_name.appendChild(document.createTextNode(n));
                utils.removeHtmlClass("tape_menu", "selected");
            };
        })(name);
        span.appendChild(document.createTextNode(name));
        li.appendChild(span);
        tapeItems.appendChild(li);
    }
    
    var tapesMenu = document.getElementById("tapes");
    tapesMenu.innerHTML = "";
    tapesMenu.appendChild(tapeItems);
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
