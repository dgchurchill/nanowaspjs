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

import * as utils from './utils'
import { DataBlock } from './utils'

export class VirtualTape {
    url: string;
    data: DataBlock;
    title: string;
    filename: string;
    typeCode: string;
    startAddress: number;
    autoStartAddress: number;
    isAutoStart: boolean;
    extra: number;

    constructor(title, filename, urlOrData: string|DataBlock, tapeParameters) {
        if (typeof(urlOrData) == "string")
        {
            this.url = urlOrData;
        }
        else
        {
            if (urlOrData.length > 0xFFFF) {
                throw {
                    name: "ArgumentError",
                    message: "'urlOrData' must be less than 64k in size."
                };
            }
            
            this.data = urlOrData;
        }
        
        this.title = title;
        this.filename = filename;
        
        if (tapeParameters == null) {
            tapeParameters = VirtualTape.getDefaultParameters(filename);
        }
        
        this.typeCode = tapeParameters[0];
        this.startAddress = tapeParameters[1];
        this.autoStartAddress = tapeParameters[2];
        this.isAutoStart = tapeParameters[3];
        this.extra = tapeParameters[4];
    };

    static getDefaultParameters(filename) {
        var tapeTypes = {
            default_: ['B', 0x08C0, 0x0000, false, 0x00],
            bee: ['M', 0x0900, 0x0900, true, 0x00],
            bin: ['M', 0x0900, 0x0900, true, 0x00],
            z80: ['M', 0x0900, 0x0900, true, 0x00],
            com: ['M', 0x0100, 0x0100, true, 0x00],
            asm: ['S', 0x1000, 0x0000, false, 0x00],
            edt: ['S', 0x1000, 0x0000, false, 0x00],
            mac: ['S', 0x1000, 0x0000, false, 0x00],
            pas: ['S', 0x1000, 0x0000, false, 0x00],
            txt: ['S', 0x1000, 0x0000, false, 0x00],
            wbf: ['W', 0x0900, 0x0000, false, 0x00]
        };
        
        var tapeParameters = tapeTypes.default_;
        
        var match = filename.match(/\.(...)$/);
        if (match != null) {
            var extension = match[1].toLowerCase();
            if (extension in tapeTypes) {
                tapeParameters = tapeTypes[extension];
            }
        }
        
        return tapeParameters;
    };
    
    // Asynchronously gets a byte array containing the data as it would be stored
    // on tape (i.e. including tape header and checksummed blocks).  On success, the
    // onSuccess function will be called with the first parameter set to the result.
    // If an error occurs then onError will be called with its first parameter
    // set to the tape.  onSuccess may be called immediately from within this method
    // if the data is already available.
    //
    // Returns an XMLHttpRequest object which can be used to abort or check the status
    // of the request.
    getFormattedData(onSuccess, onError): XMLHttpRequest {
        if (this.data != null) {
            onSuccess(this._formatData());
            return;
        }
        
        var this_ = this;
        return utils.ajaxGetBinary(
            this.url,
            function (data) {
                this_.data = data;
                onSuccess(this_._formatData());
            },
            function (request) {
                onError(request);
            })
    }

    _formatData() {
        var headerLength = 40 + 1 + 16 + 1;
        var blockSize = 256;
        var fullBlockCount = Math.floor(this.data.length / blockSize);
        var finalBlockSize = this.data.length % blockSize;
        var dataLength = fullBlockCount * (blockSize + 1);
        if (finalBlockSize > 0) {
            dataLength += finalBlockSize + 1;
        }

        var formattedData = utils.makeUint8Array(headerLength + dataLength);
        var stream = new utils.MemoryStream(formattedData);
        
        // lead-in
        for (var i = 0; i < 40; ++i) {
            stream.write(0);
        }
        
        // header indicator
        stream.write(1);
        
        // header
        stream.clearChecksum8();
        
        for (var i = 0; i < 6; ++i) {
            if (i < this.filename.length) {
                stream.write(this.filename.charCodeAt(i));
            } else {
                stream.write(' '.charCodeAt(0));
            }
        }
        
        stream.write(this.typeCode.charCodeAt(0));
        
        stream.write(this.data.length & 0xFF);  // TODO: Add a stream write function that writes shorts.
        stream.write(this.data.length >> 8);
        
        stream.write(this.startAddress & 0xFF);
        stream.write(this.startAddress >> 8);
        
        stream.write(this.autoStartAddress & 0xFF);
        stream.write(this.autoStartAddress >> 8);
        
        stream.write(0x00); // baud flag
        
        if (this.isAutoStart) {
            stream.write(0xFF);
        } else {
            stream.write(0x00);
        }
        
        stream.write(this.extra);
        
        stream.writeChecksum8();
        
        // data
        var dataStream = new utils.MemoryStream(this.data);
        for (var i = 0; i < fullBlockCount; ++i) {
            for (var j = 0; j < blockSize; ++j) {
                stream.write(dataStream.read());
            }
            stream.writeChecksum8();
        }
        
        if (finalBlockSize > 0) {
            for (var j = 0; j < finalBlockSize; ++j) {
                stream.write(dataStream.read());
            }
            stream.writeChecksum8();
        }
        
        return formattedData;
    }
};
