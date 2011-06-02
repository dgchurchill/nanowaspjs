/**
 * 
 */

var utils = {
    getBit: function (value, bit) {
        return (value >> bit) & 1;
    },
    
    getBits: function (value, start, count) {
        return (value >> start) % (1 << count);
    },
    
    clearBits: function (value, start, count) {
        return value & ~(((1 << count) - 1) << start);
    },
    
    copyBits: function (old, start, count, value) {
        return utils.clearBits(old, start, count) | (utils.getBits(value, 0, count) << start);
    },
    
    decodeBase64: function (s) {
        var encode = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        var decode = {};
        for (var i = 0; i < encode.length; ++i) {
            decode[encode.charAt(i)] = i;
        }
        
        s = s.replace(/=/g, "");
        
        var len = (s.length / 4 | 0) * 3;
        if (s.length % 4 > 0) {
            len += s.length % 4 - 1;
        }
        var result = new Uint8Array(len);
        
        var resultIndex = 0;
        for (var i = 0; i < s.length; i += 4) {
            var packet = s.substring(i, i + 4);
            
            var bytes = 3;
            switch (packet.length) {
            case 0:
            case 1:
                throw "Unexpected packet length";
                
            case 2:
                bytes = 1;
                break;
            
            case 3:
                bytes = 2;
                break;
            }
            
            while (packet.length < 4) {
                packet += "A";  // zero padding;
            }

            var bits = 0;
            for (var j = 0; j < packet.length; ++j)
            {
                var val = decode[packet[j]];
                if (val === undefined) {
                    throw "Unexpected character";
                }
                
                bits <<= 6;
                bits |= val;
            }
            
            var shift = 16;
            while (bytes > 0) {
                result[resultIndex++] = (bits >> shift) & 0xff;
                bytes--;
                shift -= 8;
            }
        }
        
        return result;
    }
};
