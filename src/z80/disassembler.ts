
import { opcodes } from './disassembler_dicts'
import { Z80 } from './z80'

export function hexString(n: number, length: number) {
    var result = n.toString(16).toUpperCase();
    while (result.length < length) {
        result = '0' + result;
    }

    return result + 'h';
}

export function disassemble(z80: Z80, address: number, count: number) {
    var result = "";
    
    for (var i = 0; i < count; ++i)
    {
        if (address > 65530) {
            // Avoid reading past end of memory
            return result;
        }
        
        var table: any = opcodes;
        while (true) {
            var opcode = z80.readbyte_internal(address++);
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
                operand = hexString(z80.readbyte_internal(address++), 2);
                break;
                
            case 'nnnn':
                operand = hexString(z80.readbyte_internal(address) + 256 * z80.readbyte_internal(address + 1), 4);
                address += 2;
                break;
            }
            
            result += mnemonic.replace('{}', operand) + "\n";
            break;
        }
    }
    
    return result;
}