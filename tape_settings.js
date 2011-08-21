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


nanowasp.TapeSettings = function (tape) {
    this._tape = tape;
    this._form = null;
};

nanowasp.TapeSettings.prototype = {
    insertForm: function (parent) {
        this._form = this._createForm([
                { name: 'td_name', label: 'Name' },
                { name: 'td_type_code', label: 'Type code' },
                { name: 'td_extra', label: 'Extra byte' },
                { name: 'td_start_address', label: 'Start address' },
                { name: 'td_auto_start_address', label: 'Auto start address' },
                { name: 'td_is_auto_start', label: 'Auto started', type: 'checkbox' }
            ],
            2);

        parent.appendChild(this._form);
    },
    
    removeForm: function () {
        if (this._form != null) {
            this._form.parentNode.removeChild(this._form);
            this._form = null;
        }
    },
    
    _createForm: function(fields, width) {
        var form = document.createElement('form');
        var have_width = typeof(width) != 'undefined';
        var parent = form;
        
        for (var i = 0; i < fields.length; ++i) {
            if (have_width && i % width == 0) {
                var parent = document.createElement('p');
                form.appendChild(parent);
            }
            
            parent.appendChild(this._createInput(fields[i]));
        }
        
        return form;
    },
    
    _createInput: function (field) {
        var type = field.type;
        if (type == undefined) {
            type = 'text';
        }
        
        var input_el = document.createElement('input');
        input_el.id = field.name;
        input_el.type = type;
        
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
