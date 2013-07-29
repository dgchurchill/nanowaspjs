
import re
import os
from collections import namedtuple, OrderedDict

Opcode = namedtuple('Opcode', 'byte, mnemonic, operand')

def parse_line(l):
	parts = l.split(None, 1)
	byte = int(parts[0], 16)
	
	if len(parts) == 1:
		return Opcode(byte, 'fallthrough', '')
	
	format = parts[1]
	operand_match = re.search('[a-z]+', format)
	if operand_match is not None:
		operand = operand_match.group(0)
		format = format[:operand_match.start(0)] + '{}' + format[operand_match.end(0):]
	else:
		operand = ''
		
	return Opcode(byte, format, operand)
	
	
def opcodes(filename):
	buffer = []

	with open(filename) as f:
		for line in f:
			line = line.strip()
			if line.startswith('#') or len(line) == 0:
				continue
			
			opcode = parse_line(line)
			
			if opcode.mnemonic == 'fallthrough':
				buffer.append(opcode)
			else:
				while len(buffer) > 0:
					yield Opcode(buffer.pop(0).byte, opcode.mnemonic, opcode.operand)
				yield opcode


def make_js_dict(name, opcodes, register=None):
	def format_opcode(o):
		if o.operand == 'shift':
			return '{}: opcodes_{}'.format(o.byte, name + hex(o.byte)[2:])
		else:
			mnemonic = o.mnemonic
			if register is not None:
				mnemonic = mnemonic.replace('REGISTER', register)
			return '{}: ["{}", "{}"]'.format(o.byte, mnemonic, o.operand) 

	if name == '':
		print 'opcodes = {'
	else:
		print 'opcodes_' + name + ' = {'
	print '    ' + ',\n    '.join(format_opcode(o) for o in opcodes)
	print '};'


# Ordered so that the generated JavaScript dictionaries have
# no forward references.
opcode_sets = OrderedDict([
	('ddcb', ('opcodes_ddfdcb.dat', 'IX')),
	('fdcb', ('opcodes_ddfdcb.dat', 'IY')),
	('cb', ('opcodes_cb.dat', None)),
	('dd', ('opcodes_ddfd.dat', 'IX')),
	('ed', ('opcodes_ed.dat', None)),
	('fd', ('opcodes_ddfd.dat', 'IY')),
	('', ('opcodes_base.dat', ''))
])

operands = set()
source_dir = os.path.dirname(__file__)

for opcode_set in opcode_sets.iteritems():
	filename = os.path.join(source_dir, opcode_set[1][0])
	ocs = list(opcodes(filename))
	operands.update(x.operand for x in ocs)
	make_js_dict(opcode_set[0], ocs, opcode_set[1][1])
	print

#print operands
