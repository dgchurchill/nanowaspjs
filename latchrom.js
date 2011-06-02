/**
 * 
 */

var nanowasp = nanowasp || {};

nanowasp.LatchRom = function () {
    this._isLatched = false;
};

nanowasp.LatchRom.prototype = {
    read: function (address) {
        return 0;  // Cannot be read
    },
    
    write: function (address, value) {
        this._isLatched = utils.getBit(value, 0) == 1;
    },
    
    getSize: function () {
        return 1;
    },
    
    isLatched: function() {
        return this._isLatched;
    }
};