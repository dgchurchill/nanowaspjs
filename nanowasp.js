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

nanowasp.NanoWasp = function () {
    this._sendKeysToMicrobee = true;
};

nanowasp.NanoWasp.prototype = {     
    main: function () {
        var usedKeys = {};
        var keyMap = nanowasp.Keyboard.prototype.keyMap;
        for (var i = 0; i < keyMap.length; ++i) {
            usedKeys[keyMap[i]] = true;
        }
        
        var ignoreKey = (function (this_) {
            return function (event) {
                return !this_._sendKeysToMicrobee || event.metaKey || !(event.keyCode in usedKeys);
            };
        })(this);
        
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
        
        document.getElementById("hide_notice_button").onclick = function () {
            document.getElementById("notice").style.display = "none";
        };
    
        var graphicsContext = document.getElementById("vdu").getContext('2d');
        
        this.microbee = new nanowasp.MicroBee(graphicsContext, pressedKeys);
        var microbee = this.microbee;
            
        document.getElementById("tape_menuitem").addEventListener(
            "click", //"DOMActivate",
            utils.bind(this._toggleTapesMenu, this),
            false);
        
        nanowasp.tapes = [];
        for (var i = 0; i < nanowasp.software.length; ++i) {
            var info = nanowasp.software[i];
            nanowasp.tapes.push(new nanowasp.VirtualTape(info.title, info.filename, info.url, info.tapeParameters));
        }
        
        var tapeFileInput = document.getElementById("tape_file");
        var update_tapes = utils.bind(this._update_tapes, this);
        tapeFileInput.onchange = function () {
            for (var i = 0; i < tapeFileInput.files.length; ++i) {
                var file = tapeFileInput.files[i];
                if (file.size > 65535) {
                    continue; // TODO: Error message.
                }
                
                (function (f) {
                    var reader = new FileReader();
                    reader.onload = function (e) {
                        var data = utils.makeUint8Array(reader.result.length);
                        for (var i = 0; i < data.length; ++i) {
                            data[i] = reader.result.charCodeAt(i);
                        }
                        
                        nanowasp.tapes[f.fileName] = nanowasp.VirtualTape.createAutoTape(f.fileName, data);
                        update_tapes();
                    };
                    reader.readAsBinaryString(f);  // Not all browsers support readAsArrayBuffer
                })(file);
            }
        };
        
        this._update_tapes();
        
        this._debugger = new nanowasp.Debugger("registers");
        document.getElementById("debugger_button").onclick = utils.bind(this._show_debugger, this);

        document.getElementById("reset_button").onclick = function () { microbee.reset(); };
        
        window.onblur = utils.bind(microbee.stop, microbee);
        window.onfocus = utils.bind(microbee.start, microbee);
    
        microbee.start();
    },
    
    _toggleTapesMenu: function () {
        var is_selected = utils.toggleHtmlClass("tape_menu", "selected");
        this._sendKeysToMicrobee = !is_selected;
    },
    
    _hideTapesMenu: function () {
        utils.removeHtmlClass("tape_menu", "selected");
        this._sendKeysToMicrobee = true;
    },
    
    _loadTape: function (tape) {
        if (this._tapeLoadRequest != null) {
            this._tapeLoadRequest.abort();
        }

        var this_ = this;
        this._tapeLoadRequest = this.microbee.loadTape(
            tape,
            function () {
                console.log("tape load succeeded");
                this_._tapeLoadRequest = null;
            },
            function () {
                console.log("tape load failed");
                this_._tapeLoadRequest = null;
            });
        
        var selected_tape_name = document.getElementById("selected_tape_name");
        selected_tape_name.innerHTML = "";
        selected_tape_name.appendChild(document.createTextNode(tape.name));
    },

    _onTapeSelected: function (tape) {
        this._loadTape(tape);
        this._hideTapesMenu();
    },
    
    _onTapeEdited: function (tape) {
        // Editing a tape causes it to be selected and rewound because
        // the user most probably wants to load it after editing it.
        this._loadTape(tape);
    },

    _update_tapes: function () {    
        var onTapeSelected = utils.bind(this._onTapeSelected, this);
        var onTapeEdited = utils.bind(this._onTapeEdited, this);

        var tapeItems = document.createDocumentFragment();

        for (var name in nanowasp.tapes) {
            var li = document.createElement("li");
            li.className = "menuitem";
            
            // Reference to TapeView instance is maintained through the DOM
            new nanowasp.TapeView(nanowasp.tapes[name], li, onTapeSelected, onTapeEdited);
            
            tapeItems.appendChild(li);
        }
        
        var tapesMenu = document.getElementById("tapes");
        tapesMenu.innerHTML = "";
        tapesMenu.appendChild(tapeItems);
    },
    
    _show_debugger: function () {
        var debug = this._debugger;
        debug.update();
        utils.removeHtmlClass("debugger", "hidden");
        this.microbee.setSliceDoneCallback(function() {
            debug.update(); 
        });
        var button = document.getElementById("debugger_button");
        utils.setTextContent(button, "Hide Debugger");
        button.onclick = utils.bind(this._hide_debugger, this);
    },
    
    _hide_debugger: function () {
        utils.addHtmlClass("debugger", "hidden");
        this.microbee.setSliceDoneCallback(null);
        var button = document.getElementById("debugger_button");
        utils.setTextContent(button, "Show Debugger");
        button.onclick = utils.bind(this._show_debugger, this);
    }
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
        // nw variable is global to make debugging easier.
        nw = new nanowasp.NanoWasp();
        nw.main();
    } catch (e) {
        if (typeof(console) != "undefined" && console.log) {
            console.log(e);
        }
        
        // Hopefully at least this will work...
        var error_message_el = document.getElementById("error_message");
        error_message_el.innerHTML =
            "Unfortunately your browser does not support some features required by NanoWasp. " +
            "Try updating your browser to the latest version. " +
            "<a href=\"http://www.google.com/chrome\">Chrome</a> is recommended for best performance.";
        error_message_el.style.display = "block";
    }
};
