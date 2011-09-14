
function hexString(n, length) {
    var result = n.toString(16).toUpperCase();
    while (result.length < length) {
        result = '0' + result;
    }

    return result + 'h';
}

function disassemble(address, count) {
    var result = "";
    
    for (var i = 0; i < count; ++i)
    {
        if (address > 65530) {
            // Avoid reading past end of memory
            return result;
        }
        
        var table = opcodes;
        while (true) {
            var opcode = readbyte_internal(address++);
            var entry = table[opcode];
            
            if (entry == undefined) {
                return "unknown";
            }
            
            if (entry.constructor != Array) {
                table = entry;
                continue;
            }
            
            var mnemonic = entry[0];
            var operand = entry[1];
            
            // TODO: Proper sign for operands; calculate actual addresses for relative jumps.
            switch (operand) {
            case 'nn':
            case 'dd':
            case 'offset':
                operand = hexString(readbyte_internal(address++), 2);
                break;
                
            case 'nnnn':
                operand = hexString(readbyte_internal(address) + 256 * readbyte_internal(address + 1), 4);
                address += 2;
                break;
            }
            
            result += mnemonic.replace('{}', operand) + "\n";
            break;
        }
    }
    
    return result;
}