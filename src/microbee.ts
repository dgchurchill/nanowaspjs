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
import { Z80Cpu } from './z80cpu';
import { Keyboard, KeyboardContext } from './keyboard';
import { LatchRom } from './latchrom';
import { Crtc } from './crtc';
import { MemMapper } from './memmapper';
import { Rom, Ram } from './memory';
import { CrtcMemory } from './crtcmemory';
import { TapeInjector } from './tapeinjector';
import data from './data';
import { decodeBase64, makeUint8Array, BinaryReader, DataBlock } from './utils';

interface Runnable {
    execute: (emulationTime: number, microsToRun: number) => number;
    getCurrentExecutionTime?: () => number;
}

const MAX_MICROS_TO_RUN = 200000;

export class MicroBee {
    _isRunning: boolean = false;
    _sliceDoneCallback: (() => void)|null = null;

    _devices: {
        z80: Z80Cpu;
        keyboard: Keyboard;
        latchrom: LatchRom;
        crtc: Crtc;
        memMapper: MemMapper;
        rom1: Rom;
        rom2: Rom;
        rom3: Rom;
        ram0: Ram;
        ram1: Ram;
        ram2: Ram;
        ram3: Ram;
        crtcMemory: CrtcMemory;
        tapeInjector: TapeInjector;

        [name: string]: {
            reset: () => void;
            restoreState?: (state: BinaryReader) => void;
        };
    };

    _runnables: Runnable[];
    _runningDevice: Runnable|null;
    _emulationTime: number = 0;
    _microsToRun: number = 0;
    _startRealTime: number = 0;
    _startEmulationTime: number = 0;

    currentTape: VirtualTape|null;

    constructor(graphicsContext: CanvasRenderingContext2D, keyboardContext: KeyboardContext) {
        // Create the devices
        let z80 = new Z80Cpu();
        this._devices = {
            z80: z80,
            keyboard: new Keyboard(keyboardContext),
            latchrom: new LatchRom(),
            crtc: new Crtc(graphicsContext),
            memMapper: new MemMapper(),
            rom1: new Rom(decodeBase64(data.roms.basic_5_22e)),
            rom2: new Rom(makeUint8Array(16384)),
            rom3: new Rom(makeUint8Array(16384)),
            ram0: new Ram(32768),
            ram1: new Ram(32768),
            ram2: new Ram(32768),
            ram3: new Ram(32768),
            crtcMemory: new CrtcMemory(decodeBase64(data.roms["char"]), graphicsContext),
            tapeInjector: new TapeInjector(z80)
        };
        
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
        this._microsToRun = MAX_MICROS_TO_RUN;
    }

    restoreState(state: { [name: string]: string }) {
        for (var key in state) {
            var reader = new BinaryReader(decodeBase64(state[key]));
            this._devices[key].restoreState!(reader);
        }
    }
    
    setSliceDoneCallback(cb: (() => void)|null) {
        this._sliceDoneCallback = cb;
    }
    
    _runSlice() {
        var nextMicros = MAX_MICROS_TO_RUN;
        
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
            return this._emulationTime + this._runningDevice.getCurrentExecutionTime!();
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
    
    loadTape(tape: VirtualTape, onSuccess: (tape: VirtualTape) => void, onError: (tape: VirtualTape, request: XMLHttpRequest) => void) {
        return tape.getFormattedData(
            (data: DataBlock) => {
                this._devices.tapeInjector.setData(data);
                this.currentTape = tape;
                onSuccess(tape);
            },
            (request: XMLHttpRequest) => {
                onError(tape, request);
            });
    }

    setKeyboardStrictMode(enabled: boolean) {
        this._devices.keyboard.setStrictMode(enabled);
    }
};
