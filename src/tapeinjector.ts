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

/*!
 *   Virtual tape support based on TAP file idea in uBee512. 
 */

import { Z80Cpu } from "./z80cpu";
import { DataBlock, trimRight } from "./utils";
import { saveAs } from 'file-saver';

interface Header {
    name: string;
    type: string;
    length: number;
    skip: number;
}

interface Parser<T> {
    init: T;
    update: (state: T, byte: number) => T;
}

type HeaderFormatEntry<K extends keyof Header> = {
    name: K;
    length: number;
    parser: Parser<Header[K]>
}

export class TapeInjector {
    _z80cpu: Z80Cpu;
    _data: DataBlock;
    _offset: number;
    _write_state: { state: "find_header"; one: number } | { state: "header"; element: number; offset: number } | { state: "data"; one: number };
    _write_header: Partial<Header> = {};
    _write_data: number[] = [];

    constructor(z80cpu: Z80Cpu) {
        this._z80cpu = z80cpu;
        this._data = [];
        this._offset = 0;

        this._write_state = { state: 'find_header', one: 0 };
    }

    static READ_LOCATION = 0xAB6D;
    static WRITE_LOCATION = 0xAB26;
     
    reset() {
        this._offset = 0;
        this._z80cpu.setBreakpoint(TapeInjector.READ_LOCATION, () => this._readByte())
        this._z80cpu.setBreakpoint(TapeInjector.WRITE_LOCATION, () => this._writeByte());
    }
    
    setData(data: DataBlock) {
        this._data = data;
        this._offset = 0;
    }
    
    _readByte() {
        var value = 0;
        if (this._offset < this._data.length) {
            value = this._data[this._offset];
            this._offset++;
        }
        
        this._z80cpu._z80.a = value;
        this._z80cpu.z80_ret();
    }

    _writeByte() {
        var value = this._z80cpu._z80.a;
        this._z80cpu.z80_ret();

        // TODO: Merge this parser in with the serializer in VirtualTape, and share the type detection.

        var string_t: Parser<string> = { init: '', update: function (a: string, n: number) { return a + String.fromCharCode(n); } };
        var int_t: Parser<number> = { init: 0, update: function (a: number, n: number) { return a / 256 + 256 * n; } };  // Er, well it works for 2 bytes :D
        var null_t: Parser<number> = { init: 0, update: function (a: number, n: number) { return 0; } };

        let hfe1: HeaderFormatEntry<"name"> = { name: "name", length: 6, parser: string_t };
        let hfe2: HeaderFormatEntry<"type"> ={ name: 'type', length: 1, parser: string_t };
        let hfe3: HeaderFormatEntry<"length"> ={ name: 'length', length: 2, parser: int_t };
        let hfe4: HeaderFormatEntry<"skip"> ={ name: 'skip', length: 8, parser: null_t };
        let headerFormat = [ hfe1, hfe2, hfe3, hfe4];

        var blockSize = 256;

        switch (this._write_state.state) {
            case 'find_header':
                if (value == this._write_state.one) {
                    switch (this._write_state.one) {
                        case 0:
                            this._write_state.one = 1;
                            break;

                        case 1:
                            this._write_state = { state: 'header', element: 0, offset: 0 };
                            this._write_header = {};
                    }
                }
                break;

            case 'header':
                var entry = headerFormat[this._write_state.element];

                if (this._write_state.offset == 0) {
                    this._write_header[entry.name] = entry.parser.init;
                }

                // TODO: Work out how to get TypeScript to accept the below without the switch
                switch (entry.name) {
                    case "name":
                    case "type":
                        this._write_header[entry.name] = entry.parser.update(this._write_header[entry.name]!, value);
                        break;

                    case "length":
                    case "skip":
                        this._write_header[entry.name] = entry.parser.update(this._write_header[entry.name]!, value);
                        break;
                }

                this._write_state.offset += 1;

                if (this._write_state.offset == entry.length) {
                    this._write_state.element += 1;
                    this._write_state.offset = 0;

                    if (this._write_state.element == headerFormat.length) {
                        this._write_state = { state: 'data', one: 0 };
                        this._write_data = [];
                    }
                }
                break;

            case 'data':
                if (this._write_state.one == blockSize) {
                    // Checksum, ignore
                    this._write_state.one = 0;
                } else {
                    this._write_data.push(value);
                    this._write_state.one += 1;
                }

                if (this._write_data.length == this._write_header.length) {
                    console.log('Got file ' + this._write_header.name + ' of type ' + this._write_header.type + ' with length ' + this._write_header.length);
                    var blob = new Blob([new Uint8Array(this._write_data)], {type: 'application/octet-binary'});
                    saveAs(blob, trimRight(this._write_header.name!) + (this._write_header.type == 'M' ? '.bin' : '.mwb'));
                    
                    // There'll be one more checksum byte, but the find_header state will ignore it.
                    this._write_state = { state: 'find_header', one: 0 };
                }
                break;
        }
    }
}
