/**
 * 
 */

/* Functions called by the z80 emulation code */

function readbyte_internal(address) {
    var entry = nanowasp.z80cpu._memoryHandlers[address / nanowasp.z80cpu._memoryBlockSize | 0];  // (x | 0) coerces x into an integer
    return entry.handler.read(address - entry.base);
}

function writebyte_internal(address, value) {
    var entry = nanowasp.z80cpu._memoryHandlers[address / nanowasp.z80cpu._memoryBlockSize | 0];  // (x | 0) coerces x into an integer
    entry.handler.write(address - entry.base, value);
}

function readport(address) {
    address &= 0xff;
    var entry = nanowasp.z80cpu._portHandlers[address / nanowasp.z80cpu._portBlockSize | 0];  // (x | 0) coerces x into an integer
    return entry.handler.read(address - entry.base);
}

function writeport(address, value) {
    address &= 0xff;
    var entry = nanowasp.z80cpu._portHandlers[address / nanowasp.z80cpu._portBlockSize | 0];  // (x | 0) coerces x into an integer
    entry.handler.write(address - entry.base, value);    
}


var nanowasp = nanowasp || {};

/* Z80Cpu currently only supports a single instance because the emulation code uses a bunch of globals */
nanowasp.Z80Cpu = function () {
    if (nanowasp.Z80Cpu.IsInstantiated) {
        throw "Only supports one instance";
    }
    nanowasp.Z80Cpu.IsInstantiated = true;
    
    z80_init();
    
    var nullHandler = {
        read: function (address) {
            return 0;
        },
        
        write: function (address, value) {
        }
    };
    
    this._memoryBlockSize = this.MEMORY_SIZE;
    this._memoryHandlers = [{ handler: nullHandler, base: 0 }];
    
    this._portBlockSize = this.PORT_SIZE;
    this._portHandlers = [{ handler: nullHandler, base: 0 }];
};

nanowasp.Z80Cpu.IsInstantiated = false;

nanowasp.Z80Cpu.prototype = {
    FREQUENCY_HZ: 3375000,
    MEMORY_SIZE: 65536,
    PORT_SIZE: 256,
    
    reset: function () {
        z80_reset();
    },
    
    execute: function (time, duration) {
        tstates = 0;
        event_next_event = duration * this.FREQUENCY_HZ / 1000000;  // TODO: Should check how many cycles we did last time and adjust this.  See original C++ code.
        z80_do_opcodes();
        return 0;  // Execute again as soon as possible.
    },
    
    registerMemoryDevice: function (address, handler) {
        var updated = this._registerDevice(address, handler, this.MEMORY_SIZE, this._memoryBlockSize, this._memoryHandlers);
        this._memoryBlockSize = updated.blockSize;
        this._memoryHandlers = updated.handlers;
    },
    
    registerPortDevice: function (address, handler) {
        var updated = this._registerDevice(address, handler, this.PORT_SIZE, this._portBlockSize, this._portHandlers);
        this._portBlockSize = updated.blockSize;
        this._portHandlers = updated.handlers;
    },
    
    _registerDevice: function (address, handler, limit, blockSize, handlers) {
        var start = address;
        var end = start + handler.getSize();
        
        var startAlignment = 1;
        var endAlignment = 1;
        
        if (end > limit) {
            throw "Handler doesn't fit in range";
        }
        
        while ((start & startAlignment) == 0 && startAlignment < limit) {
            startAlignment <<= 1;
        }
        
        while ((end & endAlignment) == 0 && endAlignment < limit) {
            endAlignment <<= 1;
        }
        
        var alignment = Math.min(startAlignment, endAlignment);
        
        if (alignment < blockSize) {
            // Smaller blocks are required to store the details of this handler, so rebuild 
            // the mem_handlers vector at the new size.

            var newHandlers = [];
            
            for (var i = 0; i < handlers.length; ++i) {
                for (var j = 0; j < blockSize / alignment; ++j) {
                    newHandlers.push(handlers[i]);
                }
            }
            
            handlers = newHandlers;
            blockSize = alignment;
        }
        
        // Install the new handler
        var entry = { handler: handler, base: address };
        for (var i = start / blockSize; i < end / blockSize; ++i) {
            handlers[i] = entry;
        }
        
        return {
            blockSize: blockSize,
            handlers: handlers
        };
    }
};

