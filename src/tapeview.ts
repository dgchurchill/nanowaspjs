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

import { VirtualTape } from './virtualtape'


interface Validator {
    validate: (value: any) => any,
    message?: string
}

interface Field {
    property: string,
    label: string,
    type?: string,
    validator?: Validator,
    renderer?: (value: any) => any
}

export class TapeView {
    _tape: VirtualTape;
    _parentBlockElement: HTMLElement;
    _form: HTMLFormElement;
    _nameSpan: HTMLElement;

    constructor(tape: VirtualTape, parentBlockElement: HTMLElement, onTapeSelected: (tape: VirtualTape) => void, onTapeEdited: (tape: VirtualTape) => void) {
        this._tape = tape;
        this._parentBlockElement = parentBlockElement;
        this._form = null;
        this._buildView(onTapeSelected, onTapeEdited);
    };

    _buildView(onTapeSelected, onTapeEdited) {
        var this_ = this;  // For closures
        
        this._nameSpan = document.createElement("span");
        this._nameSpan.className = "link";
        this._nameSpan.onclick = function () {
            onTapeSelected(this_._tape);
        };
        this._nameSpan.appendChild(document.createTextNode(this._tape.title));
        
        var editDiv = document.createElement("div");
        editDiv.className = "link right";
        editDiv.onclick = function () {
            if (this_._form == null) {
                this_._insertForm(onTapeEdited);
                editDiv.innerHTML = "done";
            } else {
                this_._removeForm();
                editDiv.innerHTML = "edit";
            }
        };
        editDiv.appendChild(document.createTextNode("edit"));

        this._parentBlockElement.appendChild(editDiv);
        this._parentBlockElement.appendChild(this._nameSpan);
    }
        
    _insertForm(onTapeEdited) {
        var this_ = this;
        var toHex = function (v) { return "0x" + v.toString(16); };
        
        var nameValidator: Validator = {
            validate: function (v) {
                this_._nameSpan.innerHTML = "";
                this_._nameSpan.appendChild(document.createTextNode(v));
                return v;
            }
        }
        
        this._form = this._createForm(
            this._tape,
            [
                { property: 'title', label: 'Name', validator: nameValidator },
                { property: 'typeCode', label: 'Type code' },
                { property: 'extra', label: 'Spare byte', validator: this._integerValidator(0, 0xFF), renderer: toHex },
                { property: 'startAddress', label: 'Load address', validator: this._integerValidator(0, 0xFFFF), renderer: toHex },
                { property: 'autoStartAddress', label: 'Start address', validator: this._integerValidator(0, 0xFFFF), renderer: toHex },
                { property: 'isAutoStart', label: 'Auto started', type: 'checkbox' }
            ],
            2,
            function () { onTapeEdited(this_._tape); });

        this._parentBlockElement.appendChild(this._form);
    }
    
    _removeForm() {
        if (this._form != null) {
            this._form.parentNode.removeChild(this._form);
            this._form = null;
        }
    }
    
    _integerValidator(min, max): Validator {
        return {
            validate: function (value: string) {
                var base = null;
                if (/^[0-9]+$/.test(value)) {
                    base = 10;
                } else if (/^0x[0-9a-f]+$/i.test(value)) {
                    base = 16;
                }
                
                if (base == null) {
                    return undefined;
                }
                
                var result = parseInt(value, base);
                
                if (result >= min && result <= max) {
                    return result;
                }
                
                return undefined;
            },
            
            message: "Enter a number between " + min + " and " + max + "."
        };
    }
    
    _createForm(data, fields: Field[], width, onChange): HTMLFormElement {
        var form = document.createElement('form');
        var have_width = typeof(width) != 'undefined';
        var parent: HTMLElement = form;
        
        for (var i = 0; i < fields.length; ++i) {
            if (have_width && i % width == 0) {
                parent = document.createElement('p');
                form.appendChild(parent);
            }
            
            parent.appendChild(this._createInput(data, fields[i], onChange));
        }
        
        return form;
    }
    
    _createInput(data, field: Field, onChange) {
        var type = field.type;
        if (type == undefined) {
            type = 'text';
        }
        
        var input_el = document.createElement('input');
        input_el.type = type;
        
        var renderer = field.renderer;
        if (renderer == undefined) {
            renderer = function (v) { return v; };
        }
        if (type == 'checkbox') {
            input_el.checked = renderer(data[field.property]);
        } else {
            input_el.value = renderer(data[field.property]);
        }
        
        var validator = field.validator;
        if (validator == undefined) {
            validator = {
                validate: function (v) { return v; }
            };
        }
        input_el.onchange = function () {
            var new_value;
            if (type == 'checkbox') {
                new_value = validator.validate(input_el.checked);
            } else {
                new_value = validator.validate(input_el.value);
            }
            if (new_value != undefined) {
                data[field.property] = new_value;
                label_el.className = "";
                onChange();
            } else {
                label_el.className = "invalid";
            }
        };
        
        var label_el = document.createElement('label');
        
        var label_first = type != 'checkbox';
        
        if (label_first) {
            label_el.appendChild(document.createTextNode(field.label));            
            label_el.appendChild(input_el);
        } else {
            label_el.appendChild(input_el);
            label_el.appendChild(document.createTextNode(field.label));                        
        }
        
        return label_el;
    }
};
