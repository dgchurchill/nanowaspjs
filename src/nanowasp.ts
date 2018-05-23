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

import * as utils from './utils';
import { MicroBee } from './microbee';
import { Debugger } from './debugger';
import { VirtualTape } from './virtualtape';
import { Keyboard } from './keyboard';
import { software } from './software';
import { TapeView } from './tapeview';

function showErrorHtml (html) {
    var error_message = document.getElementById("error_message");
    error_message.innerHTML = html;
    document.getElementById("error").style.display = "block";
};

function showError (text) {
    var error_message = document.getElementById("error_message");
    error_message.innerHTML = "";
    error_message.appendChild(document.createTextNode((new Date()).toLocaleTimeString() + " - " + text));
    document.getElementById("error").style.display = "block";
}

class NanoWasp {
    _sendKeysToMicrobee: boolean;
    _menus: string[];
    _debugger: Debugger;
    _tapeLoadRequest: XMLHttpRequest;
    _tapes: VirtualTape[];

    microbee: MicroBee;

    constructor() {
        this._sendKeysToMicrobee = true;
        this._menus = [ "settings_menu", "tape_menu" ];
    }

    main() {
        var this_ = this;

        var performDefault = function (event) {
            // Swallowing all the ctrl keys is possibly a bit obnoxious...
            // Ideally we'd only swallow them when focus is on the MicroBee, need to come up with a clean way to indicate focus.
            var captured = this_._sendKeysToMicrobee && ((event.keyCode in Keyboard.capturedKeys) || event.ctrlKey);
            return event.metaKey || !captured;
        };
        
        var pressedKeys: boolean[] = [];
        var inputBuffer = [];

        window.onkeydown = function (event) {
            if (this_._sendKeysToMicrobee) {
                pressedKeys[event.keyCode] = true;

                if (event.ctrlKey && event.keyCode >= 'A'.charCodeAt(0) && event.keyCode <= 'Z'.charCodeAt(0)) {
                    inputBuffer.push([event.keyCode - 'A'.charCodeAt(0) + 1, true]);
                } else {
                    var mapped = Keyboard.capturedKeys[event.keyCode];
                    if (mapped != undefined) {
                        var charCode = mapped.length == 2 && event.shiftKey ? mapped[1] : mapped[0];
                        inputBuffer.push([charCode, false]);
                    }
                }
            }

            return performDefault(event);
        };
    
        window.onkeypress = function (event) {
            if (this_._sendKeysToMicrobee) {
                inputBuffer.push([event.charCode, event.ctrlKey]);
            }

            return performDefault(event);
        };
    
        window.onkeyup = function (event) {
            pressedKeys[event.keyCode] = false;
            return performDefault(event);
        };

        window.addEventListener(
            "paste",
            function (event: ClipboardEvent) {
                var text = event.clipboardData.getData("text/plain");
                for (var i = 0; i < text.length; ++i) {
                    var code = text.charCodeAt(i);
                    if (code ==  0x0D) {
                        // strip CRs
                        continue;
                    }

                    inputBuffer.push([code, false]);
                }
            },
            false);

        var keyboardContext = {
            pressed: pressedKeys,
            buffer: inputBuffer
        };
        
        document.getElementById("hide_notice_button").onclick = function () {
            document.getElementById("notice").style.display = "none";
        };
    
        document.getElementById("hide_error_button").onclick = function () {
            document.getElementById("error").style.display = "none";
        };

        var graphicsContext = (document.getElementById("vdu") as HTMLCanvasElement).getContext('2d');
        
        this.microbee = new MicroBee(graphicsContext, keyboardContext);
        var microbee = this.microbee;
        
        var hook_menu_toggle = function(menu_id) {
            document.getElementById(menu_id + "item").addEventListener(
                "click",
                function () { this_._toggleMenu(menu_id); },
                false);
        };

        for (var menu in this._menus) {
            hook_menu_toggle(this._menus[menu]);
        }
                    
        this._tapes = [];
        for (var i = 0; i < software.length; ++i) {
            var info = software[i];
            this._tapes.push(new VirtualTape(info.title, info.filename, info.url, info.tapeParameters));
        }
        
        var tapeFileInput = document.getElementById("tape_file") as HTMLInputElement;
        var update_tapes = utils.bind(this._update_tapes, this);
        tapeFileInput.onchange = () => {
            for (var i = 0; i < tapeFileInput.files.length; ++i) {
                var file = tapeFileInput.files[i];
                if (file.size > 65535) {
                    continue; // TODO: Error message.
                }
                
                (function (f) {
                    var reader = new FileReader();
                    reader.onload = (e) => {
                        var data = utils.makeUint8Array(reader.result);
                        this._tapes.push(new VirtualTape(f.name, f.name, data, null))
                        update_tapes();
                    };
                    reader.readAsArrayBuffer(f);
                })(file);
            }
        };
        
        this._update_tapes();
        
        this._debugger = new Debugger(this.microbee._devices.z80._z80, "registers");
        document.getElementById("debugger_button").onclick = utils.bind(this._show_debugger, this);

        document.getElementById("reset_button").onclick = function () { microbee.reset(); };
        
        var keyboard_mode_strict = document.getElementById("keyboard_mode_strict") as HTMLInputElement;
        keyboard_mode_strict.onchange = document.getElementById("keyboard_mode_natural").onchange = function () {
            microbee.setKeyboardStrictMode(keyboard_mode_strict.checked);
        };

        var run_in_background = document.getElementById("run_in_background") as HTMLInputElement;
        
        window.onblur = function () {
            if (!run_in_background.checked) {
                microbee.stop();
            }
        };

        window.onfocus = utils.bind(microbee.start, microbee);
    
        microbee.start();
    }

    _toggleMenu(name) {
        var is_selected = false;

        for (var menu in this._menus) {
            if (this._menus[menu] == name) {
                is_selected = utils.toggleHtmlClass(name, "selected");
            } else {
                utils.removeHtmlClass(this._menus[menu], "selected");
            }
        }

        this._sendKeysToMicrobee = !is_selected;
    }
    
    _hideMenus() {
        for (var menu in this._menus) {
            utils.removeHtmlClass(this._menus[menu], "selected");
        }

        this._sendKeysToMicrobee = true;
    }
    
    _loadTape(tape: VirtualTape) {
        if (this._tapeLoadRequest != null) {
            this._tapeLoadRequest.abort();
        }
        
        var selected_tape_name = document.getElementById("selected_tape_name");
        selected_tape_name.innerHTML = "";
        selected_tape_name.appendChild(document.createTextNode(tape.title));
        document.getElementById("tape_loading").style.display = "inline";

        var this_ = this;
        this._tapeLoadRequest = this.microbee.loadTape(
            tape,
            function () {
                document.getElementById("tape_loading").style.display = "none";
                this_._tapeLoadRequest = null;
            },
            function (tape, request) {
                showError("Tape failed to load (" + request.status + " " + request.statusText + ")");
                console.log(arguments);
                document.getElementById("tape_loading").style.display = "none";
                this_._tapeLoadRequest = null;
            });
    }

    _onTapeSelected(tape: VirtualTape) {
        this._loadTape(tape);
        this._hideMenus();
    }
    
    _onTapeEdited(tape) {
        // Editing a tape causes it to be selected and rewound because
        // the user most probably wants to load it after editing it.
        this._loadTape(tape);
    }

    _update_tapes() {    
        var onTapeSelected = utils.bind(this._onTapeSelected, this);
        var onTapeEdited = utils.bind(this._onTapeEdited, this);

        var tapeItems = document.createDocumentFragment();

        for (var name in this._tapes) {
            var li = document.createElement("li");
            li.className = "menuitem";
            
            // Reference to TapeView instance is maintained through the DOM
            new TapeView(this._tapes[name], li, onTapeSelected, onTapeEdited);
            
            tapeItems.appendChild(li);
        }
        
        var tapesMenu = document.getElementById("tapes");
        tapesMenu.innerHTML = "";
        tapesMenu.appendChild(tapeItems);
    }
    
    _show_debugger() {
        var debug = this._debugger;
        debug.update();
        utils.removeHtmlClass("debugger", "hidden");
        this.microbee.setSliceDoneCallback(function() {
            debug.update(); 
        });
        var button = document.getElementById("debugger_button");
        utils.setTextContent(button, "Hide Debugger");
        button.onclick = utils.bind(this._hide_debugger, this);
    }
    
    _hide_debugger() {
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
        Keyboard.init();
        var nw = new NanoWasp();
        nw.main();
    } catch (e) {
        if (typeof(console) != "undefined" && console.log) {
            console.log(e);
        }
        
        // Hopefully at least this will work...
        showErrorHtml(
            "Unfortunately your browser does not support some features required by NanoWasp. " +
            "Try updating your browser to the latest version.");
    }
};
