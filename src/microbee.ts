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

import * as utils from './utils'
import { VirtualTape } from './virtualtape'
import { Z80Cpu } from './z80cpu';
import { Keyboard } from './keyboard';
import { LatchRom } from './latchrom';
import { Crtc } from './crtc';
import { MemMapper } from './memmapper';
import { Rom, Ram } from './memory';
import { CrtcMemory } from './crtcmemory';
import { TapeInjector } from './tapeinjector';
import data from './data';

export class MicroBee {
    _isRunning: boolean = false;
    _sliceDoneCallback: () => void = null;
    _devices: any;
    _runnables: any;
    _runningDevice: any;
    _emulationTime: number;
    _microsToRun: number;
    _startRealTime: number;
    _startEmulationTime: number;

    currentTape: any;

    static MAX_MICROS_TO_RUN = 200000;


    constructor(graphicsContext: CanvasRenderingContext2D, keyboardContext) {
        // Create the devices
        this._devices = {};
        this._devices.z80 = new Z80Cpu();
        this._devices.keyboard = new Keyboard(keyboardContext);
        this._devices.latchrom = new LatchRom();
        this._devices.crtc = new Crtc(graphicsContext);
        this._devices.memMapper = new MemMapper();
        this._devices.rom1 = new Rom(utils.decodeBase64(data.roms.basic_5_22e));
        this._devices.rom2 = new Rom(utils.makeUint8Array(16384));
        this._devices.rom3 = new Rom(utils.makeUint8Array(16384));
        this._devices.ram0 = new Ram(32768);
        this._devices.ram1 = new Ram(32768);
        this._devices.ram2 = new Ram(32768);
        this._devices.ram3 = new Ram(32768);
        this._devices.crtcMemory = new CrtcMemory(utils.decodeBase64(data.roms["char"]), graphicsContext);
        this._devices.tapeInjector = new TapeInjector(this._devices.z80);
        
        this._runnables = [this._devices.z80, this._devices.crtc];
        this._runningDevice = null;

        // Connect the devices
        var roms = [ this._devices.rom1, this._devices.rom2, this._devices.rom3 ];
        var rams = [ this._devices.ram0, this._devices.ram1, this._devices.ram2, this._devices.ram3 ];
        this._devices.memMapper.connect(this._devices.z80, rams, roms, this._devices.crtcMemory);
        this._devices.keyboard.connect(this, this._devices.crtc, this._devices.latchrom);
        this._devices.crtc.connect(this, this._devices.keyboard, this._devices.crtcMemory);
        this._devices.crtcMemory.connect(this._devices.crtc, this._devices.latchrom);
        
        // Register the ports
        this._devices.z80.registerPortDevice(0x0b, this._devices.latchrom);
        
        this._devices.z80.registerPortDevice(0x0c, this._devices.crtc);
        this._devices.z80.registerPortDevice(0x0e, this._devices.crtc);
        this._devices.z80.registerPortDevice(0x1c, this._devices.crtc);
        this._devices.z80.registerPortDevice(0x1e, this._devices.crtc);
        
        for (var i = 0x50; i <= 0x57; ++i) {
            this._devices.z80.registerPortDevice(i, this._devices.memMapper);
        }
        
        this.currentTape = null;
        
        // Reset everything to get ready to start
        this.reset();
    };

    reset() {
        for (var i in this._devices) {
            this._devices[i].reset();
        }
        
        this._emulationTime = 0;
        
        // Note: Setting _microsToRun to MAX_MICROS_TO_RUN on reset solves a problem where when the CRTC
        //       is reset it will indicate a frame time of 1us.  If the initial slice executes enough code
        //       to initialise the CRTC then everything is OK.  If we start running slices of only 1us
        //       duration then everything slows to a crawl.  TODO: Fix this properly (e.g. ensure CRTC never
        //       returns too small an interval; or, implement a MIN_MICROS_TO_RUN).
        this._microsToRun = MicroBee.MAX_MICROS_TO_RUN;
    }

    restoreState(state) {
        for (var key in state) {
            var reader = new utils.BinaryReader(utils.decodeBase64(state[key]));
            this._devices[key].restoreState(reader);
        }
    }
    
    setSliceDoneCallback(cb) {
        this._sliceDoneCallback = cb;
    }
    
    _runSlice() {
        var nextMicros = MicroBee.MAX_MICROS_TO_RUN;
        
        for (var i in this._runnables) {
            this._runningDevice = this._runnables[i];
            var deviceNextMicros = this._runningDevice.execute(this._emulationTime, this._microsToRun);
            if (deviceNextMicros != 0) {
                nextMicros = Math.min(nextMicros, deviceNextMicros);
            }
        }
        
        this._runningDevice = null;
        this._emulationTime += this._microsToRun;
        this._microsToRun = nextMicros;

        if (this._sliceDoneCallback != null) {
            this._sliceDoneCallback();
        }

        if (this._isRunning) {
            var elapsedRealTimeMs = (new Date()).getTime() - this._startRealTime;
            var elapsedEmulationTimeMs = (this._emulationTime - this._startEmulationTime) / 1000;
            var delay = elapsedEmulationTimeMs - elapsedRealTimeMs;
            delay = Math.max(0, delay);
            window.setTimeout(() => this._runSlice(), delay);
        }
    }
    
    getTime() {
        if (this._runningDevice != null) {
            return this._emulationTime + this._runningDevice.getCurrentExecutionTime();
        }
        
        return this._emulationTime;
    }
    
    start() {
        if (!this._isRunning) {
            this._isRunning = true;
            this._startRealTime = (new Date()).getTime();
            this._startEmulationTime = this._emulationTime;
            this._runSlice();
        }
    }
    
    stop() {
        this._isRunning = false;
    }
    
    getIsRunning() {
        return this._isRunning;
    }
    
    loadTape(tape: VirtualTape, onSuccess, onError) {
        var this_ = this;
        return tape.getFormattedData(
            function (data) {
                this_._devices.tapeInjector.setData(data);
                this_.currentTape = tape;
                onSuccess(tape);
            },
            function (request) {
                onError(tape, request);
            });
    }

    setKeyboardStrictMode(enabled) {
        this._devices.keyboard.setStrictMode(enabled);
    }
};
