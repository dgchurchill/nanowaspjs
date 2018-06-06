/*! z80.jscpp: z80 supplementary functions
   Copyright (c) 1999-2008 Philip Kendall, Matthew Westcott

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
	
	Contact details: <matthew@west.co.tt>
	Matthew Westcott, 14 Daisy Hill Drive, Adlington, Chorley, Lancs PR6 9NE UNITED KINGDOM
*/


/* z80_macros.jscpp: Some commonly used z80 things as macros
   Copyright (c) 1999-2008 Philip Kendall, Matthew Westcott

   $Id$

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
	
	Contact details: <matthew@west.co.tt>
	Matthew Westcott, 14 Daisy Hill Drive, Adlington, Chorley, Lancs PR6 9NE UNITED KINGDOM
*/




/* Macros used for accessing the registers */






































































/* The flags */



/* Get the appropriate contended memory delay. Use this macro later
   to avoid a function call if memory contention is disabled */
/* #define contend(address,time) z80.tstates += contend_memory( (address) ) + (time); */
/* #define contend_io(port,time) z80.tstates += contend_port( (port) ) + (time); */



/* Some commonly used instructions */


















/* Macro for the {DD,FD} CB dd xx rotate/shift instructions */























































































































































/* speed tweaks */
/* #define readbyte readbyte_internal */
//#define readbyte_internal(b) memory[b]





/* Whether a half carry occured or not can be determined by looking at
   the 3rd bit of the two arguments and the result; these are hashed
   into this table in the form r12, where r is the 3rd bit of the
   result, 1 is the 3rd bit of the 1st argument and 2 is the
   third bit of the 2nd argument; the tables differ for add and subtract
   operations */
var halfcarry_add_table = [ 0, 0x10, 0x10, 0x10, 0, 0, 0, 0x10 ];
var halfcarry_sub_table = [ 0, 0, 0x10, 0, 0x10, 0, 0x10, 0x10 ];

/* Similarly, overflow can be determined by looking at the 7th bits; again
   the hash into this table is r12 */
var overflow_add_table = [ 0, 0, 0, 0x04, 0x04, 0, 0, 0 ];
var overflow_sub_table = [ 0, 0x04, 0, 0, 0, 0, 0x04, 0 ];

/* Some more tables; initialised in z80_init_tables() */

var sz53_table: number[] = []; /* The S, Z, 5 and 3 bits of the index */
var parity_table: number[] = []; /* The parity of the lookup value */
var sz53p_table: number[] = []; /* OR the above two tables together */

/* This is what everything acts on! */
export interface Z80 {
	a: number;
  f: number;
  b: number;
  c: number;
  d: number;
  e: number;
  h: number;
  l: number;
	a_: number;
  f_: number;
  b_: number;
  c_: number;
  d_: number;
  e_: number;
  h_: number;
  l_: number;
	ixh: number;
  ixl: number;
  iyh: number;
  iyl: number;
  i: number;

  /* The low seven bits of the R register. 16 bits long
		 so it can also act as an RZX instruction counter */
  r: number; 

  /* The high bit of the R register */
  r7: number;

	sp: number;
  pc: number;
  iff1: number;
  iff2: number;
  im: number;
  halted: boolean;

  tstates: number;

  readbyte_internal: (address: number) => number;
  writebyte_internal: (address: number, value: number) => void;
  readport: (address: number) => number;
  writeport: (address: number, value: number) => void;

  breakpoints: { [address: number]: () => void };
}

/* Initalise the tables used to set flags */
(function () {
  var i,j,k;
  var parity;

  for(i=0;i<0x100;i++) {
    sz53_table[i]= i & ( 0x08 | 0x20 | 0x80 );
    j=i; parity=0;
    for(k=0;k<8;k++) { parity ^= j & 1; j >>=1; }
    parity_table[i]= ( parity ? 0 : 0x04 );
    sz53p_table[i] = sz53_table[i] | parity_table[i];
  }

  sz53_table[0]  |= 0x40;
  sz53p_table[0] |= 0x40;

})();

export function z80_init(
    readbyte_internal: (address: number) => number,
    writebyte_internal: (address: number, value: number) => void,
    readport: (address: number) => number,
    writeport: (address: number, value: number) => void): Z80 {

    let z80 = {} as Z80;
    z80_reset(z80);
    z80_clear_breakpoints(z80);
    z80.readbyte_internal = readbyte_internal;
    z80.writebyte_internal = writebyte_internal;
    z80.readport = readport;
    z80.writeport = writeport;
    return z80;
}

/* Reset the z80 */
export function z80_reset(z80: Z80) {
  z80.a =z80.f =z80.b =z80.c =z80.d =z80.e =z80.h =z80.l =0;
  z80.a_ =z80.f_ =z80.b_ =z80.c_ =z80.d_ =z80.e_=z80.h_ =z80.l_=0;
  z80.ixh=z80.ixl=z80.iyh=z80.iyl=0;
  z80.i=z80.r=z80.r7=0;
  z80.sp=z80.pc=0;
  z80.iff1=z80.iff2=z80.im=0;
  z80.halted=false;
  z80_clear_breakpoints(z80);
}

/* Process a z80 maskable interrupt */
function z80_interrupt(z80: Z80) {
  /* Process if IFF1 set && (if a Timex machine, SCLD INTDISABLE is clear) */
  if( z80.iff1 ) {
    
    if( z80.halted ) { z80.pc++; z80.pc &= 0xffff; z80.halted = false; }
    
    z80.iff1=z80.iff2=0;

    z80.sp = (z80.sp - 1) & 0xffff;
    z80.writebyte_internal( z80.sp, (z80.pc >> 8) );
    z80.sp = (z80.sp - 1) & 0xffff;
    z80.writebyte_internal( z80.sp, (z80.pc & 0xff) );

    z80.r = (z80.r+1) & 0x7f; /* rzx_instructions_offset--; */

    switch(z80.im) {
      case 0: z80.pc = 0x0038; z80.tstates+=12; break;
      case 1: z80.pc = 0x0038; z80.tstates+=13; break;
      case 2: 
	{
	  var inttemp=(0x100*z80.i)+0xff;
	  var pcl = z80.readbyte_internal(inttemp++); inttemp &= 0xfff; var pch = z80.readbyte_internal(inttemp);
	  z80.pc = pcl | (pch << 8);
	  z80.tstates+=19;
	  break;
	}
      default:
          throw new Error("Unknown interrupt mode " + z80.im);
    }
  }
}

/* Process a z80 non-maskable interrupt */
function z80_nmi(z80: Z80) {
  /* FIXME: what happens if the z80 is HALTed? */

  z80.iff1 = 0;

  z80.sp = (z80.sp - 1) & 0xffff;
  z80.writebyte_internal( z80.sp, (z80.pc >> 8) );
  z80.sp = (z80.sp - 1) & 0xffff;
  z80.writebyte_internal( z80.sp, (z80.pc & 0xff) );

  /* FIXME: how is R affected? */

  /* FIXME: how does contention apply here? */
  z80.tstates += 11; z80.pc = 0x0066;
}


/* z80_ops.jscpp: Process the next opcode
   Copyright (c) 1999-2008 Philip Kendall, Witold Filipczyk, Matthew Westcott

   $Id$

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
	
	Contact details: <matthew@west.co.tt>
	Matthew Westcott, 14 Daisy Hill Drive, Adlington, Chorley, Lancs PR6 9NE UNITED KINGDOM
*/



function sign_extend(v: number) {
  return v < 128 ? v : v-256;
}

export function z80_set_breakpoint(z80: Z80, location: number, handler: () => void) {
    z80.breakpoints[location] = handler;
}

export function z80_clear_breakpoints(z80: Z80) {
    z80.breakpoints = {};
}

export function z80_ret(z80: Z80) {
    { { z80.tstates += (3);; var lowbyte =z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; var highbyte=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};};
}

/* Execute Z80 opcodes until the next event */
export function z80_do_opcodes(z80: Z80, event_next_event: number)
{

  while(z80.tstates < event_next_event ) {

    var opcode;
    var wordtemp;

    /* Do the instruction fetch; readbyte_internal used here to avoid
       triggering read breakpoints */
    
    var breakpoint = z80.breakpoints[z80.pc];
    if (breakpoint != null) {
        breakpoint();
    }

    z80.tstates += ( 4 );; z80.r = (z80.r+1) & 0x7f;
    opcode = z80.readbyte_internal( z80.pc++ ); z80.pc &= 0xffff;

    switch(opcode) {

/* opcodes_base.c: unshifted Z80 opcodes
   Copyright (c) 1999-2008 Philip Kendall, Matthew Westcott

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
	
	Contact details: <matthew@west.co.tt>
	Matthew Westcott, 14 Daisy Hill Drive, Adlington, Chorley, Lancs PR6 9NE UNITED KINGDOM

*/

/* NB: this file is autogenerated by 'z80.pl' from 'opcodes_base.dat',
   and included in 'z80_ops.jscpp' */

    case 0x00:		/* NOP */
      break;
    case 0x01:		/* LD BC,nnnn */
      z80.tstates += ( 3 );;
      z80.c=z80.readbyte_internal(z80.pc++);
      z80.pc &= 0xffff;
      z80.tstates += ( 3 );;
      z80.b=z80.readbyte_internal(z80.pc++);
      z80.pc &= 0xffff;
      break;
    case 0x02:		/* LD (BC),A */
      z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.c | (z80.b << 8)),z80.a);
      break;
    case 0x03:		/* INC BC */
      z80.tstates += 2;
      wordtemp = ((z80.c | (z80.b << 8)) + 1) & 0xffff;
      z80.b = wordtemp >> 8;
      z80.c = wordtemp & 0xff;
      break;
    case 0x04:		/* INC B */
      { (z80.b) = ((z80.b) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.b)==0x80 ? 0x04 : 0 ) | ( (z80.b)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.b)];};
      break;
    case 0x05:		/* DEC B */
      { z80.f = ( z80.f & 0x01 ) | ( (z80.b)&0x0f ? 0 : 0x10 ) | 0x02; (z80.b) = ((z80.b) - 1) & 0xff; z80.f |= ( (z80.b)==0x7f ? 0x04 : 0 ) | sz53_table[z80.b];};
      break;
    case 0x06:		/* LD B,nn */
      z80.tstates += ( 3 );;
      z80.b=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff;
      break;
    case 0x07:		/* RLCA */
      z80.a = ( (z80.a & 0x7f) << 1 ) | ( z80.a >> 7 );
      z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) |
	( z80.a & ( 0x01 | 0x08 | 0x20 ) );
      break;
    case 0x08:		/* EX AF,AF' */
      {
      	var olda = z80.a; var oldf = z80.f;
      	z80.a = z80.a_; z80.f = z80.f_;
      	z80.a_ = olda; z80.f_ = oldf;
      }
      break;
    case 0x09:		/* ADD HL,BC */
      { let add16temp = ((z80.l | (z80.h << 8))) + ((z80.c | (z80.b << 8))); var lookup = ( ( ((z80.l | (z80.h << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.c | (z80.b << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); z80.tstates += 7; (z80.h) = (add16temp >> 8) & 0xff; (z80.l) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x0a:		/* LD A,(BC) */
      z80.tstates += ( 3 );;
      z80.a=z80.readbyte_internal((z80.c | (z80.b << 8)));
      break;
    case 0x0b:		/* DEC BC */
      z80.tstates += 2;
      wordtemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff;
      z80.b = wordtemp >> 8;
      z80.c = wordtemp & 0xff;
      break;
    case 0x0c:		/* INC C */
      { (z80.c) = ((z80.c) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.c)==0x80 ? 0x04 : 0 ) | ( (z80.c)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.c)];};
      break;
    case 0x0d:		/* DEC C */
      { z80.f = ( z80.f & 0x01 ) | ( (z80.c)&0x0f ? 0 : 0x10 ) | 0x02; (z80.c) = ((z80.c) - 1) & 0xff; z80.f |= ( (z80.c)==0x7f ? 0x04 : 0 ) | sz53_table[z80.c];};
      break;
    case 0x0e:		/* LD C,nn */
      z80.tstates += ( 3 );;
      z80.c=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff;
      break;
    case 0x0f:		/* RRCA */
      z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( z80.a & 0x01 );
      z80.a = ( z80.a >> 1) | ( (z80.a & 0x01) << 7 );
      z80.f |= ( z80.a & ( 0x08 | 0x20 ) );
      break;
    case 0x10:		/* DJNZ offset */
      z80.tstates++; z80.tstates += ( 3 );;
      z80.b = (z80.b-1) & 0xff;
      if(z80.b) { { z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.pc += sign_extend(z80.readbyte_internal( z80.pc )); z80.pc &= 0xffff; }; }
      z80.pc++;
      z80.pc &= 0xffff;
      break;
    case 0x11:		/* LD DE,nnnn */
      z80.tstates += ( 3 );;
      z80.e=z80.readbyte_internal(z80.pc++);
      z80.pc &= 0xffff;
      z80.tstates += ( 3 );;
      z80.d=z80.readbyte_internal(z80.pc++);
      z80.pc &= 0xffff;
      break;
    case 0x12:		/* LD (DE),A */
      z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.e | (z80.d << 8)),z80.a);
      break;
    case 0x13:		/* INC DE */
      z80.tstates += 2;
      wordtemp = ((z80.e | (z80.d << 8)) + 1) & 0xffff;
      z80.d = wordtemp >> 8;
      z80.e = wordtemp & 0xff;
      break;
    case 0x14:		/* INC D */
      { (z80.d) = ((z80.d) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.d)==0x80 ? 0x04 : 0 ) | ( (z80.d)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.d)];};
      break;
    case 0x15:		/* DEC D */
      { z80.f = ( z80.f & 0x01 ) | ( (z80.d)&0x0f ? 0 : 0x10 ) | 0x02; (z80.d) = ((z80.d) - 1) & 0xff; z80.f |= ( (z80.d)==0x7f ? 0x04 : 0 ) | sz53_table[z80.d];};
      break;
    case 0x16:		/* LD D,nn */
      z80.tstates += ( 3 );;
      z80.d=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff;
      break;
    case 0x17:		/* RLA */
      {
	let bytetemp = z80.a;
	z80.a = ( (z80.a & 0x7f) << 1 ) | ( z80.f & 0x01 );
	z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) |
	  ( z80.a & ( 0x08 | 0x20 ) ) | ( bytetemp >> 7 );
      }
      break;
    case 0x18:		/* JR offset */
      z80.tstates += ( 3 );;
      { z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.pc += sign_extend(z80.readbyte_internal( z80.pc )); z80.pc &= 0xffff; };
      z80.pc++; z80.pc &= 0xffff;
      break;
    case 0x19:		/* ADD HL,DE */
      { let add16temp = ((z80.l | (z80.h << 8))) + ((z80.e | (z80.d << 8))); var lookup = ( ( ((z80.l | (z80.h << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.e | (z80.d << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); z80.tstates += 7; (z80.h) = (add16temp >> 8) & 0xff; (z80.l) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x1a:		/* LD A,(DE) */
      z80.tstates += ( 3 );;
      z80.a=z80.readbyte_internal((z80.e | (z80.d << 8)));
      break;
    case 0x1b:		/* DEC DE */
      z80.tstates += 2;
      wordtemp = ((z80.e | (z80.d << 8)) - 1) & 0xffff;
      z80.d = wordtemp >> 8;
      z80.e = wordtemp & 0xff;
      break;
    case 0x1c:		/* INC E */
      { (z80.e) = ((z80.e) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.e)==0x80 ? 0x04 : 0 ) | ( (z80.e)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.e)];};
      break;
    case 0x1d:		/* DEC E */
      { z80.f = ( z80.f & 0x01 ) | ( (z80.e)&0x0f ? 0 : 0x10 ) | 0x02; (z80.e) = ((z80.e) - 1) & 0xff; z80.f |= ( (z80.e)==0x7f ? 0x04 : 0 ) | sz53_table[z80.e];};
      break;
    case 0x1e:		/* LD E,nn */
      z80.tstates += ( 3 );;
      z80.e=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff;
      break;
    case 0x1f:		/* RRA */
      {
	let bytetemp = z80.a;
	z80.a = ( z80.a >> 1 ) | ( (z80.f & 0x01) << 7 );
	z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) |
	  ( z80.a & ( 0x08 | 0x20 ) ) | ( bytetemp & 0x01 ) ;
      }
      break;
    case 0x20:		/* JR NZ,offset */
      z80.tstates += ( 3 );;
      if( ! ( z80.f & 0x40 ) ) { { z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.pc += sign_extend(z80.readbyte_internal( z80.pc )); z80.pc &= 0xffff; }; }
      z80.pc++; z80.pc &= 0xffff;
      break;
    case 0x21:		/* LD HL,nnnn */
      z80.tstates += ( 3 );;
      z80.l=z80.readbyte_internal(z80.pc++);
      z80.pc &= 0xffff;
      z80.tstates += ( 3 );;
      z80.h=z80.readbyte_internal(z80.pc++);
      z80.pc &= 0xffff;
      break;
    case 0x22:		/* LD (nnnn),HL */
      { var ldtemp; z80.tstates += (3);; ldtemp=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (3);; ldtemp|=z80.readbyte_internal(z80.pc++) << 8; z80.pc &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(ldtemp++,(z80.l)); ldtemp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(ldtemp,(z80.h));};
      break;
    case 0x23:		/* INC HL */
      z80.tstates += 2;
      wordtemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff;
      z80.h = wordtemp >> 8;
      z80.l = wordtemp & 0xff;
      break;
    case 0x24:		/* INC H */
      { (z80.h) = ((z80.h) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.h)==0x80 ? 0x04 : 0 ) | ( (z80.h)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.h)];};
      break;
    case 0x25:		/* DEC H */
      { z80.f = ( z80.f & 0x01 ) | ( (z80.h)&0x0f ? 0 : 0x10 ) | 0x02; (z80.h) = ((z80.h) - 1) & 0xff; z80.f |= ( (z80.h)==0x7f ? 0x04 : 0 ) | sz53_table[z80.h];};
      break;
    case 0x26:		/* LD H,nn */
      z80.tstates += ( 3 );;
      z80.h=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff;
      break;
    case 0x27:		/* DAA */
      {
	var add = 0, carry = ( z80.f & 0x01 );
	if( ( z80.f & 0x10 ) || ( (z80.a & 0x0f)>9 ) ) add=6;
	if( carry || (z80.a > 0x99 ) ) add|=0x60;
	if( z80.a > 0x99 ) carry=0x01;
	if ( z80.f & 0x02 ) {
	  { var subtemp = z80.a - (add); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (add) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
	} else {
	  { var addtemp = z80.a + (add); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (add) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
	}
	z80.f = ( z80.f & ~( 0x01 | 0x04) ) | carry | parity_table[z80.a];
      }
      break;
    case 0x28:		/* JR Z,offset */
      z80.tstates += ( 3 );;
      if( z80.f & 0x40 ) { { z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.pc += sign_extend(z80.readbyte_internal( z80.pc )); z80.pc &= 0xffff; }; }
      z80.pc++; z80.pc &= 0xffff;
      break;
    case 0x29:		/* ADD HL,HL */
      { let add16temp = ((z80.l | (z80.h << 8))) + ((z80.l | (z80.h << 8))); var lookup = ( ( ((z80.l | (z80.h << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.l | (z80.h << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); z80.tstates += 7; (z80.h) = (add16temp >> 8) & 0xff; (z80.l) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x2a:		/* LD HL,(nnnn) */
      { var ldtemp; z80.tstates += (3);; ldtemp=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (3);; ldtemp|=z80.readbyte_internal(z80.pc++) << 8; z80.pc &= 0xffff; z80.tstates += (3);; (z80.l)=z80.readbyte_internal(ldtemp++); ldtemp &= 0xffff; z80.tstates += (3);; (z80.h)=z80.readbyte_internal(ldtemp);};
      break;
    case 0x2b:		/* DEC HL */
      z80.tstates += 2;
      wordtemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff;
      z80.h = wordtemp >> 8;
      z80.l = wordtemp & 0xff;
      break;
    case 0x2c:		/* INC L */
      { (z80.l) = ((z80.l) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.l)==0x80 ? 0x04 : 0 ) | ( (z80.l)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.l)];};
      break;
    case 0x2d:		/* DEC L */
      { z80.f = ( z80.f & 0x01 ) | ( (z80.l)&0x0f ? 0 : 0x10 ) | 0x02; (z80.l) = ((z80.l) - 1) & 0xff; z80.f |= ( (z80.l)==0x7f ? 0x04 : 0 ) | sz53_table[z80.l];};
      break;
    case 0x2e:		/* LD L,nn */
      z80.tstates += ( 3 );;
      z80.l=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff;
      break;
    case 0x2f:		/* CPL */
      z80.a ^= 0xff;
      z80.f = ( z80.f & ( 0x01 | 0x04 | 0x40 | 0x80 ) ) |
	( z80.a & ( 0x08 | 0x20 ) ) | ( 0x02 | 0x10 );
      break;
    case 0x30:		/* JR NC,offset */
      z80.tstates += ( 3 );;
      if( ! ( z80.f & 0x01 ) ) { { z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.pc += sign_extend(z80.readbyte_internal( z80.pc )); z80.pc &= 0xffff; }; }
      z80.pc++; z80.pc &= 0xffff;
      break;
    case 0x31:		/* LD SP,nnnn */
      z80.tstates += ( 3 );;
      var splow = z80.readbyte_internal(z80.pc++);
      z80.pc &= 0xffff;
      z80.tstates += ( 3 );;
      var sphigh=z80.readbyte_internal(z80.pc++);
      z80.sp = splow | (sphigh << 8);
      z80.pc &= 0xffff;
      break;
    case 0x32:		/* LD (nnnn),A */
      z80.tstates += ( 3 );;
      {
	wordtemp = z80.readbyte_internal( z80.pc++ );
	z80.pc &= 0xffff;
	z80.tstates += ( 3 );;
	wordtemp|=z80.readbyte_internal(z80.pc++) << 8;
	z80.pc &= 0xffff;
	z80.tstates += ( 3 );;
	z80.writebyte_internal(wordtemp,z80.a);
      }
      break;
    case 0x33:		/* INC SP */
      z80.tstates += 2;
      z80.sp = (z80.sp + 1) & 0xffff;
      break;
    case 0x34:		/* INC (HL) */
      z80.tstates += ( 4 );;
      {
	let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	{ (bytetemp) = ((bytetemp) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (bytetemp)==0x80 ? 0x04 : 0 ) | ( (bytetemp)&0x0f ? 0 : 0x10 ) | sz53_table[(bytetemp)];};
	z80.tstates += ( 3 );;
	z80.writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x35:		/* DEC (HL) */
      z80.tstates += ( 4 );;
      {
	let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	{ z80.f = ( z80.f & 0x01 ) | ( (bytetemp)&0x0f ? 0 : 0x10 ) | 0x02; (bytetemp) = ((bytetemp) - 1) & 0xff; z80.f |= ( (bytetemp)==0x7f ? 0x04 : 0 ) | sz53_table[bytetemp];};
	z80.tstates += ( 3 );;
	z80.writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x36:		/* LD (HL),nn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)),z80.readbyte_internal(z80.pc++));
      z80.pc &= 0xffff;
      break;
    case 0x37:		/* SCF */
      z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) |
        ( z80.a & ( 0x08 | 0x20          ) ) |
        0x01;
      break;
    case 0x38:		/* JR C,offset */
      z80.tstates += ( 3 );;
      if( z80.f & 0x01 ) { { z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.tstates += (1);; z80.pc += sign_extend(z80.readbyte_internal( z80.pc )); z80.pc &= 0xffff; }; }
      z80.pc++; z80.pc &= 0xffff;
      break;
    case 0x39:		/* ADD HL,SP */
      { let add16temp = ((z80.l | (z80.h << 8))) + (z80.sp); var lookup = ( ( ((z80.l | (z80.h << 8))) & 0x0800 ) >> 11 ) | ( ( (z80.sp) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); z80.tstates += 7; (z80.h) = (add16temp >> 8) & 0xff; (z80.l) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x3a:		/* LD A,(nnnn) */
      {
	z80.tstates += ( 3 );;
	wordtemp = z80.readbyte_internal(z80.pc++);
	z80.pc &= 0xffff;
	z80.tstates += ( 3 );;
	wordtemp|= ( z80.readbyte_internal(z80.pc++) << 8 );
	z80.pc &= 0xffff;
	z80.tstates += ( 3 );;
	z80.a=z80.readbyte_internal(wordtemp);
      }
      break;
    case 0x3b:		/* DEC SP */
      z80.tstates += 2;
      z80.sp = (z80.sp - 1) & 0xffff;
      break;
    case 0x3c:		/* INC A */
      { (z80.a) = ((z80.a) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.a)==0x80 ? 0x04 : 0 ) | ( (z80.a)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.a)];};
      break;
    case 0x3d:		/* DEC A */
      { z80.f = ( z80.f & 0x01 ) | ( (z80.a)&0x0f ? 0 : 0x10 ) | 0x02; (z80.a) = ((z80.a) - 1) & 0xff; z80.f |= ( (z80.a)==0x7f ? 0x04 : 0 ) | sz53_table[z80.a];};
      break;
    case 0x3e:		/* LD A,nn */
      z80.tstates += ( 3 );;
      z80.a=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff;
      break;
    case 0x3f:		/* CCF */
      z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) |
	( ( z80.f & 0x01 ) ? 0x10 : 0x01 ) | ( z80.a & ( 0x08 | 0x20 ) );
      break;
    case 0x40:		/* LD B,B */
      break;
    case 0x41:		/* LD B,C */
      z80.b=z80.c;
      break;
    case 0x42:		/* LD B,D */
      z80.b=z80.d;
      break;
    case 0x43:		/* LD B,E */
      z80.b=z80.e;
      break;
    case 0x44:		/* LD B,H */
      z80.b=z80.h;
      break;
    case 0x45:		/* LD B,L */
      z80.b=z80.l;
      break;
    case 0x46:		/* LD B,(HL) */
      z80.tstates += ( 3 );;
      z80.b=z80.readbyte_internal((z80.l | (z80.h << 8)));
      break;
    case 0x47:		/* LD B,A */
      z80.b=z80.a;
      break;
    case 0x48:		/* LD C,B */
      z80.c=z80.b;
      break;
    case 0x49:		/* LD C,C */
      break;
    case 0x4a:		/* LD C,D */
      z80.c=z80.d;
      break;
    case 0x4b:		/* LD C,E */
      z80.c=z80.e;
      break;
    case 0x4c:		/* LD C,H */
      z80.c=z80.h;
      break;
    case 0x4d:		/* LD C,L */
      z80.c=z80.l;
      break;
    case 0x4e:		/* LD C,(HL) */
      z80.tstates += ( 3 );;
      z80.c=z80.readbyte_internal((z80.l | (z80.h << 8)));
      break;
    case 0x4f:		/* LD C,A */
      z80.c=z80.a;
      break;
    case 0x50:		/* LD D,B */
      z80.d=z80.b;
      break;
    case 0x51:		/* LD D,C */
      z80.d=z80.c;
      break;
    case 0x52:		/* LD D,D */
      break;
    case 0x53:		/* LD D,E */
      z80.d=z80.e;
      break;
    case 0x54:		/* LD D,H */
      z80.d=z80.h;
      break;
    case 0x55:		/* LD D,L */
      z80.d=z80.l;
      break;
    case 0x56:		/* LD D,(HL) */
      z80.tstates += ( 3 );;
      z80.d=z80.readbyte_internal((z80.l | (z80.h << 8)));
      break;
    case 0x57:		/* LD D,A */
      z80.d=z80.a;
      break;
    case 0x58:		/* LD E,B */
      z80.e=z80.b;
      break;
    case 0x59:		/* LD E,C */
      z80.e=z80.c;
      break;
    case 0x5a:		/* LD E,D */
      z80.e=z80.d;
      break;
    case 0x5b:		/* LD E,E */
      break;
    case 0x5c:		/* LD E,H */
      z80.e=z80.h;
      break;
    case 0x5d:		/* LD E,L */
      z80.e=z80.l;
      break;
    case 0x5e:		/* LD E,(HL) */
      z80.tstates += ( 3 );;
      z80.e=z80.readbyte_internal((z80.l | (z80.h << 8)));
      break;
    case 0x5f:		/* LD E,A */
      z80.e=z80.a;
      break;
    case 0x60:		/* LD H,B */
      z80.h=z80.b;
      break;
    case 0x61:		/* LD H,C */
      z80.h=z80.c;
      break;
    case 0x62:		/* LD H,D */
      z80.h=z80.d;
      break;
    case 0x63:		/* LD H,E */
      z80.h=z80.e;
      break;
    case 0x64:		/* LD H,H */
      break;
    case 0x65:		/* LD H,L */
      z80.h=z80.l;
      break;
    case 0x66:		/* LD H,(HL) */
      z80.tstates += ( 3 );;
      z80.h=z80.readbyte_internal((z80.l | (z80.h << 8)));
      break;
    case 0x67:		/* LD H,A */
      z80.h=z80.a;
      break;
    case 0x68:		/* LD L,B */
      z80.l=z80.b;
      break;
    case 0x69:		/* LD L,C */
      z80.l=z80.c;
      break;
    case 0x6a:		/* LD L,D */
      z80.l=z80.d;
      break;
    case 0x6b:		/* LD L,E */
      z80.l=z80.e;
      break;
    case 0x6c:		/* LD L,H */
      z80.l=z80.h;
      break;
    case 0x6d:		/* LD L,L */
      break;
    case 0x6e:		/* LD L,(HL) */
      z80.tstates += ( 3 );;
      z80.l=z80.readbyte_internal((z80.l | (z80.h << 8)));
      break;
    case 0x6f:		/* LD L,A */
      z80.l=z80.a;
      break;
    case 0x70:		/* LD (HL),B */
      z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)),z80.b);
      break;
    case 0x71:		/* LD (HL),C */
      z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)),z80.c);
      break;
    case 0x72:		/* LD (HL),D */
      z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)),z80.d);
      break;
    case 0x73:		/* LD (HL),E */
      z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)),z80.e);
      break;
    case 0x74:		/* LD (HL),H */
      z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)),z80.h);
      break;
    case 0x75:		/* LD (HL),L */
      z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)),z80.l);
      break;
    case 0x76:		/* HALT */
      z80.halted=true;
      z80.pc--;z80.pc &= 0xffff;
      break;
    case 0x77:		/* LD (HL),A */
      z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)),z80.a);
      break;
    case 0x78:		/* LD A,B */
      z80.a=z80.b;
      break;
    case 0x79:		/* LD A,C */
      z80.a=z80.c;
      break;
    case 0x7a:		/* LD A,D */
      z80.a=z80.d;
      break;
    case 0x7b:		/* LD A,E */
      z80.a=z80.e;
      break;
    case 0x7c:		/* LD A,H */
      z80.a=z80.h;
      break;
    case 0x7d:		/* LD A,L */
      z80.a=z80.l;
      break;
    case 0x7e:		/* LD A,(HL) */
      z80.tstates += ( 3 );;
      z80.a=z80.readbyte_internal((z80.l | (z80.h << 8)));
      break;
    case 0x7f:		/* LD A,A */
      break;
    case 0x80:		/* ADD A,B */
      { var addtemp = z80.a + (z80.b); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.b) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x81:		/* ADD A,C */
      { var addtemp = z80.a + (z80.c); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.c) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x82:		/* ADD A,D */
      { var addtemp = z80.a + (z80.d); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.d) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x83:		/* ADD A,E */
      { var addtemp = z80.a + (z80.e); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.e) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x84:		/* ADD A,H */
      { var addtemp = z80.a + (z80.h); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.h) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x85:		/* ADD A,L */
      { var addtemp = z80.a + (z80.l); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.l) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x86:		/* ADD A,(HL) */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	{ var addtemp = z80.a + (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x87:		/* ADD A,A */
      { var addtemp = z80.a + (z80.a); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.a) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x88:		/* ADC A,B */
      { var adctemp = z80.a + (z80.b) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.b) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x89:		/* ADC A,C */
      { var adctemp = z80.a + (z80.c) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.c) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8a:		/* ADC A,D */
      { var adctemp = z80.a + (z80.d) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.d) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8b:		/* ADC A,E */
      { var adctemp = z80.a + (z80.e) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.e) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8c:		/* ADC A,H */
      { var adctemp = z80.a + (z80.h) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.h) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8d:		/* ADC A,L */
      { var adctemp = z80.a + (z80.l) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.l) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8e:		/* ADC A,(HL) */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	{ var adctemp = z80.a + (bytetemp) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x8f:		/* ADC A,A */
      { var adctemp = z80.a + (z80.a) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.a) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x90:		/* SUB A,B */
      { var subtemp = z80.a - (z80.b); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.b) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x91:		/* SUB A,C */
      { var subtemp = z80.a - (z80.c); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.c) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x92:		/* SUB A,D */
      { var subtemp = z80.a - (z80.d); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.d) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x93:		/* SUB A,E */
      { var subtemp = z80.a - (z80.e); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.e) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x94:		/* SUB A,H */
      { var subtemp = z80.a - (z80.h); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.h) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x95:		/* SUB A,L */
      { var subtemp = z80.a - (z80.l); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.l) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x96:		/* SUB A,(HL) */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	{ var subtemp = z80.a - (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x97:		/* SUB A,A */
      { var subtemp = z80.a - (z80.a); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.a) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x98:		/* SBC A,B */
      { var sbctemp = z80.a - (z80.b) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.b) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x99:		/* SBC A,C */
      { var sbctemp = z80.a - (z80.c) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.c) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9a:		/* SBC A,D */
      { var sbctemp = z80.a - (z80.d) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.d) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9b:		/* SBC A,E */
      { var sbctemp = z80.a - (z80.e) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.e) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9c:		/* SBC A,H */
      { var sbctemp = z80.a - (z80.h) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.h) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9d:		/* SBC A,L */
      { var sbctemp = z80.a - (z80.l) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.l) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9e:		/* SBC A,(HL) */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	{ var sbctemp = z80.a - (bytetemp) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x9f:		/* SBC A,A */
      { var sbctemp = z80.a - (z80.a) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.a) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0xa0:		/* AND A,B */
      { z80.a &= (z80.b); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa1:		/* AND A,C */
      { z80.a &= (z80.c); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa2:		/* AND A,D */
      { z80.a &= (z80.d); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa3:		/* AND A,E */
      { z80.a &= (z80.e); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa4:		/* AND A,H */
      { z80.a &= (z80.h); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa5:		/* AND A,L */
      { z80.a &= (z80.l); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa6:		/* AND A,(HL) */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	{ z80.a &= (bytetemp); z80.f = 0x10 | sz53p_table[z80.a];};
      }
      break;
    case 0xa7:		/* AND A,A */
      { z80.a &= (z80.a); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa8:		/* XOR A,B */
      { z80.a ^= (z80.b); z80.f = sz53p_table[z80.a];};
      break;
    case 0xa9:		/* XOR A,C */
      { z80.a ^= (z80.c); z80.f = sz53p_table[z80.a];};
      break;
    case 0xaa:		/* XOR A,D */
      { z80.a ^= (z80.d); z80.f = sz53p_table[z80.a];};
      break;
    case 0xab:		/* XOR A,E */
      { z80.a ^= (z80.e); z80.f = sz53p_table[z80.a];};
      break;
    case 0xac:		/* XOR A,H */
      { z80.a ^= (z80.h); z80.f = sz53p_table[z80.a];};
      break;
    case 0xad:		/* XOR A,L */
      { z80.a ^= (z80.l); z80.f = sz53p_table[z80.a];};
      break;
    case 0xae:		/* XOR A,(HL) */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	{ z80.a ^= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xaf:		/* XOR A,A */
      { z80.a ^= (z80.a); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb0:		/* OR A,B */
      { z80.a |= (z80.b); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb1:		/* OR A,C */
      { z80.a |= (z80.c); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb2:		/* OR A,D */
      { z80.a |= (z80.d); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb3:		/* OR A,E */
      { z80.a |= (z80.e); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb4:		/* OR A,H */
      { z80.a |= (z80.h); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb5:		/* OR A,L */
      { z80.a |= (z80.l); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb6:		/* OR A,(HL) */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	{ z80.a |= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xb7:		/* OR A,A */
      { z80.a |= (z80.a); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb8:		/* CP B */
      { var cptemp = z80.a - z80.b; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.b) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.b & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xb9:		/* CP C */
      { var cptemp = z80.a - z80.c; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.c) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.c & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xba:		/* CP D */
      { var cptemp = z80.a - z80.d; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.d) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.d & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbb:		/* CP E */
      { var cptemp = z80.a - z80.e; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.e) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.e & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbc:		/* CP H */
      { var cptemp = z80.a - z80.h; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.h) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbd:		/* CP L */
      { var cptemp = z80.a - z80.l; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.l) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.l & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbe:		/* CP (HL) */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	{ var cptemp = z80.a - bytetemp; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( bytetemp & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      }
      break;
    case 0xbf:		/* CP A */
      { var cptemp = z80.a - z80.a; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.a) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.a & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xc0:		/* RET NZ */
      z80.tstates++;
      if( ! ( z80.f & 0x40 ) ) { { { z80.tstates += (3);; var lowbyte =z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; var highbyte=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xc1:		/* POP BC */
      { z80.tstates += (3);; (z80.c)=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; (z80.b)=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff;};
      break;
    case 0xc2:		/* JP NZ,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( ! ( z80.f & 0x40 ) ) { { var jptemp=z80.pc; var pcl =z80.readbyte_internal(jptemp++); jptemp &= 0xffff; var pch =z80.readbyte_internal(jptemp); z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xc3:		/* JP nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      { var jptemp=z80.pc; var pcl =z80.readbyte_internal(jptemp++); jptemp &= 0xffff; var pch =z80.readbyte_internal(jptemp); z80.pc = pcl | (pch << 8);};
      break;
    case 0xc4:		/* CALL NZ,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( ! ( z80.f & 0x40 ) ) { { var calltempl, calltemph; calltempl=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (1);; calltemph=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xc5:		/* PUSH BC */
      z80.tstates++;
      { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.b)); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.c));};
      break;
    case 0xc6:		/* ADD A,nn */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( z80.pc++ );
	{ var addtemp = z80.a + (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0xc7:		/* RST 00 */
      z80.tstates++;
      { { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x00);};
      break;
    case 0xc8:		/* RET Z */
      z80.tstates++;
      if( z80.f & 0x40 ) { { { z80.tstates += (3);; var lowbyte =z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; var highbyte=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xc9:		/* RET */
      { { z80.tstates += (3);; var lowbyte =z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; var highbyte=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};};
      break;
    case 0xca:		/* JP Z,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( z80.f & 0x40 ) { { var jptemp=z80.pc; var pcl =z80.readbyte_internal(jptemp++); jptemp &= 0xffff; var pch =z80.readbyte_internal(jptemp); z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xcb:		/* shift CB */
      {
	var opcode2;
	z80.tstates += ( 4 );;
	opcode2 = z80.readbyte_internal( z80.pc++ );
	z80.pc &= 0xffff;
	z80.r = (z80.r+1) & 0x7f;

	switch(opcode2) {

/* opcodes_cb.c: Z80 CBxx opcodes
   Copyright (c) 1999-2008 Philip Kendall, Matthew Westcott

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
	
	Contact details: <matthew@west.co.tt>
	Matthew Westcott, 14 Daisy Hill Drive, Adlington, Chorley, Lancs PR6 9NE UNITED KINGDOM

*/

/* NB: this file is autogenerated by 'z80.pl' from 'opcodes_cb.dat',
   and included in 'z80_ops.jscpp' */

    case 0x00:		/* RLC B */
      { (z80.b) = ( ((z80.b) & 0x7f)<<1 ) | ( (z80.b)>>7 ); z80.f = ( (z80.b) & 0x01 ) | sz53p_table[(z80.b)];};
      break;
    case 0x01:		/* RLC C */
      { (z80.c) = ( ((z80.c) & 0x7f)<<1 ) | ( (z80.c)>>7 ); z80.f = ( (z80.c) & 0x01 ) | sz53p_table[(z80.c)];};
      break;
    case 0x02:		/* RLC D */
      { (z80.d) = ( ((z80.d) & 0x7f)<<1 ) | ( (z80.d)>>7 ); z80.f = ( (z80.d) & 0x01 ) | sz53p_table[(z80.d)];};
      break;
    case 0x03:		/* RLC E */
      { (z80.e) = ( ((z80.e) & 0x7f)<<1 ) | ( (z80.e)>>7 ); z80.f = ( (z80.e) & 0x01 ) | sz53p_table[(z80.e)];};
      break;
    case 0x04:		/* RLC H */
      { (z80.h) = ( ((z80.h) & 0x7f)<<1 ) | ( (z80.h)>>7 ); z80.f = ( (z80.h) & 0x01 ) | sz53p_table[(z80.h)];};
      break;
    case 0x05:		/* RLC L */
      { (z80.l) = ( ((z80.l) & 0x7f)<<1 ) | ( (z80.l)>>7 ); z80.f = ( (z80.l) & 0x01 ) | sz53p_table[(z80.l)];};
      break;
    case 0x06:		/* RLC (HL) */
      {
	let bytetemp = z80.readbyte_internal((z80.l | (z80.h << 8)));
	z80.tstates += ( 4 );; z80.tstates += ( 3 );;
	{ (bytetemp) = ( ((bytetemp) & 0x7f)<<1 ) | ( (bytetemp)>>7 ); z80.f = ( (bytetemp) & 0x01 ) | sz53p_table[(bytetemp)];};
	z80.writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x07:		/* RLC A */
      { (z80.a) = ( ((z80.a) & 0x7f)<<1 ) | ( (z80.a)>>7 ); z80.f = ( (z80.a) & 0x01 ) | sz53p_table[(z80.a)];};
      break;
    case 0x08:		/* RRC B */
      { z80.f = (z80.b) & 0x01; (z80.b) = ( (z80.b)>>1 ) | ( ((z80.b) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.b)];};
      break;
    case 0x09:		/* RRC C */
      { z80.f = (z80.c) & 0x01; (z80.c) = ( (z80.c)>>1 ) | ( ((z80.c) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.c)];};
      break;
    case 0x0a:		/* RRC D */
      { z80.f = (z80.d) & 0x01; (z80.d) = ( (z80.d)>>1 ) | ( ((z80.d) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.d)];};
      break;
    case 0x0b:		/* RRC E */
      { z80.f = (z80.e) & 0x01; (z80.e) = ( (z80.e)>>1 ) | ( ((z80.e) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.e)];};
      break;
    case 0x0c:		/* RRC H */
      { z80.f = (z80.h) & 0x01; (z80.h) = ( (z80.h)>>1 ) | ( ((z80.h) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.h)];};
      break;
    case 0x0d:		/* RRC L */
      { z80.f = (z80.l) & 0x01; (z80.l) = ( (z80.l)>>1 ) | ( ((z80.l) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.l)];};
      break;
    case 0x0e:		/* RRC (HL) */
      {
	let bytetemp = z80.readbyte_internal((z80.l | (z80.h << 8)));
	z80.tstates += ( 4 );; z80.tstates += ( 3 );;
	{ z80.f = (bytetemp) & 0x01; (bytetemp) = ( (bytetemp)>>1 ) | ( ((bytetemp) & 0x01)<<7 ); z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x0f:		/* RRC A */
      { z80.f = (z80.a) & 0x01; (z80.a) = ( (z80.a)>>1 ) | ( ((z80.a) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.a)];};
      break;
    case 0x10:		/* RL B */
      { var rltemp = (z80.b); (z80.b) = ( ((z80.b) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.b)];};
      break;
    case 0x11:		/* RL C */
      { var rltemp = (z80.c); (z80.c) = ( ((z80.c) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.c)];};
      break;
    case 0x12:		/* RL D */
      { var rltemp = (z80.d); (z80.d) = ( ((z80.d) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.d)];};
      break;
    case 0x13:		/* RL E */
      { var rltemp = (z80.e); (z80.e) = ( ((z80.e) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.e)];};
      break;
    case 0x14:		/* RL H */
      { var rltemp = (z80.h); (z80.h) = ( ((z80.h) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.h)];};
      break;
    case 0x15:		/* RL L */
      { var rltemp = (z80.l); (z80.l) = ( ((z80.l) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.l)];};
      break;
    case 0x16:		/* RL (HL) */
      {
	let bytetemp = z80.readbyte_internal((z80.l | (z80.h << 8)));
	z80.tstates += ( 4 );; z80.tstates += ( 3 );;
	{ var rltemp = (bytetemp); (bytetemp) = ( ((bytetemp) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(bytetemp)];};
	z80.writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x17:		/* RL A */
      { var rltemp = (z80.a); (z80.a) = ( ((z80.a) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.a)];};
      break;
    case 0x18:		/* RR B */
      { var rrtemp = (z80.b); (z80.b) = ( (z80.b)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.b)];};
      break;
    case 0x19:		/* RR C */
      { var rrtemp = (z80.c); (z80.c) = ( (z80.c)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.c)];};
      break;
    case 0x1a:		/* RR D */
      { var rrtemp = (z80.d); (z80.d) = ( (z80.d)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.d)];};
      break;
    case 0x1b:		/* RR E */
      { var rrtemp = (z80.e); (z80.e) = ( (z80.e)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.e)];};
      break;
    case 0x1c:		/* RR H */
      { var rrtemp = (z80.h); (z80.h) = ( (z80.h)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.h)];};
      break;
    case 0x1d:		/* RR L */
      { var rrtemp = (z80.l); (z80.l) = ( (z80.l)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.l)];};
      break;
    case 0x1e:		/* RR (HL) */
      {
	let bytetemp = z80.readbyte_internal((z80.l | (z80.h << 8)));
	z80.tstates += ( 4 );; z80.tstates += ( 3 );;
	{ var rrtemp = (bytetemp); (bytetemp) = ( (bytetemp)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(bytetemp)];};
	z80.writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x1f:		/* RR A */
      { var rrtemp = (z80.a); (z80.a) = ( (z80.a)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.a)];};
      break;
    case 0x20:		/* SLA B */
      { z80.f = (z80.b) >> 7; (z80.b) <<= 1; (z80.b) &= 0xff; z80.f |= sz53p_table[(z80.b)];};
      break;
    case 0x21:		/* SLA C */
      { z80.f = (z80.c) >> 7; (z80.c) <<= 1; (z80.c) &= 0xff; z80.f |= sz53p_table[(z80.c)];};
      break;
    case 0x22:		/* SLA D */
      { z80.f = (z80.d) >> 7; (z80.d) <<= 1; (z80.d) &= 0xff; z80.f |= sz53p_table[(z80.d)];};
      break;
    case 0x23:		/* SLA E */
      { z80.f = (z80.e) >> 7; (z80.e) <<= 1; (z80.e) &= 0xff; z80.f |= sz53p_table[(z80.e)];};
      break;
    case 0x24:		/* SLA H */
      { z80.f = (z80.h) >> 7; (z80.h) <<= 1; (z80.h) &= 0xff; z80.f |= sz53p_table[(z80.h)];};
      break;
    case 0x25:		/* SLA L */
      { z80.f = (z80.l) >> 7; (z80.l) <<= 1; (z80.l) &= 0xff; z80.f |= sz53p_table[(z80.l)];};
      break;
    case 0x26:		/* SLA (HL) */
      {
	let bytetemp = z80.readbyte_internal((z80.l | (z80.h << 8)));
	z80.tstates += ( 4 );; z80.tstates += ( 3 );;
	{ z80.f = (bytetemp) >> 7; (bytetemp) <<= 1; (bytetemp) &= 0xff; z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x27:		/* SLA A */
      { z80.f = (z80.a) >> 7; (z80.a) <<= 1; (z80.a) &= 0xff; z80.f |= sz53p_table[(z80.a)];};
      break;
    case 0x28:		/* SRA B */
      { z80.f = (z80.b) & 0x01; (z80.b) = ( (z80.b) & 0x80 ) | ( (z80.b) >> 1 ); z80.f |= sz53p_table[(z80.b)];};
      break;
    case 0x29:		/* SRA C */
      { z80.f = (z80.c) & 0x01; (z80.c) = ( (z80.c) & 0x80 ) | ( (z80.c) >> 1 ); z80.f |= sz53p_table[(z80.c)];};
      break;
    case 0x2a:		/* SRA D */
      { z80.f = (z80.d) & 0x01; (z80.d) = ( (z80.d) & 0x80 ) | ( (z80.d) >> 1 ); z80.f |= sz53p_table[(z80.d)];};
      break;
    case 0x2b:		/* SRA E */
      { z80.f = (z80.e) & 0x01; (z80.e) = ( (z80.e) & 0x80 ) | ( (z80.e) >> 1 ); z80.f |= sz53p_table[(z80.e)];};
      break;
    case 0x2c:		/* SRA H */
      { z80.f = (z80.h) & 0x01; (z80.h) = ( (z80.h) & 0x80 ) | ( (z80.h) >> 1 ); z80.f |= sz53p_table[(z80.h)];};
      break;
    case 0x2d:		/* SRA L */
      { z80.f = (z80.l) & 0x01; (z80.l) = ( (z80.l) & 0x80 ) | ( (z80.l) >> 1 ); z80.f |= sz53p_table[(z80.l)];};
      break;
    case 0x2e:		/* SRA (HL) */
      {
	let bytetemp = z80.readbyte_internal((z80.l | (z80.h << 8)));
	z80.tstates += ( 4 );; z80.tstates += ( 3 );;
	{ z80.f = (bytetemp) & 0x01; (bytetemp) = ( (bytetemp) & 0x80 ) | ( (bytetemp) >> 1 ); z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x2f:		/* SRA A */
      { z80.f = (z80.a) & 0x01; (z80.a) = ( (z80.a) & 0x80 ) | ( (z80.a) >> 1 ); z80.f |= sz53p_table[(z80.a)];};
      break;
    case 0x30:		/* SLL B */
      { z80.f = (z80.b) >> 7; (z80.b) = ( (z80.b) << 1 ) | 0x01; (z80.b) &= 0xff; z80.f |= sz53p_table[(z80.b)];};
      break;
    case 0x31:		/* SLL C */
      { z80.f = (z80.c) >> 7; (z80.c) = ( (z80.c) << 1 ) | 0x01; (z80.c) &= 0xff; z80.f |= sz53p_table[(z80.c)];};
      break;
    case 0x32:		/* SLL D */
      { z80.f = (z80.d) >> 7; (z80.d) = ( (z80.d) << 1 ) | 0x01; (z80.d) &= 0xff; z80.f |= sz53p_table[(z80.d)];};
      break;
    case 0x33:		/* SLL E */
      { z80.f = (z80.e) >> 7; (z80.e) = ( (z80.e) << 1 ) | 0x01; (z80.e) &= 0xff; z80.f |= sz53p_table[(z80.e)];};
      break;
    case 0x34:		/* SLL H */
      { z80.f = (z80.h) >> 7; (z80.h) = ( (z80.h) << 1 ) | 0x01; (z80.h) &= 0xff; z80.f |= sz53p_table[(z80.h)];};
      break;
    case 0x35:		/* SLL L */
      { z80.f = (z80.l) >> 7; (z80.l) = ( (z80.l) << 1 ) | 0x01; (z80.l) &= 0xff; z80.f |= sz53p_table[(z80.l)];};
      break;
    case 0x36:		/* SLL (HL) */
      {
	let bytetemp = z80.readbyte_internal((z80.l | (z80.h << 8)));
	z80.tstates += ( 4 );; z80.tstates += ( 3 );;
	{ z80.f = (bytetemp) >> 7; (bytetemp) = ( (bytetemp) << 1 ) | 0x01; (bytetemp) &= 0xff; z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x37:		/* SLL A */
      { z80.f = (z80.a) >> 7; (z80.a) = ( (z80.a) << 1 ) | 0x01; (z80.a) &= 0xff; z80.f |= sz53p_table[(z80.a)];};
      break;
    case 0x38:		/* SRL B */
      { z80.f = (z80.b) & 0x01; (z80.b) >>= 1; z80.f |= sz53p_table[(z80.b)];};
      break;
    case 0x39:		/* SRL C */
      { z80.f = (z80.c) & 0x01; (z80.c) >>= 1; z80.f |= sz53p_table[(z80.c)];};
      break;
    case 0x3a:		/* SRL D */
      { z80.f = (z80.d) & 0x01; (z80.d) >>= 1; z80.f |= sz53p_table[(z80.d)];};
      break;
    case 0x3b:		/* SRL E */
      { z80.f = (z80.e) & 0x01; (z80.e) >>= 1; z80.f |= sz53p_table[(z80.e)];};
      break;
    case 0x3c:		/* SRL H */
      { z80.f = (z80.h) & 0x01; (z80.h) >>= 1; z80.f |= sz53p_table[(z80.h)];};
      break;
    case 0x3d:		/* SRL L */
      { z80.f = (z80.l) & 0x01; (z80.l) >>= 1; z80.f |= sz53p_table[(z80.l)];};
      break;
    case 0x3e:		/* SRL (HL) */
      {
	let bytetemp = z80.readbyte_internal((z80.l | (z80.h << 8)));
	z80.tstates += ( 4 );; z80.tstates += ( 3 );;
	{ z80.f = (bytetemp) & 0x01; (bytetemp) >>= 1; z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal((z80.l | (z80.h << 8)),bytetemp);
      }
      break;
    case 0x3f:		/* SRL A */
      { z80.f = (z80.a) & 0x01; (z80.a) >>= 1; z80.f |= sz53p_table[(z80.a)];};
      break;
    case 0x40:		/* BIT 0,B */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) );
        if( ! ( (z80.b) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x41:		/* BIT 0,C */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) );
        if( ! ( (z80.c) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x42:		/* BIT 0,D */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) );
        if( ! ( (z80.d) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x43:		/* BIT 0,E */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) );
        if( ! ( (z80.e) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x44:		/* BIT 0,H */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) );
        if( ! ( (z80.h) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x45:		/* BIT 0,L */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) );
        if( ! ( (z80.l) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x46:		/* BIT 0,(HL) */
{
        let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
        z80.tstates += ( 4 );;
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x47:		/* BIT 0,A */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) );
        if( ! ( (z80.a) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x48:		/* BIT 1,B */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) );
        if( ! ( (z80.b) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x49:		/* BIT 1,C */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) );
        if( ! ( (z80.c) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x4a:		/* BIT 1,D */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) );
        if( ! ( (z80.d) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x4b:		/* BIT 1,E */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) );
        if( ! ( (z80.e) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x4c:		/* BIT 1,H */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) );
        if( ! ( (z80.h) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x4d:		/* BIT 1,L */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) );
        if( ! ( (z80.l) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x4e:		/* BIT 1,(HL) */
{
        let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
        z80.tstates += ( 4 );;
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x4f:		/* BIT 1,A */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) );
        if( ! ( (z80.a) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x50:		/* BIT 2,B */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) );
        if( ! ( (z80.b) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x51:		/* BIT 2,C */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) );
        if( ! ( (z80.c) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x52:		/* BIT 2,D */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) );
        if( ! ( (z80.d) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x53:		/* BIT 2,E */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) );
        if( ! ( (z80.e) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x54:		/* BIT 2,H */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) );
        if( ! ( (z80.h) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x55:		/* BIT 2,L */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) );
        if( ! ( (z80.l) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x56:		/* BIT 2,(HL) */
{
        let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
        z80.tstates += ( 4 );;
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x57:		/* BIT 2,A */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) );
        if( ! ( (z80.a) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x58:		/* BIT 3,B */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) );
        if( ! ( (z80.b) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x59:		/* BIT 3,C */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) );
        if( ! ( (z80.c) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x5a:		/* BIT 3,D */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) );
        if( ! ( (z80.d) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x5b:		/* BIT 3,E */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) );
        if( ! ( (z80.e) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x5c:		/* BIT 3,H */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) );
        if( ! ( (z80.h) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x5d:		/* BIT 3,L */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) );
        if( ! ( (z80.l) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x5e:		/* BIT 3,(HL) */
{
        let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
        z80.tstates += ( 4 );;
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x5f:		/* BIT 3,A */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) );
        if( ! ( (z80.a) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x60:		/* BIT 4,B */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) );
        if( ! ( (z80.b) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x61:		/* BIT 4,C */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) );
        if( ! ( (z80.c) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x62:		/* BIT 4,D */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) );
        if( ! ( (z80.d) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x63:		/* BIT 4,E */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) );
        if( ! ( (z80.e) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x64:		/* BIT 4,H */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) );
        if( ! ( (z80.h) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x65:		/* BIT 4,L */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) );
        if( ! ( (z80.l) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x66:		/* BIT 4,(HL) */
{
        let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
        z80.tstates += ( 4 );;
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x67:		/* BIT 4,A */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) );
        if( ! ( (z80.a) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x68:		/* BIT 5,B */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) );
        if( ! ( (z80.b) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x69:		/* BIT 5,C */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) );
        if( ! ( (z80.c) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x6a:		/* BIT 5,D */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) );
        if( ! ( (z80.d) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x6b:		/* BIT 5,E */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) );
        if( ! ( (z80.e) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x6c:		/* BIT 5,H */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) );
        if( ! ( (z80.h) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x6d:		/* BIT 5,L */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) );
        if( ! ( (z80.l) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x6e:		/* BIT 5,(HL) */
{
        let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
        z80.tstates += ( 4 );;
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x6f:		/* BIT 5,A */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) );
        if( ! ( (z80.a) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x70:		/* BIT 6,B */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) );
        if( ! ( (z80.b) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x71:		/* BIT 6,C */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) );
        if( ! ( (z80.c) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x72:		/* BIT 6,D */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) );
        if( ! ( (z80.d) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x73:		/* BIT 6,E */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) );
        if( ! ( (z80.e) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x74:		/* BIT 6,H */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) );
        if( ! ( (z80.h) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x75:		/* BIT 6,L */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) );
        if( ! ( (z80.l) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x76:		/* BIT 6,(HL) */
{
        let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
        z80.tstates += ( 4 );;
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x77:		/* BIT 6,A */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) );
        if( ! ( (z80.a) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x78:		/* BIT 7,B */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.b & ( 0x08 | 0x20 ) );
        if( ! ( (z80.b) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40;
        if( (z80.b) & 0x80 ) z80.f |= 0x80
}
      break;
    case 0x79:		/* BIT 7,C */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.c & ( 0x08 | 0x20 ) );
        if( ! ( (z80.c) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40;
        if( (z80.c) & 0x80 ) z80.f |= 0x80
}
      break;
    case 0x7a:		/* BIT 7,D */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.d & ( 0x08 | 0x20 ) );
        if( ! ( (z80.d) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40;
        if( (z80.d) & 0x80 ) z80.f |= 0x80
}
      break;
    case 0x7b:		/* BIT 7,E */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.e & ( 0x08 | 0x20 ) );
        if( ! ( (z80.e) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40;
        if( (z80.e) & 0x80 ) z80.f |= 0x80
}
      break;
    case 0x7c:		/* BIT 7,H */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.h & ( 0x08 | 0x20 ) );
        if( ! ( (z80.h) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40;
        if( (z80.h) & 0x80 ) z80.f |= 0x80
}
      break;
    case 0x7d:		/* BIT 7,L */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.l & ( 0x08 | 0x20 ) );
        if( ! ( (z80.l) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40;
        if( (z80.l) & 0x80 ) z80.f |= 0x80
}
      break;
    case 0x7e:		/* BIT 7,(HL) */
{
        let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
        z80.tstates += ( 4 );;
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( bytetemp & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40;
        if( (bytetemp) & 0x80 ) z80.f |= 0x80;
}
      break;
    case 0x7f:		/* BIT 7,A */
{
        z80.f = ( z80.f & 0x01 ) | 0x10 | ( z80.a & ( 0x08 | 0x20 ) );
        if( ! ( (z80.a) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40;
        if( (z80.a) & 0x80 ) z80.f |= 0x80
}
      break;
    case 0x80:		/* RES 0,B */
      z80.b &= 0xfe;
      break;
    case 0x81:		/* RES 0,C */
      z80.c &= 0xfe;
      break;
    case 0x82:		/* RES 0,D */
      z80.d &= 0xfe;
      break;
    case 0x83:		/* RES 0,E */
      z80.e &= 0xfe;
      break;
    case 0x84:		/* RES 0,H */
      z80.h &= 0xfe;
      break;
    case 0x85:		/* RES 0,L */
      z80.l &= 0xfe;
      break;
    case 0x86:		/* RES 0,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) & 0xfe);
      break;
    case 0x87:		/* RES 0,A */
      z80.a &= 0xfe;
      break;
    case 0x88:		/* RES 1,B */
      z80.b &= 0xfd;
      break;
    case 0x89:		/* RES 1,C */
      z80.c &= 0xfd;
      break;
    case 0x8a:		/* RES 1,D */
      z80.d &= 0xfd;
      break;
    case 0x8b:		/* RES 1,E */
      z80.e &= 0xfd;
      break;
    case 0x8c:		/* RES 1,H */
      z80.h &= 0xfd;
      break;
    case 0x8d:		/* RES 1,L */
      z80.l &= 0xfd;
      break;
    case 0x8e:		/* RES 1,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) & 0xfd);
      break;
    case 0x8f:		/* RES 1,A */
      z80.a &= 0xfd;
      break;
    case 0x90:		/* RES 2,B */
      z80.b &= 0xfb;
      break;
    case 0x91:		/* RES 2,C */
      z80.c &= 0xfb;
      break;
    case 0x92:		/* RES 2,D */
      z80.d &= 0xfb;
      break;
    case 0x93:		/* RES 2,E */
      z80.e &= 0xfb;
      break;
    case 0x94:		/* RES 2,H */
      z80.h &= 0xfb;
      break;
    case 0x95:		/* RES 2,L */
      z80.l &= 0xfb;
      break;
    case 0x96:		/* RES 2,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) & 0xfb);
      break;
    case 0x97:		/* RES 2,A */
      z80.a &= 0xfb;
      break;
    case 0x98:		/* RES 3,B */
      z80.b &= 0xf7;
      break;
    case 0x99:		/* RES 3,C */
      z80.c &= 0xf7;
      break;
    case 0x9a:		/* RES 3,D */
      z80.d &= 0xf7;
      break;
    case 0x9b:		/* RES 3,E */
      z80.e &= 0xf7;
      break;
    case 0x9c:		/* RES 3,H */
      z80.h &= 0xf7;
      break;
    case 0x9d:		/* RES 3,L */
      z80.l &= 0xf7;
      break;
    case 0x9e:		/* RES 3,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) & 0xf7);
      break;
    case 0x9f:		/* RES 3,A */
      z80.a &= 0xf7;
      break;
    case 0xa0:		/* RES 4,B */
      z80.b &= 0xef;
      break;
    case 0xa1:		/* RES 4,C */
      z80.c &= 0xef;
      break;
    case 0xa2:		/* RES 4,D */
      z80.d &= 0xef;
      break;
    case 0xa3:		/* RES 4,E */
      z80.e &= 0xef;
      break;
    case 0xa4:		/* RES 4,H */
      z80.h &= 0xef;
      break;
    case 0xa5:		/* RES 4,L */
      z80.l &= 0xef;
      break;
    case 0xa6:		/* RES 4,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) & 0xef);
      break;
    case 0xa7:		/* RES 4,A */
      z80.a &= 0xef;
      break;
    case 0xa8:		/* RES 5,B */
      z80.b &= 0xdf;
      break;
    case 0xa9:		/* RES 5,C */
      z80.c &= 0xdf;
      break;
    case 0xaa:		/* RES 5,D */
      z80.d &= 0xdf;
      break;
    case 0xab:		/* RES 5,E */
      z80.e &= 0xdf;
      break;
    case 0xac:		/* RES 5,H */
      z80.h &= 0xdf;
      break;
    case 0xad:		/* RES 5,L */
      z80.l &= 0xdf;
      break;
    case 0xae:		/* RES 5,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) & 0xdf);
      break;
    case 0xaf:		/* RES 5,A */
      z80.a &= 0xdf;
      break;
    case 0xb0:		/* RES 6,B */
      z80.b &= 0xbf;
      break;
    case 0xb1:		/* RES 6,C */
      z80.c &= 0xbf;
      break;
    case 0xb2:		/* RES 6,D */
      z80.d &= 0xbf;
      break;
    case 0xb3:		/* RES 6,E */
      z80.e &= 0xbf;
      break;
    case 0xb4:		/* RES 6,H */
      z80.h &= 0xbf;
      break;
    case 0xb5:		/* RES 6,L */
      z80.l &= 0xbf;
      break;
    case 0xb6:		/* RES 6,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) & 0xbf);
      break;
    case 0xb7:		/* RES 6,A */
      z80.a &= 0xbf;
      break;
    case 0xb8:		/* RES 7,B */
      z80.b &= 0x7f;
      break;
    case 0xb9:		/* RES 7,C */
      z80.c &= 0x7f;
      break;
    case 0xba:		/* RES 7,D */
      z80.d &= 0x7f;
      break;
    case 0xbb:		/* RES 7,E */
      z80.e &= 0x7f;
      break;
    case 0xbc:		/* RES 7,H */
      z80.h &= 0x7f;
      break;
    case 0xbd:		/* RES 7,L */
      z80.l &= 0x7f;
      break;
    case 0xbe:		/* RES 7,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) & 0x7f);
      break;
    case 0xbf:		/* RES 7,A */
      z80.a &= 0x7f;
      break;
    case 0xc0:		/* SET 0,B */
      z80.b |= 0x01;
      break;
    case 0xc1:		/* SET 0,C */
      z80.c |= 0x01;
      break;
    case 0xc2:		/* SET 0,D */
      z80.d |= 0x01;
      break;
    case 0xc3:		/* SET 0,E */
      z80.e |= 0x01;
      break;
    case 0xc4:		/* SET 0,H */
      z80.h |= 0x01;
      break;
    case 0xc5:		/* SET 0,L */
      z80.l |= 0x01;
      break;
    case 0xc6:		/* SET 0,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) | 0x01);
      break;
    case 0xc7:		/* SET 0,A */
      z80.a |= 0x01;
      break;
    case 0xc8:		/* SET 1,B */
      z80.b |= 0x02;
      break;
    case 0xc9:		/* SET 1,C */
      z80.c |= 0x02;
      break;
    case 0xca:		/* SET 1,D */
      z80.d |= 0x02;
      break;
    case 0xcb:		/* SET 1,E */
      z80.e |= 0x02;
      break;
    case 0xcc:		/* SET 1,H */
      z80.h |= 0x02;
      break;
    case 0xcd:		/* SET 1,L */
      z80.l |= 0x02;
      break;
    case 0xce:		/* SET 1,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) | 0x02);
      break;
    case 0xcf:		/* SET 1,A */
      z80.a |= 0x02;
      break;
    case 0xd0:		/* SET 2,B */
      z80.b |= 0x04;
      break;
    case 0xd1:		/* SET 2,C */
      z80.c |= 0x04;
      break;
    case 0xd2:		/* SET 2,D */
      z80.d |= 0x04;
      break;
    case 0xd3:		/* SET 2,E */
      z80.e |= 0x04;
      break;
    case 0xd4:		/* SET 2,H */
      z80.h |= 0x04;
      break;
    case 0xd5:		/* SET 2,L */
      z80.l |= 0x04;
      break;
    case 0xd6:		/* SET 2,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) | 0x04);
      break;
    case 0xd7:		/* SET 2,A */
      z80.a |= 0x04;
      break;
    case 0xd8:		/* SET 3,B */
      z80.b |= 0x08;
      break;
    case 0xd9:		/* SET 3,C */
      z80.c |= 0x08;
      break;
    case 0xda:		/* SET 3,D */
      z80.d |= 0x08;
      break;
    case 0xdb:		/* SET 3,E */
      z80.e |= 0x08;
      break;
    case 0xdc:		/* SET 3,H */
      z80.h |= 0x08;
      break;
    case 0xdd:		/* SET 3,L */
      z80.l |= 0x08;
      break;
    case 0xde:		/* SET 3,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) | 0x08);
      break;
    case 0xdf:		/* SET 3,A */
      z80.a |= 0x08;
      break;
    case 0xe0:		/* SET 4,B */
      z80.b |= 0x10;
      break;
    case 0xe1:		/* SET 4,C */
      z80.c |= 0x10;
      break;
    case 0xe2:		/* SET 4,D */
      z80.d |= 0x10;
      break;
    case 0xe3:		/* SET 4,E */
      z80.e |= 0x10;
      break;
    case 0xe4:		/* SET 4,H */
      z80.h |= 0x10;
      break;
    case 0xe5:		/* SET 4,L */
      z80.l |= 0x10;
      break;
    case 0xe6:		/* SET 4,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) | 0x10);
      break;
    case 0xe7:		/* SET 4,A */
      z80.a |= 0x10;
      break;
    case 0xe8:		/* SET 5,B */
      z80.b |= 0x20;
      break;
    case 0xe9:		/* SET 5,C */
      z80.c |= 0x20;
      break;
    case 0xea:		/* SET 5,D */
      z80.d |= 0x20;
      break;
    case 0xeb:		/* SET 5,E */
      z80.e |= 0x20;
      break;
    case 0xec:		/* SET 5,H */
      z80.h |= 0x20;
      break;
    case 0xed:		/* SET 5,L */
      z80.l |= 0x20;
      break;
    case 0xee:		/* SET 5,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) | 0x20);
      break;
    case 0xef:		/* SET 5,A */
      z80.a |= 0x20;
      break;
    case 0xf0:		/* SET 6,B */
      z80.b |= 0x40;
      break;
    case 0xf1:		/* SET 6,C */
      z80.c |= 0x40;
      break;
    case 0xf2:		/* SET 6,D */
      z80.d |= 0x40;
      break;
    case 0xf3:		/* SET 6,E */
      z80.e |= 0x40;
      break;
    case 0xf4:		/* SET 6,H */
      z80.h |= 0x40;
      break;
    case 0xf5:		/* SET 6,L */
      z80.l |= 0x40;
      break;
    case 0xf6:		/* SET 6,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) | 0x40);
      break;
    case 0xf7:		/* SET 6,A */
      z80.a |= 0x40;
      break;
    case 0xf8:		/* SET 7,B */
      z80.b |= 0x80;
      break;
    case 0xf9:		/* SET 7,C */
      z80.c |= 0x80;
      break;
    case 0xfa:		/* SET 7,D */
      z80.d |= 0x80;
      break;
    case 0xfb:		/* SET 7,E */
      z80.e |= 0x80;
      break;
    case 0xfc:		/* SET 7,H */
      z80.h |= 0x80;
      break;
    case 0xfd:		/* SET 7,L */
      z80.l |= 0x80;
      break;
    case 0xfe:		/* SET 7,(HL) */
      z80.tstates += ( 4 );; z80.tstates += ( 3 );;
      z80.writebyte_internal((z80.l | (z80.h << 8)), z80.readbyte_internal((z80.l | (z80.h << 8))) | 0x80);
      break;
    case 0xff:		/* SET 7,A */
      z80.a |= 0x80;
      break;

	}



      }
      break;
    case 0xcc:		/* CALL Z,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( z80.f & 0x40 ) { { var calltempl, calltemph; calltempl=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (1);; calltemph=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xcd:		/* CALL nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      { var calltempl, calltemph; calltempl=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (1);; calltemph=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);};
      break;
    case 0xce:		/* ADC A,nn */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( z80.pc++ );
	{ var adctemp = z80.a + (bytetemp) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0xcf:		/* RST 8 */
      z80.tstates++;
      { { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x08);};
      break;
    case 0xd0:		/* RET NC */
      z80.tstates++;
      if( ! ( z80.f & 0x01 ) ) { { { z80.tstates += (3);; var lowbyte =z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; var highbyte=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xd1:		/* POP DE */
      { z80.tstates += (3);; (z80.e)=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; (z80.d)=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff;};
      break;
    case 0xd2:		/* JP NC,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( ! ( z80.f & 0x01 ) ) { { var jptemp=z80.pc; var pcl =z80.readbyte_internal(jptemp++); jptemp &= 0xffff; var pch =z80.readbyte_internal(jptemp); z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xd3:		/* OUT (nn),A */
      { 
	var outtemp;
	z80.tstates += ( 4 );;
	outtemp = z80.readbyte_internal( z80.pc++ ) + ( z80.a << 8 );
	z80.pc &= 0xffff;
	{ z80.tstates += (3);; z80.writeport( outtemp , z80.a );};
      }
      break;
    case 0xd4:		/* CALL NC,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( ! ( z80.f & 0x01 ) ) { { var calltempl, calltemph; calltempl=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (1);; calltemph=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xd5:		/* PUSH DE */
      z80.tstates++;
      { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.d)); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.e));};
      break;
    case 0xd6:		/* SUB nn */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( z80.pc++ );
	{ var subtemp = z80.a - (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0xd7:		/* RST 10 */
      z80.tstates++;
      { { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x10);};
      break;
    case 0xd8:		/* RET C */
      z80.tstates++;
      if( z80.f & 0x01 ) { { { z80.tstates += (3);; var lowbyte =z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; var highbyte=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xd9:		/* EXX */
      {
	let bytetemp;
	bytetemp = z80.b; z80.b = z80.b_; z80.b_ = bytetemp;
	bytetemp = z80.c; z80.c = z80.c_; z80.c_ = bytetemp;
	bytetemp = z80.d; z80.d = z80.d_; z80.d_ = bytetemp;
	bytetemp = z80.e; z80.e = z80.e_; z80.e_ = bytetemp;
	bytetemp = z80.h; z80.h = z80.h_; z80.h_ = bytetemp;
	bytetemp = z80.l; z80.l = z80.l_; z80.l_ = bytetemp;
      }
      break;
    case 0xda:		/* JP C,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( z80.f & 0x01 ) { { var jptemp=z80.pc; var pcl =z80.readbyte_internal(jptemp++); jptemp &= 0xffff; var pch =z80.readbyte_internal(jptemp); z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xdb:		/* IN A,(nn) */
      { 
	var intemp;
	z80.tstates += ( 4 );;
	intemp = z80.readbyte_internal( z80.pc++ ) + ( z80.a << 8 );
	z80.pc &= 0xffff;
	z80.tstates += ( 3 );;
        z80.a=z80.readport( intemp );
      }
      break;
    case 0xdc:		/* CALL C,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( z80.f & 0x01 ) { { var calltempl, calltemph; calltempl=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (1);; calltemph=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xdd:		/* shift DD */
      {
	var opcode2;
	z80.tstates += ( 4 );;
	opcode2 = z80.readbyte_internal( z80.pc++ );
	z80.pc &= 0xffff;
	z80.r = (z80.r+1) & 0x7f;

	switch(opcode2) {





/* opcodes_ddfd.c Z80 {DD,FD}xx opcodes
   Copyright (c) 1999-2008 Philip Kendall, Matthew Westcott

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
	
	Contact details: <matthew@west.co.tt>
	Matthew Westcott, 14 Daisy Hill Drive, Adlington, Chorley, Lancs PR6 9NE UNITED KINGDOM

*/

/* NB: this file is autogenerated by 'z80.pl' from 'opcodes_ddfd.dat',
   and included in 'z80_ops.jscpp' */

    case 0x09:		/* ADD REGISTER,BC */
      { let add16temp = ((z80.ixl | (z80.ixh << 8))) + ((z80.c | (z80.b << 8))); var lookup = ( ( ((z80.ixl | (z80.ixh << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.c | (z80.b << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); z80.tstates += 7; (z80.ixh) = (add16temp >> 8) & 0xff; (z80.ixl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x19:		/* ADD REGISTER,DE */
      { let add16temp = ((z80.ixl | (z80.ixh << 8))) + ((z80.e | (z80.d << 8))); var lookup = ( ( ((z80.ixl | (z80.ixh << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.e | (z80.d << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); z80.tstates += 7; (z80.ixh) = (add16temp >> 8) & 0xff; (z80.ixl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x21:		/* LD REGISTER,nnnn */
      z80.tstates += ( 3 );;
      z80.ixl=z80.readbyte_internal(z80.pc++);
      z80.pc &= 0xffff;
      z80.tstates += ( 3 );;
      z80.ixh=z80.readbyte_internal(z80.pc++);
      z80.pc &= 0xffff;
      break;
    case 0x22:		/* LD (nnnn),REGISTER */
      { var ldtemp; z80.tstates += (3);; ldtemp=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (3);; ldtemp|=z80.readbyte_internal(z80.pc++) << 8; z80.pc &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(ldtemp++,(z80.ixl)); ldtemp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(ldtemp,(z80.ixh));};
      break;
    case 0x23:		/* INC REGISTER */
      z80.tstates += 2;
      wordtemp = ((z80.ixl | (z80.ixh << 8)) + 1) & 0xffff;
      z80.ixh = wordtemp >> 8;
      z80.ixl = wordtemp & 0xff;
      break;
    case 0x24:		/* INC REGISTERH */
      { (z80.ixh) = ((z80.ixh) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.ixh)==0x80 ? 0x04 : 0 ) | ( (z80.ixh)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.ixh)];};
      break;
    case 0x25:		/* DEC REGISTERH */
      { z80.f = ( z80.f & 0x01 ) | ( (z80.ixh)&0x0f ? 0 : 0x10 ) | 0x02; (z80.ixh) = ((z80.ixh) - 1) & 0xff; z80.f |= ( (z80.ixh)==0x7f ? 0x04 : 0 ) | sz53_table[z80.ixh];};
      break;
    case 0x26:		/* LD REGISTERH,nn */
      z80.tstates += ( 3 );;
      z80.ixh=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff;
      break;
    case 0x29:		/* ADD REGISTER,REGISTER */
      { let add16temp = ((z80.ixl | (z80.ixh << 8))) + ((z80.ixl | (z80.ixh << 8))); var lookup = ( ( ((z80.ixl | (z80.ixh << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.ixl | (z80.ixh << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); z80.tstates += 7; (z80.ixh) = (add16temp >> 8) & 0xff; (z80.ixl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x2a:		/* LD REGISTER,(nnnn) */
      { var ldtemp; z80.tstates += (3);; ldtemp=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (3);; ldtemp|=z80.readbyte_internal(z80.pc++) << 8; z80.pc &= 0xffff; z80.tstates += (3);; (z80.ixl)=z80.readbyte_internal(ldtemp++); ldtemp &= 0xffff; z80.tstates += (3);; (z80.ixh)=z80.readbyte_internal(ldtemp);};
      break;
    case 0x2b:		/* DEC REGISTER */
      z80.tstates += 2;
      wordtemp = ((z80.ixl | (z80.ixh << 8)) - 1) & 0xffff;
      z80.ixh = wordtemp >> 8;
      z80.ixl = wordtemp & 0xff;
      break;
    case 0x2c:		/* INC REGISTERL */
      { (z80.ixl) = ((z80.ixl) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.ixl)==0x80 ? 0x04 : 0 ) | ( (z80.ixl)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.ixl)];};
      break;
    case 0x2d:		/* DEC REGISTERL */
      { z80.f = ( z80.f & 0x01 ) | ( (z80.ixl)&0x0f ? 0 : 0x10 ) | 0x02; (z80.ixl) = ((z80.ixl) - 1) & 0xff; z80.f |= ( (z80.ixl)==0x7f ? 0x04 : 0 ) | sz53_table[z80.ixl];};
      break;
    case 0x2e:		/* LD REGISTERL,nn */
      z80.tstates += ( 3 );;
      z80.ixl=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff;
      break;
    case 0x34:		/* INC (REGISTER+dd) */
      z80.tstates += 15;		/* FIXME: how is this contended? */
      {
	wordtemp =
	    ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff;
	z80.pc &= 0xffff;
	let bytetemp = z80.readbyte_internal( wordtemp );
	{ (bytetemp) = ((bytetemp) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (bytetemp)==0x80 ? 0x04 : 0 ) | ( (bytetemp)&0x0f ? 0 : 0x10 ) | sz53_table[(bytetemp)];};
	z80.writebyte_internal(wordtemp,bytetemp);
      }
      break;
    case 0x35:		/* DEC (REGISTER+dd) */
      z80.tstates += 15;		/* FIXME: how is this contended? */
      {
	wordtemp =
	    ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff;
	z80.pc &= 0xffff;
	let bytetemp = z80.readbyte_internal( wordtemp );
	{ z80.f = ( z80.f & 0x01 ) | ( (bytetemp)&0x0f ? 0 : 0x10 ) | 0x02; (bytetemp) = ((bytetemp) - 1) & 0xff; z80.f |= ( (bytetemp)==0x7f ? 0x04 : 0 ) | sz53_table[bytetemp];};
	z80.writebyte_internal(wordtemp,bytetemp);
      }
      break;
    case 0x36:		/* LD (REGISTER+dd),nn */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	wordtemp =
	    ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff;
	z80.pc &= 0xffff;
	z80.writebyte_internal(wordtemp,z80.readbyte_internal(z80.pc++));
	z80.pc &= 0xffff;
      }
      break;
    case 0x39:		/* ADD REGISTER,SP */
      { let add16temp = ((z80.ixl | (z80.ixh << 8))) + (z80.sp); var lookup = ( ( ((z80.ixl | (z80.ixh << 8))) & 0x0800 ) >> 11 ) | ( ( (z80.sp) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); z80.tstates += 7; (z80.ixh) = (add16temp >> 8) & 0xff; (z80.ixl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x44:		/* LD B,REGISTERH */
      z80.b=z80.ixh;
      break;
    case 0x45:		/* LD B,REGISTERL */
      z80.b=z80.ixl;
      break;
    case 0x46:		/* LD B,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.b = z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
      z80.pc &= 0xffff;
      break;
    case 0x4c:		/* LD C,REGISTERH */
      z80.c=z80.ixh;
      break;
    case 0x4d:		/* LD C,REGISTERL */
      z80.c=z80.ixl;
      break;
    case 0x4e:		/* LD C,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.c = z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
      z80.pc &= 0xffff;
      break;
    case 0x54:		/* LD D,REGISTERH */
      z80.d=z80.ixh;
      break;
    case 0x55:		/* LD D,REGISTERL */
      z80.d=z80.ixl;
      break;
    case 0x56:		/* LD D,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.d = z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
      z80.pc &= 0xffff;
      break;
    case 0x5c:		/* LD E,REGISTERH */
      z80.e=z80.ixh;
      break;
    case 0x5d:		/* LD E,REGISTERL */
      z80.e=z80.ixl;
      break;
    case 0x5e:		/* LD E,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.e = z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
      z80.pc &= 0xffff;
      break;
    case 0x60:		/* LD REGISTERH,B */
      z80.ixh=z80.b;
      break;
    case 0x61:		/* LD REGISTERH,C */
      z80.ixh=z80.c;
      break;
    case 0x62:		/* LD REGISTERH,D */
      z80.ixh=z80.d;
      break;
    case 0x63:		/* LD REGISTERH,E */
      z80.ixh=z80.e;
      break;
    case 0x64:		/* LD REGISTERH,REGISTERH */
      break;
    case 0x65:		/* LD REGISTERH,REGISTERL */
      z80.ixh=z80.ixl;
      break;
    case 0x66:		/* LD H,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.h = z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
      z80.pc &= 0xffff;
      break;
    case 0x67:		/* LD REGISTERH,A */
      z80.ixh=z80.a;
      break;
    case 0x68:		/* LD REGISTERL,B */
      z80.ixl=z80.b;
      break;
    case 0x69:		/* LD REGISTERL,C */
      z80.ixl=z80.c;
      break;
    case 0x6a:		/* LD REGISTERL,D */
      z80.ixl=z80.d;
      break;
    case 0x6b:		/* LD REGISTERL,E */
      z80.ixl=z80.e;
      break;
    case 0x6c:		/* LD REGISTERL,REGISTERH */
      z80.ixl=z80.ixh;
      break;
    case 0x6d:		/* LD REGISTERL,REGISTERL */
      break;
    case 0x6e:		/* LD L,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.l = z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
      z80.pc &= 0xffff;
      break;
    case 0x6f:		/* LD REGISTERL,A */
      z80.ixl=z80.a;
      break;
    case 0x70:		/* LD (REGISTER+dd),B */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.writebyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff, z80.b );
      z80.pc &= 0xffff;
      break;
    case 0x71:		/* LD (REGISTER+dd),C */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.writebyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff, z80.c );
      z80.pc &= 0xffff;
      break;
    case 0x72:		/* LD (REGISTER+dd),D */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.writebyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff, z80.d );
      z80.pc &= 0xffff;
      break;
    case 0x73:		/* LD (REGISTER+dd),E */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.writebyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff, z80.e );
      z80.pc &= 0xffff;
      break;
    case 0x74:		/* LD (REGISTER+dd),H */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.writebyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff, z80.h );
      z80.pc &= 0xffff;
      break;
    case 0x75:		/* LD (REGISTER+dd),L */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.writebyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff, z80.l );
      z80.pc &= 0xffff;
      break;
    case 0x77:		/* LD (REGISTER+dd),A */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.writebyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff, z80.a );
      z80.pc &= 0xffff;
      break;
    case 0x7c:		/* LD A,REGISTERH */
      z80.a=z80.ixh;
      break;
    case 0x7d:		/* LD A,REGISTERL */
      z80.a=z80.ixl;
      break;
    case 0x7e:		/* LD A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.a = z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
      z80.pc &= 0xffff;
      break;
    case 0x84:		/* ADD A,REGISTERH */
      { var addtemp = z80.a + (z80.ixh); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixh) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x85:		/* ADD A,REGISTERL */
      { var addtemp = z80.a + (z80.ixl); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixl) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x86:		/* ADD A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ var addtemp = z80.a + (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x8c:		/* ADC A,REGISTERH */
      { var adctemp = z80.a + (z80.ixh) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixh) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8d:		/* ADC A,REGISTERL */
      { var adctemp = z80.a + (z80.ixl) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixl) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8e:		/* ADC A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ var adctemp = z80.a + (bytetemp) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x94:		/* SUB A,REGISTERH */
      { var subtemp = z80.a - (z80.ixh); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixh) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x95:		/* SUB A,REGISTERL */
      { var subtemp = z80.a - (z80.ixl); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixl) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x96:		/* SUB A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ var subtemp = z80.a - (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x9c:		/* SBC A,REGISTERH */
      { var sbctemp = z80.a - (z80.ixh) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixh) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9d:		/* SBC A,REGISTERL */
      { var sbctemp = z80.a - (z80.ixl) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixl) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9e:		/* SBC A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ var sbctemp = z80.a - (bytetemp) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0xa4:		/* AND A,REGISTERH */
      { z80.a &= (z80.ixh); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa5:		/* AND A,REGISTERL */
      { z80.a &= (z80.ixl); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa6:		/* AND A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ z80.a &= (bytetemp); z80.f = 0x10 | sz53p_table[z80.a];};
      }
      break;
    case 0xac:		/* XOR A,REGISTERH */
      { z80.a ^= (z80.ixh); z80.f = sz53p_table[z80.a];};
      break;
    case 0xad:		/* XOR A,REGISTERL */
      { z80.a ^= (z80.ixl); z80.f = sz53p_table[z80.a];};
      break;
    case 0xae:		/* XOR A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ z80.a ^= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xb4:		/* OR A,REGISTERH */
      { z80.a |= (z80.ixh); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb5:		/* OR A,REGISTERL */
      { z80.a |= (z80.ixl); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb6:		/* OR A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ z80.a |= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xbc:		/* CP A,REGISTERH */
      { var cptemp = z80.a - z80.ixh; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixh) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.ixh & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbd:		/* CP A,REGISTERL */
      { var cptemp = z80.a - z80.ixl; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.ixl) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.ixl & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbe:		/* CP A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ var cptemp = z80.a - bytetemp; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( bytetemp & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      }
      break;
    case 0xcb:		/* shift DDFDCB */
      /* FIXME: contention here is just a guess */
      {
	var tempaddr; var opcode3;
	z80.tstates += ( 3 );;
	tempaddr =
	    (z80.ixl | (z80.ixh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ));
	z80.pc &= 0xffff;
	z80.tstates += ( 4 );;
	opcode3 = z80.readbyte_internal( z80.pc++ );
	z80.pc &= 0xffff;

	switch(opcode3) {

/* opcodes_ddfdcb.c Z80 {DD,FD}CBxx opcodes
   Copyright (c) 1999-2008 Philip Kendall, Matthew Westcott

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
	
	Contact details: <matthew@west.co.tt>
	Matthew Westcott, 14 Daisy Hill Drive, Adlington, Chorley, Lancs PR6 9NE UNITED KINGDOM

*/

/* NB: this file is autogenerated by 'z80.pl' from 'opcodes_ddfdcb.dat',
   and included in 'z80_ops.jscpp' */

    case 0x00:		/* LD B,RLC (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { (z80.b) = ( ((z80.b) & 0x7f)<<1 ) | ( (z80.b)>>7 ); z80.f = ( (z80.b) & 0x01 ) | sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x01:		/* LD C,RLC (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { (z80.c) = ( ((z80.c) & 0x7f)<<1 ) | ( (z80.c)>>7 ); z80.f = ( (z80.c) & 0x01 ) | sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x02:		/* LD D,RLC (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { (z80.d) = ( ((z80.d) & 0x7f)<<1 ) | ( (z80.d)>>7 ); z80.f = ( (z80.d) & 0x01 ) | sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x03:		/* LD E,RLC (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { (z80.e) = ( ((z80.e) & 0x7f)<<1 ) | ( (z80.e)>>7 ); z80.f = ( (z80.e) & 0x01 ) | sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x04:		/* LD H,RLC (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { (z80.h) = ( ((z80.h) & 0x7f)<<1 ) | ( (z80.h)>>7 ); z80.f = ( (z80.h) & 0x01 ) | sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x05:		/* LD L,RLC (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { (z80.l) = ( ((z80.l) & 0x7f)<<1 ) | ( (z80.l)>>7 ); z80.f = ( (z80.l) & 0x01 ) | sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x06:		/* RLC (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ (bytetemp) = ( ((bytetemp) & 0x7f)<<1 ) | ( (bytetemp)>>7 ); z80.f = ( (bytetemp) & 0x01 ) | sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x07:		/* LD A,RLC (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { (z80.a) = ( ((z80.a) & 0x7f)<<1 ) | ( (z80.a)>>7 ); z80.f = ( (z80.a) & 0x01 ) | sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x08:		/* LD B,RRC (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.b) & 0x01; (z80.b) = ( (z80.b)>>1 ) | ( ((z80.b) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x09:		/* LD C,RRC (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.c) & 0x01; (z80.c) = ( (z80.c)>>1 ) | ( ((z80.c) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x0a:		/* LD D,RRC (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.d) & 0x01; (z80.d) = ( (z80.d)>>1 ) | ( ((z80.d) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x0b:		/* LD E,RRC (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.e) & 0x01; (z80.e) = ( (z80.e)>>1 ) | ( ((z80.e) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x0c:		/* LD H,RRC (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.h) & 0x01; (z80.h) = ( (z80.h)>>1 ) | ( ((z80.h) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x0d:		/* LD L,RRC (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.l) & 0x01; (z80.l) = ( (z80.l)>>1 ) | ( ((z80.l) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x0e:		/* RRC (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ z80.f = (bytetemp) & 0x01; (bytetemp) = ( (bytetemp)>>1 ) | ( ((bytetemp) & 0x01)<<7 ); z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x0f:		/* LD A,RRC (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.a) & 0x01; (z80.a) = ( (z80.a)>>1 ) | ( ((z80.a) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x10:		/* LD B,RL (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { var rltemp = (z80.b); (z80.b) = ( ((z80.b) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x11:		/* LD C,RL (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { var rltemp = (z80.c); (z80.c) = ( ((z80.c) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x12:		/* LD D,RL (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { var rltemp = (z80.d); (z80.d) = ( ((z80.d) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x13:		/* LD E,RL (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { var rltemp = (z80.e); (z80.e) = ( ((z80.e) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x14:		/* LD H,RL (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { var rltemp = (z80.h); (z80.h) = ( ((z80.h) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x15:		/* LD L,RL (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { var rltemp = (z80.l); (z80.l) = ( ((z80.l) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x16:		/* RL (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ var rltemp = (bytetemp); (bytetemp) = ( ((bytetemp) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x17:		/* LD A,RL (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { var rltemp = (z80.a); (z80.a) = ( ((z80.a) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x18:		/* LD B,RR (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { var rrtemp = (z80.b); (z80.b) = ( (z80.b)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x19:		/* LD C,RR (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { var rrtemp = (z80.c); (z80.c) = ( (z80.c)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x1a:		/* LD D,RR (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { var rrtemp = (z80.d); (z80.d) = ( (z80.d)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x1b:		/* LD E,RR (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { var rrtemp = (z80.e); (z80.e) = ( (z80.e)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x1c:		/* LD H,RR (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { var rrtemp = (z80.h); (z80.h) = ( (z80.h)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x1d:		/* LD L,RR (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { var rrtemp = (z80.l); (z80.l) = ( (z80.l)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x1e:		/* RR (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ var rrtemp = (bytetemp); (bytetemp) = ( (bytetemp)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x1f:		/* LD A,RR (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { var rrtemp = (z80.a); (z80.a) = ( (z80.a)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x20:		/* LD B,SLA (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.b) >> 7; (z80.b) <<= 1; (z80.b) &= 0xff; z80.f |= sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x21:		/* LD C,SLA (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.c) >> 7; (z80.c) <<= 1; (z80.c) &= 0xff; z80.f |= sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x22:		/* LD D,SLA (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.d) >> 7; (z80.d) <<= 1; (z80.d) &= 0xff; z80.f |= sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x23:		/* LD E,SLA (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.e) >> 7; (z80.e) <<= 1; (z80.e) &= 0xff; z80.f |= sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x24:		/* LD H,SLA (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.h) >> 7; (z80.h) <<= 1; (z80.h) &= 0xff; z80.f |= sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x25:		/* LD L,SLA (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.l) >> 7; (z80.l) <<= 1; (z80.l) &= 0xff; z80.f |= sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x26:		/* SLA (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ z80.f = (bytetemp) >> 7; (bytetemp) <<= 1; (bytetemp) &= 0xff; z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x27:		/* LD A,SLA (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.a) >> 7; (z80.a) <<= 1; (z80.a) &= 0xff; z80.f |= sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x28:		/* LD B,SRA (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.b) & 0x01; (z80.b) = ( (z80.b) & 0x80 ) | ( (z80.b) >> 1 ); z80.f |= sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x29:		/* LD C,SRA (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.c) & 0x01; (z80.c) = ( (z80.c) & 0x80 ) | ( (z80.c) >> 1 ); z80.f |= sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x2a:		/* LD D,SRA (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.d) & 0x01; (z80.d) = ( (z80.d) & 0x80 ) | ( (z80.d) >> 1 ); z80.f |= sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x2b:		/* LD E,SRA (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.e) & 0x01; (z80.e) = ( (z80.e) & 0x80 ) | ( (z80.e) >> 1 ); z80.f |= sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x2c:		/* LD H,SRA (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.h) & 0x01; (z80.h) = ( (z80.h) & 0x80 ) | ( (z80.h) >> 1 ); z80.f |= sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x2d:		/* LD L,SRA (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.l) & 0x01; (z80.l) = ( (z80.l) & 0x80 ) | ( (z80.l) >> 1 ); z80.f |= sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x2e:		/* SRA (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ z80.f = (bytetemp) & 0x01; (bytetemp) = ( (bytetemp) & 0x80 ) | ( (bytetemp) >> 1 ); z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x2f:		/* LD A,SRA (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.a) & 0x01; (z80.a) = ( (z80.a) & 0x80 ) | ( (z80.a) >> 1 ); z80.f |= sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x30:		/* LD B,SLL (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.b) >> 7; (z80.b) = ( (z80.b) << 1 ) | 0x01; (z80.b) &= 0xff; z80.f |= sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x31:		/* LD C,SLL (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.c) >> 7; (z80.c) = ( (z80.c) << 1 ) | 0x01; (z80.c) &= 0xff; z80.f |= sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x32:		/* LD D,SLL (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.d) >> 7; (z80.d) = ( (z80.d) << 1 ) | 0x01; (z80.d) &= 0xff; z80.f |= sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x33:		/* LD E,SLL (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.e) >> 7; (z80.e) = ( (z80.e) << 1 ) | 0x01; (z80.e) &= 0xff; z80.f |= sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x34:		/* LD H,SLL (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.h) >> 7; (z80.h) = ( (z80.h) << 1 ) | 0x01; (z80.h) &= 0xff; z80.f |= sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x35:		/* LD L,SLL (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.l) >> 7; (z80.l) = ( (z80.l) << 1 ) | 0x01; (z80.l) &= 0xff; z80.f |= sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x36:		/* SLL (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ z80.f = (bytetemp) >> 7; (bytetemp) = ( (bytetemp) << 1 ) | 0x01; (bytetemp) &= 0xff; z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x37:		/* LD A,SLL (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.a) >> 7; (z80.a) = ( (z80.a) << 1 ) | 0x01; (z80.a) &= 0xff; z80.f |= sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x38:		/* LD B,SRL (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.b) & 0x01; (z80.b) >>= 1; z80.f |= sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x39:		/* LD C,SRL (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.c) & 0x01; (z80.c) >>= 1; z80.f |= sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x3a:		/* LD D,SRL (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.d) & 0x01; (z80.d) >>= 1; z80.f |= sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x3b:		/* LD E,SRL (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.e) & 0x01; (z80.e) >>= 1; z80.f |= sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x3c:		/* LD H,SRL (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.h) & 0x01; (z80.h) >>= 1; z80.f |= sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x3d:		/* LD L,SRL (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.l) & 0x01; (z80.l) >>= 1; z80.f |= sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x3e:		/* SRL (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ z80.f = (bytetemp) & 0x01; (bytetemp) >>= 1; z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x3f:		/* LD A,SRL (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.a) & 0x01; (z80.a) >>= 1; z80.f |= sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x40:
    case 0x41:
    case 0x42:
    case 0x43:
    case 0x44:
    case 0x45:
    case 0x46:
    case 0x47:		/* BIT 0,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x48:
    case 0x49:
    case 0x4a:
    case 0x4b:
    case 0x4c:
    case 0x4d:
    case 0x4e:
    case 0x4f:		/* BIT 1,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x50:
    case 0x51:
    case 0x52:
    case 0x53:
    case 0x54:
    case 0x55:
    case 0x56:
    case 0x57:		/* BIT 2,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x58:
    case 0x59:
    case 0x5a:
    case 0x5b:
    case 0x5c:
    case 0x5d:
    case 0x5e:
    case 0x5f:		/* BIT 3,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x60:
    case 0x61:
    case 0x62:
    case 0x63:
    case 0x64:
    case 0x65:
    case 0x66:
    case 0x67:		/* BIT 4,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x68:
    case 0x69:
    case 0x6a:
    case 0x6b:
    case 0x6c:
    case 0x6d:
    case 0x6e:
    case 0x6f:		/* BIT 5,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x70:
    case 0x71:
    case 0x72:
    case 0x73:
    case 0x74:
    case 0x75:
    case 0x76:
    case 0x77:		/* BIT 6,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x78:
    case 0x79:
    case 0x7a:
    case 0x7b:
    case 0x7c:
    case 0x7d:
    case 0x7e:
    case 0x7f:		/* BIT 7,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40;
        if( (bytetemp) & 0x80 ) z80.f |= 0x80;
}
      break;
    case 0x80:		/* LD B,RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0xfe;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x81:		/* LD C,RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0xfe;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x82:		/* LD D,RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0xfe;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x83:		/* LD E,RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0xfe;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x84:		/* LD H,RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0xfe;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x85:		/* LD L,RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0xfe;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x86:		/* RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0xfe);
      break;
    case 0x87:		/* LD A,RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0xfe;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x88:		/* LD B,RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0xfd;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x89:		/* LD C,RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0xfd;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x8a:		/* LD D,RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0xfd;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x8b:		/* LD E,RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0xfd;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x8c:		/* LD H,RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0xfd;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x8d:		/* LD L,RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0xfd;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x8e:		/* RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0xfd);
      break;
    case 0x8f:		/* LD A,RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0xfd;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x90:		/* LD B,RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0xfb;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x91:		/* LD C,RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0xfb;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x92:		/* LD D,RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0xfb;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x93:		/* LD E,RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0xfb;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x94:		/* LD H,RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0xfb;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x95:		/* LD L,RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0xfb;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x96:		/* RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0xfb);
      break;
    case 0x97:		/* LD A,RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0xfb;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x98:		/* LD B,RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0xf7;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x99:		/* LD C,RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0xf7;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x9a:		/* LD D,RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0xf7;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x9b:		/* LD E,RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0xf7;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x9c:		/* LD H,RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0xf7;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x9d:		/* LD L,RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0xf7;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x9e:		/* RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0xf7);
      break;
    case 0x9f:		/* LD A,RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0xf7;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xa0:		/* LD B,RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0xef;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xa1:		/* LD C,RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0xef;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xa2:		/* LD D,RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0xef;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xa3:		/* LD E,RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0xef;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xa4:		/* LD H,RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0xef;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xa5:		/* LD L,RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0xef;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xa6:		/* RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0xef);
      break;
    case 0xa7:		/* LD A,RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0xef;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xa8:		/* LD B,RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0xdf;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xa9:		/* LD C,RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0xdf;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xaa:		/* LD D,RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0xdf;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xab:		/* LD E,RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0xdf;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xac:		/* LD H,RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0xdf;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xad:		/* LD L,RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0xdf;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xae:		/* RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0xdf);
      break;
    case 0xaf:		/* LD A,RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0xdf;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xb0:		/* LD B,RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0xbf;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xb1:		/* LD C,RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0xbf;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xb2:		/* LD D,RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0xbf;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xb3:		/* LD E,RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0xbf;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xb4:		/* LD H,RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0xbf;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xb5:		/* LD L,RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0xbf;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xb6:		/* RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0xbf);
      break;
    case 0xb7:		/* LD A,RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0xbf;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xb8:		/* LD B,RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0x7f;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xb9:		/* LD C,RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0x7f;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xba:		/* LD D,RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0x7f;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xbb:		/* LD E,RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0x7f;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xbc:		/* LD H,RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0x7f;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xbd:		/* LD L,RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0x7f;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xbe:		/* RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0x7f);
      break;
    case 0xbf:		/* LD A,RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0x7f;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xc0:		/* LD B,SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x01;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xc1:		/* LD C,SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x01;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xc2:		/* LD D,SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x01;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xc3:		/* LD E,SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x01;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xc4:		/* LD H,SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x01;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xc5:		/* LD L,SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x01;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xc6:		/* SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x01);
      break;
    case 0xc7:		/* LD A,SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x01;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xc8:		/* LD B,SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x02;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xc9:		/* LD C,SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x02;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xca:		/* LD D,SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x02;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xcb:		/* LD E,SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x02;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xcc:		/* LD H,SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x02;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xcd:		/* LD L,SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x02;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xce:		/* SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x02);
      break;
    case 0xcf:		/* LD A,SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x02;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xd0:		/* LD B,SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x04;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xd1:		/* LD C,SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x04;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xd2:		/* LD D,SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x04;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xd3:		/* LD E,SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x04;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xd4:		/* LD H,SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x04;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xd5:		/* LD L,SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x04;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xd6:		/* SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x04);
      break;
    case 0xd7:		/* LD A,SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x04;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xd8:		/* LD B,SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x08;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xd9:		/* LD C,SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x08;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xda:		/* LD D,SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x08;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xdb:		/* LD E,SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x08;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xdc:		/* LD H,SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x08;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xdd:		/* LD L,SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x08;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xde:		/* SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x08);
      break;
    case 0xdf:		/* LD A,SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x08;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xe0:		/* LD B,SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x10;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xe1:		/* LD C,SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x10;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xe2:		/* LD D,SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x10;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xe3:		/* LD E,SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x10;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xe4:		/* LD H,SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x10;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xe5:		/* LD L,SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x10;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xe6:		/* SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x10);
      break;
    case 0xe7:		/* LD A,SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x10;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xe8:		/* LD B,SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x20;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xe9:		/* LD C,SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x20;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xea:		/* LD D,SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x20;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xeb:		/* LD E,SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x20;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xec:		/* LD H,SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x20;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xed:		/* LD L,SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x20;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xee:		/* SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x20);
      break;
    case 0xef:		/* LD A,SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x20;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xf0:		/* LD B,SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x40;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xf1:		/* LD C,SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x40;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xf2:		/* LD D,SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x40;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xf3:		/* LD E,SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x40;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xf4:		/* LD H,SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x40;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xf5:		/* LD L,SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x40;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xf6:		/* SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x40);
      break;
    case 0xf7:		/* LD A,SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x40;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xf8:		/* LD B,SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x80;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xf9:		/* LD C,SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x80;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xfa:		/* LD D,SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x80;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xfb:		/* LD E,SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x80;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xfc:		/* LD H,SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x80;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xfd:		/* LD L,SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x80;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xfe:		/* SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x80);
      break;
    case 0xff:		/* LD A,SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x80;
      z80.writebyte_internal(tempaddr, z80.a);
      break;

	}



      }
      break;
    case 0xe1:		/* POP REGISTER */
      { z80.tstates += (3);; (z80.ixl)=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; (z80.ixh)=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff;};
      break;
    case 0xe3:		/* EX (SP),REGISTER */
      {
	let bytetempl = z80.readbyte_internal( z80.sp     ),
	                 bytetemph = z80.readbyte_internal( z80.sp + 1 );
	z80.tstates += ( 3 );; z80.tstates += ( 4 );;
	z80.tstates += ( 3 );; z80.tstates += ( 5 );;
	z80.writebyte_internal(z80.sp+1,z80.ixh); z80.writebyte_internal(z80.sp,z80.ixl);
	z80.ixl=bytetempl; z80.ixh=bytetemph;
      }
      break;
    case 0xe5:		/* PUSH REGISTER */
      z80.tstates++;
      { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.ixh)); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.ixl));};
      break;
    case 0xe9:		/* JP REGISTER */
      z80.pc=(z80.ixl | (z80.ixh << 8));		/* NB: NOT INDIRECT! */
      break;
    case 0xf9:		/* LD SP,REGISTER */
      z80.tstates += 2;
      z80.sp=(z80.ixl | (z80.ixh << 8));
      break;
    default:		/* Instruction did not involve H or L, so backtrack
			   one instruction and parse again */
      z80.pc--;		/* FIXME: will be contended again */
      z80.pc &= 0xffff;
      z80.r--;		/* Decrement the R register as well */
      z80.r &= 0x7f;
      break;





	}



      }
      break;
    case 0xde:		/* SBC A,nn */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( z80.pc++ );
	{ var sbctemp = z80.a - (bytetemp) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0xdf:		/* RST 18 */
      z80.tstates++;
      { { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x18);};
      break;
    case 0xe0:		/* RET PO */
      z80.tstates++;
      if( ! ( z80.f & 0x04 ) ) { { { z80.tstates += (3);; var lowbyte =z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; var highbyte=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xe1:		/* POP HL */
      { z80.tstates += (3);; (z80.l)=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; (z80.h)=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff;};
      break;
    case 0xe2:		/* JP PO,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( ! ( z80.f & 0x04 ) ) { { var jptemp=z80.pc; var pcl =z80.readbyte_internal(jptemp++); jptemp &= 0xffff; var pch =z80.readbyte_internal(jptemp); z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xe3:		/* EX (SP),HL */
      {
	let bytetempl = z80.readbyte_internal( z80.sp     ),
	                 bytetemph = z80.readbyte_internal( z80.sp + 1 );
	z80.tstates += ( 3 );; z80.tstates += ( 4 );;
	z80.tstates += ( 3 );; z80.tstates += ( 5 );;
	z80.writebyte_internal(z80.sp+1,z80.h); z80.writebyte_internal(z80.sp,z80.l);
	z80.l=bytetempl; z80.h=bytetemph;
      }
      break;
    case 0xe4:		/* CALL PO,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( ! ( z80.f & 0x04 ) ) { { var calltempl, calltemph; calltempl=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (1);; calltemph=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xe5:		/* PUSH HL */
      z80.tstates++;
      { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.h)); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.l));};
      break;
    case 0xe6:		/* AND nn */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( z80.pc++ );
	{ z80.a &= (bytetemp); z80.f = 0x10 | sz53p_table[z80.a];};
      }
      break;
    case 0xe7:		/* RST 20 */
      z80.tstates++;
      { { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x20);};
      break;
    case 0xe8:		/* RET PE */
      z80.tstates++;
      if( z80.f & 0x04 ) { { { z80.tstates += (3);; var lowbyte =z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; var highbyte=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xe9:		/* JP HL */
      z80.pc=(z80.l | (z80.h << 8));		/* NB: NOT INDIRECT! */
      break;
    case 0xea:		/* JP PE,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( z80.f & 0x04 ) { { var jptemp=z80.pc; var pcl =z80.readbyte_internal(jptemp++); jptemp &= 0xffff; var pch =z80.readbyte_internal(jptemp); z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xeb:		/* EX DE,HL */
      {
	let bytetemp;
	bytetemp = z80.d; z80.d = z80.h; z80.h = bytetemp;
	bytetemp = z80.e; z80.e = z80.l; z80.l = bytetemp;
      }
      break;
    case 0xec:		/* CALL PE,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( z80.f & 0x04 ) { { var calltempl, calltemph; calltempl=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (1);; calltemph=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xed:		/* shift ED */
      {
	var opcode2;
	z80.tstates += ( 4 );;
	opcode2 = z80.readbyte_internal( z80.pc++ );
	z80.pc &= 0xffff;
	z80.r = (z80.r+1) & 0x7f;

	switch(opcode2) {

/* opcodes_ed.c: Z80 CBxx opcodes
   Copyright (c) 1999-2008 Philip Kendall, Matthew Westcott

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
	
	Contact details: <matthew@west.co.tt>
	Matthew Westcott, 14 Daisy Hill Drive, Adlington, Chorley, Lancs PR6 9NE UNITED KINGDOM

*/

/* NB: this file is autogenerated by 'z80.pl' from 'opcodes_ed.dat',
   and included in 'z80_ops.jscpp' */

    case 0x40:		/* IN B,(C) */
      z80.tstates += 1;
      { z80.tstates += (3);; (z80.b)=z80.readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(z80.b)];};
      break;
    case 0x41:		/* OUT (C),B */
      z80.tstates += 1;
      { z80.tstates += (3);; z80.writeport((z80.c | (z80.b << 8)),z80.b);};
      break;
    case 0x42:		/* SBC HL,BC */
      z80.tstates += 7;
      { var sub16temp = (z80.l | (z80.h << 8)) - ((z80.c | (z80.b << 8))) - (z80.f & 0x01); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( ((z80.c | (z80.b << 8))) & 0x8800 ) >> 10 ) | ( ( sub16temp & 0x8800 ) >> 9 ); z80.h = (sub16temp >> 8) & 0xff; z80.l = sub16temp & 0xff; z80.f = ( sub16temp & 0x10000 ? 0x01 : 0 ) | 0x02 | overflow_sub_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_sub_table[lookup&0x07] | ( (z80.l | (z80.h << 8)) ? 0 : 0x40) ;};
      break;
    case 0x43:		/* LD (nnnn),BC */
      { var ldtemp; z80.tstates += (3);; ldtemp=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (3);; ldtemp|=z80.readbyte_internal(z80.pc++) << 8; z80.pc &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(ldtemp++,(z80.c)); ldtemp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(ldtemp,(z80.b));};
      break;
    case 0x44:
    case 0x4c:
    case 0x54:
    case 0x5c:
    case 0x64:
    case 0x6c:
    case 0x74:
    case 0x7c:		/* NEG */
      {
	let bytetemp=z80.a;
	z80.a=0;
	{ var subtemp = z80.a - (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x45:
    case 0x4d:
    case 0x55:
    case 0x5d:
    case 0x65:
    case 0x6d:
    case 0x75:
    case 0x7d:		/* RETN */
      z80.iff1=z80.iff2;
      { { z80.tstates += (3);; var lowbyte =z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; var highbyte=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};};
      break;
    case 0x46:
    case 0x4e:
    case 0x66:
    case 0x6e:		/* IM 0 */
      z80.im=0;
      break;
    case 0x47:		/* LD I,A */
      z80.tstates += 1;
      z80.i=z80.a;
      break;
    case 0x48:		/* IN C,(C) */
      z80.tstates += 1;
      { z80.tstates += (3);; (z80.c)=z80.readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(z80.c)];};
      break;
    case 0x49:		/* OUT (C),C */
      z80.tstates += 1;
      { z80.tstates += (3);; z80.writeport((z80.c | (z80.b << 8)),z80.c);};
      break;
    case 0x4a:		/* ADC HL,BC */
      z80.tstates += 7;
      { let add16temp= (z80.l | (z80.h << 8)) + ((z80.c | (z80.b << 8))) + ( z80.f & 0x01 ); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( ((z80.c | (z80.b << 8))) & 0x8800 ) >> 10 ) | ( ( add16temp & 0x8800 ) >> 9 ); z80.h = (add16temp >> 8) & 0xff; z80.l = add16temp & 0xff; z80.f = ( add16temp & 0x10000 ? 0x01 : 0 )| overflow_add_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_add_table[lookup&0x07]| ( (z80.l | (z80.h << 8)) ? 0 : 0x40 );};
      break;
    case 0x4b:		/* LD BC,(nnnn) */
      { var ldtemp; z80.tstates += (3);; ldtemp=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (3);; ldtemp|=z80.readbyte_internal(z80.pc++) << 8; z80.pc &= 0xffff; z80.tstates += (3);; (z80.c)=z80.readbyte_internal(ldtemp++); ldtemp &= 0xffff; z80.tstates += (3);; (z80.b)=z80.readbyte_internal(ldtemp);};
      break;
    case 0x4f:		/* LD R,A */
      z80.tstates += 1;
      /* Keep the RZX instruction counter right */
      /* rzx_instructions_offset += ( R - A ); */
      z80.r=z80.r7=z80.a;
      break;
    case 0x50:		/* IN D,(C) */
      z80.tstates += 1;
      { z80.tstates += (3);; (z80.d)=z80.readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(z80.d)];};
      break;
    case 0x51:		/* OUT (C),D */
      z80.tstates += 1;
      { z80.tstates += (3);; z80.writeport((z80.c | (z80.b << 8)),z80.d);};
      break;
    case 0x52:		/* SBC HL,DE */
      z80.tstates += 7;
      { var sub16temp = (z80.l | (z80.h << 8)) - ((z80.e | (z80.d << 8))) - (z80.f & 0x01); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( ((z80.e | (z80.d << 8))) & 0x8800 ) >> 10 ) | ( ( sub16temp & 0x8800 ) >> 9 ); z80.h = (sub16temp >> 8) & 0xff; z80.l = sub16temp & 0xff; z80.f = ( sub16temp & 0x10000 ? 0x01 : 0 ) | 0x02 | overflow_sub_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_sub_table[lookup&0x07] | ( (z80.l | (z80.h << 8)) ? 0 : 0x40) ;};
      break;
    case 0x53:		/* LD (nnnn),DE */
      { var ldtemp; z80.tstates += (3);; ldtemp=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (3);; ldtemp|=z80.readbyte_internal(z80.pc++) << 8; z80.pc &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(ldtemp++,(z80.e)); ldtemp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(ldtemp,(z80.d));};
      break;
    case 0x56:
    case 0x76:		/* IM 1 */
      z80.im=1;
      break;
    case 0x57:		/* LD A,I */
      z80.tstates += 1;
      z80.a=z80.i;
      z80.f = ( z80.f & 0x01 ) | sz53_table[z80.a] | ( z80.iff2 ? 0x04 : 0 );
      break;
    case 0x58:		/* IN E,(C) */
      z80.tstates += 1;
      { z80.tstates += (3);; (z80.e)=z80.readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(z80.e)];};
      break;
    case 0x59:		/* OUT (C),E */
      z80.tstates += 1;
      { z80.tstates += (3);; z80.writeport((z80.c | (z80.b << 8)),z80.e);};
      break;
    case 0x5a:		/* ADC HL,DE */
      z80.tstates += 7;
      { let add16temp= (z80.l | (z80.h << 8)) + ((z80.e | (z80.d << 8))) + ( z80.f & 0x01 ); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( ((z80.e | (z80.d << 8))) & 0x8800 ) >> 10 ) | ( ( add16temp & 0x8800 ) >> 9 ); z80.h = (add16temp >> 8) & 0xff; z80.l = add16temp & 0xff; z80.f = ( add16temp & 0x10000 ? 0x01 : 0 )| overflow_add_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_add_table[lookup&0x07]| ( (z80.l | (z80.h << 8)) ? 0 : 0x40 );};
      break;
    case 0x5b:		/* LD DE,(nnnn) */
      { var ldtemp; z80.tstates += (3);; ldtemp=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (3);; ldtemp|=z80.readbyte_internal(z80.pc++) << 8; z80.pc &= 0xffff; z80.tstates += (3);; (z80.e)=z80.readbyte_internal(ldtemp++); ldtemp &= 0xffff; z80.tstates += (3);; (z80.d)=z80.readbyte_internal(ldtemp);};
      break;
    case 0x5e:
    case 0x7e:		/* IM 2 */
      z80.im=2;
      break;
    case 0x5f:		/* LD A,R */
      z80.tstates += 1;
      z80.a=(z80.r&0x7f) | (z80.r7&0x80);
      z80.f = ( z80.f & 0x01 ) | sz53_table[z80.a] | ( z80.iff2 ? 0x04 : 0 );
      break;
    case 0x60:		/* IN H,(C) */
      z80.tstates += 1;
      { z80.tstates += (3);; (z80.h)=z80.readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(z80.h)];};
      break;
    case 0x61:		/* OUT (C),H */
      z80.tstates += 1;
      { z80.tstates += (3);; z80.writeport((z80.c | (z80.b << 8)),z80.h);};
      break;
    case 0x62:		/* SBC HL,HL */
      z80.tstates += 7;
      { var sub16temp = (z80.l | (z80.h << 8)) - ((z80.l | (z80.h << 8))) - (z80.f & 0x01); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( ((z80.l | (z80.h << 8))) & 0x8800 ) >> 10 ) | ( ( sub16temp & 0x8800 ) >> 9 ); z80.h = (sub16temp >> 8) & 0xff; z80.l = sub16temp & 0xff; z80.f = ( sub16temp & 0x10000 ? 0x01 : 0 ) | 0x02 | overflow_sub_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_sub_table[lookup&0x07] | ( (z80.l | (z80.h << 8)) ? 0 : 0x40) ;};
      break;
    case 0x63:		/* LD (nnnn),HL */
      { var ldtemp; z80.tstates += (3);; ldtemp=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (3);; ldtemp|=z80.readbyte_internal(z80.pc++) << 8; z80.pc &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(ldtemp++,(z80.l)); ldtemp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(ldtemp,(z80.h));};
      break;
    case 0x67:		/* RRD */
      {
	let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	z80.tstates += ( 7 );; z80.tstates += ( 3 );;
	z80.writebyte_internal((z80.l | (z80.h << 8)),  ( (z80.a & 0x0f) << 4 ) | ( bytetemp >> 4 ) );
	z80.a = ( z80.a & 0xf0 ) | ( bytetemp & 0x0f );
	z80.f = ( z80.f & 0x01 ) | sz53p_table[z80.a];
      }
      break;
    case 0x68:		/* IN L,(C) */
      z80.tstates += 1;
      { z80.tstates += (3);; (z80.l)=z80.readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(z80.l)];};
      break;
    case 0x69:		/* OUT (C),L */
      z80.tstates += 1;
      { z80.tstates += (3);; z80.writeport((z80.c | (z80.b << 8)),z80.l);};
      break;
    case 0x6a:		/* ADC HL,HL */
      z80.tstates += 7;
      { let add16temp= (z80.l | (z80.h << 8)) + ((z80.l | (z80.h << 8))) + ( z80.f & 0x01 ); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( ((z80.l | (z80.h << 8))) & 0x8800 ) >> 10 ) | ( ( add16temp & 0x8800 ) >> 9 ); z80.h = (add16temp >> 8) & 0xff; z80.l = add16temp & 0xff; z80.f = ( add16temp & 0x10000 ? 0x01 : 0 )| overflow_add_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_add_table[lookup&0x07]| ( (z80.l | (z80.h << 8)) ? 0 : 0x40 );};
      break;
    case 0x6b:		/* LD HL,(nnnn) */
      { var ldtemp; z80.tstates += (3);; ldtemp=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (3);; ldtemp|=z80.readbyte_internal(z80.pc++) << 8; z80.pc &= 0xffff; z80.tstates += (3);; (z80.l)=z80.readbyte_internal(ldtemp++); ldtemp &= 0xffff; z80.tstates += (3);; (z80.h)=z80.readbyte_internal(ldtemp);};
      break;
    case 0x6f:		/* RLD */
      {
	let bytetemp = z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	z80.tstates += ( 7 );; z80.tstates += ( 3 );;
	z80.writebyte_internal((z80.l | (z80.h << 8)), ((bytetemp & 0x0f) << 4 ) | ( z80.a & 0x0f ) );
	z80.a = ( z80.a & 0xf0 ) | ( bytetemp >> 4 );
	z80.f = ( z80.f & 0x01 ) | sz53p_table[z80.a];
      }
      break;
    case 0x70:		/* IN F,(C) */
      z80.tstates += 1;
      {
	let bytetemp: number = 0;
	{ z80.tstates += (3);; (bytetemp)=z80.readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(bytetemp)];};
      }
      break;
    case 0x71:		/* OUT (C),0 */
      z80.tstates += 1;
      { z80.tstates += (3);; z80.writeport((z80.c | (z80.b << 8)),0);};
      break;
    case 0x72:		/* SBC HL,SP */
      z80.tstates += 7;
      { var sub16temp = (z80.l | (z80.h << 8)) - (z80.sp) - (z80.f & 0x01); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( (z80.sp) & 0x8800 ) >> 10 ) | ( ( sub16temp & 0x8800 ) >> 9 ); z80.h = (sub16temp >> 8) & 0xff; z80.l = sub16temp & 0xff; z80.f = ( sub16temp & 0x10000 ? 0x01 : 0 ) | 0x02 | overflow_sub_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_sub_table[lookup&0x07] | ( (z80.l | (z80.h << 8)) ? 0 : 0x40) ;};
      break;
    case 0x73:		/* LD (nnnn),SP */
      { var ldtemp; z80.tstates += (3);; ldtemp=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (3);; ldtemp|=z80.readbyte_internal(z80.pc++) << 8; z80.pc &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(ldtemp++,((z80.sp & 0xff))); ldtemp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(ldtemp,((z80.sp >> 8)));};
      break;
    case 0x78:		/* IN A,(C) */
      z80.tstates += 1;
      { z80.tstates += (3);; (z80.a)=z80.readport(((z80.c | (z80.b << 8)))); z80.f = ( z80.f & 0x01) | sz53p_table[(z80.a)];};
      break;
    case 0x79:		/* OUT (C),A */
      z80.tstates += 1;
      { z80.tstates += (3);; z80.writeport((z80.c | (z80.b << 8)),z80.a);};
      break;
    case 0x7a:		/* ADC HL,SP */
      z80.tstates += 7;
      { let add16temp= (z80.l | (z80.h << 8)) + (z80.sp) + ( z80.f & 0x01 ); var lookup = ( ( (z80.l | (z80.h << 8)) & 0x8800 ) >> 11 ) | ( ( (z80.sp) & 0x8800 ) >> 10 ) | ( ( add16temp & 0x8800 ) >> 9 ); z80.h = (add16temp >> 8) & 0xff; z80.l = add16temp & 0xff; z80.f = ( add16temp & 0x10000 ? 0x01 : 0 )| overflow_add_table[lookup >> 4] | ( z80.h & ( 0x08 | 0x20 | 0x80 ) ) | halfcarry_add_table[lookup&0x07]| ( (z80.l | (z80.h << 8)) ? 0 : 0x40 );};
      break;
    case 0x7b:		/* LD SP,(nnnn) */
      { var ldtemp; z80.tstates += (3);; ldtemp=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (3);; ldtemp|=z80.readbyte_internal(z80.pc++) << 8; z80.pc &= 0xffff; z80.tstates += (3);; var regl = z80.readbyte_internal(ldtemp++); ldtemp &= 0xffff; z80.tstates += (3);; var regh =z80.readbyte_internal(ldtemp); z80.sp = regl | (regh << 8);};
      break;
    case 0xa0:		/* LDI */
      {
	let bytetemp=z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	z80.tstates += ( 3 );; z80.tstates += ( 3 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
	z80.writebyte_internal((z80.e | (z80.d << 8)),bytetemp);
	var detemp = ((z80.e | (z80.d << 8)) + 1) & 0xffff; z80.d = detemp >> 8; z80.e = detemp & 0xff;
	var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	
	bytetemp = (bytetemp + z80.a) & 0xff;
	z80.f = ( z80.f & ( 0x01 | 0x40 | 0x80 ) ) | ( (z80.c | (z80.b << 8)) ? 0x04 : 0 ) |
	  ( bytetemp & 0x08 ) | ( (bytetemp & 0x02) ? 0x20 : 0 );
      }
      break;
    case 0xa1:		/* CPI */
      {
	var value = z80.readbyte_internal( (z80.l | (z80.h << 8)) ), bytetemp = (z80.a - value) & 0xff,
	  lookup = ( (        z80.a & 0x08 ) >> 3 ) |
	           ( (  (value) & 0x08 ) >> 2 ) |
	           ( ( bytetemp & 0x08 ) >> 1 );
	z80.tstates += ( 3 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
	z80.f = ( z80.f & 0x01 ) | ( (z80.c | (z80.b << 8)) ? ( 0x04 | 0x02 ) : 0x02 ) |
	  halfcarry_sub_table[lookup] | ( bytetemp ? 0 : 0x40 ) |
	  ( bytetemp & 0x80 );
	if(z80.f & 0x10) bytetemp--;
	z80.f |= ( bytetemp & 0x08 ) | ( (bytetemp&0x02) ? 0x20 : 0 );
      }
      break;
    case 0xa2:		/* INI */
      {
	var initemp = z80.readport( (z80.c | (z80.b << 8)) );
	z80.tstates += 2; z80.tstates += ( 3 );; z80.tstates += ( 3 );;
	z80.writebyte_internal((z80.l | (z80.h << 8)),initemp);
	z80.b = (z80.b-1)&0xff;
	var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	z80.f = (initemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
	/* C,H and P/V flags not implemented */
      }
      break;
    case 0xa3:		/* OUTI */
      {
	var outitemp=z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	z80.b = (z80.b-1)&0xff;	/* This does happen first, despite what the specs say */
	z80.tstates++; z80.tstates += ( 4 );; z80.tstates += ( 3 );;
	var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	z80.writeport((z80.c | (z80.b << 8)),outitemp);
	z80.f = (outitemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
	/* C,H and P/V flags not implemented */
      }
      break;
    case 0xa8:		/* LDD */
      {
	let bytetemp=z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	z80.tstates += ( 3 );; z80.tstates += ( 3 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
	z80.writebyte_internal((z80.e | (z80.d << 8)),bytetemp);
	var detemp = ((z80.e | (z80.d << 8)) - 1) & 0xffff; z80.d = detemp >> 8; z80.e = detemp & 0xff;
	var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	
	bytetemp = (bytetemp + z80.a) & 0xff;
	z80.f = ( z80.f & ( 0x01 | 0x40 | 0x80 ) ) | ( (z80.c | (z80.b << 8)) ? 0x04 : 0 ) |
	  ( bytetemp & 0x08 ) | ( (bytetemp & 0x02) ? 0x20 : 0 );
      }
      break;
    case 0xa9:		/* CPD */
      {
	var value = z80.readbyte_internal( (z80.l | (z80.h << 8)) ), bytetemp = (z80.a - value) & 0xff,
	  lookup = ( (        z80.a & 0x08 ) >> 3 ) |
	           ( (  (value) & 0x08 ) >> 2 ) |
	           ( ( bytetemp & 0x08 ) >> 1 );
	z80.tstates += ( 3 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
	z80.f = ( z80.f & 0x01 ) | ( (z80.c | (z80.b << 8)) ? ( 0x04 | 0x02 ) : 0x02 ) |
	  halfcarry_sub_table[lookup] | ( bytetemp ? 0 : 0x40 ) |
	  ( bytetemp & 0x80 );
	if(z80.f & 0x10) bytetemp--;
	z80.f |= ( bytetemp & 0x08 ) | ( (bytetemp&0x02) ? 0x20 : 0 );
      }
      break;
    case 0xaa:		/* IND */
      {
	var initemp = z80.readport( (z80.c | (z80.b << 8)) );
	z80.tstates += 2; z80.tstates += ( 3 );; z80.tstates += ( 3 );;
	z80.writebyte_internal((z80.l | (z80.h << 8)),initemp);
	z80.b = (z80.b-1)&0xff;
	var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	z80.f = (initemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
	/* C,H and P/V flags not implemented */
      }
      break;
    case 0xab:		/* OUTD */
      {
	var outitemp=z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	z80.b = (z80.b-1)&0xff;	/* This does happen first, despite what the specs say */
	z80.tstates++; z80.tstates += ( 4 );; z80.tstates += ( 3 );;
	var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	z80.writeport((z80.c | (z80.b << 8)),outitemp);
	z80.f = (outitemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
	/* C,H and P/V flags not implemented */
      }
      break;
    case 0xb0:		/* LDIR */
      {
	let bytetemp=z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	z80.tstates += ( 3 );; z80.tstates += ( 3 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	z80.writebyte_internal((z80.e | (z80.d << 8)),bytetemp);
	var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	var detemp = ((z80.e | (z80.d << 8)) + 1) & 0xffff; z80.d = detemp >> 8; z80.e = detemp & 0xff;
	var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
	bytetemp = (bytetemp + z80.a) & 0xff;
	z80.f = ( z80.f & ( 0x01 | 0x40 | 0x80 ) ) | ( (z80.c | (z80.b << 8)) ? 0x04 : 0 ) |
	  ( bytetemp & 0x08 ) | ( (bytetemp & 0x02) ? 0x20 : 0 );
	if((z80.c | (z80.b << 8))) {
	  z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	  z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	  z80.pc-=2;
	}
      }
      break;
    case 0xb1:		/* CPIR */
      {
	var value = z80.readbyte_internal( (z80.l | (z80.h << 8)) ), bytetemp = (z80.a - value) & 0xff,
	  lookup = ( (        z80.a & 0x08 ) >> 3 ) |
		   ( (  (value) & 0x08 ) >> 2 ) |
		   ( ( bytetemp & 0x08 ) >> 1 );
	z80.tstates += ( 3 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
	z80.f = ( z80.f & 0x01 ) | ( (z80.c | (z80.b << 8)) ? ( 0x04 | 0x02 ) : 0x02 ) |
	  halfcarry_sub_table[lookup] | ( bytetemp ? 0 : 0x40 ) |
	  ( bytetemp & 0x80 );
	if(z80.f & 0x10) bytetemp--;
	z80.f |= ( bytetemp & 0x08 ) | ( (bytetemp&0x02) ? 0x20 : 0 );
	if( ( z80.f & ( 0x04 | 0x40 ) ) == 0x04 ) {
	  z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	  z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	  z80.pc-=2;
	}
      }
      break;
    case 0xb2:		/* INIR */
      {
	var initemp=z80.readport( (z80.c | (z80.b << 8)) );
	z80.tstates += 2; z80.tstates += ( 3 );; z80.tstates += ( 3 );;
	z80.writebyte_internal((z80.l | (z80.h << 8)),initemp);
	z80.b = (z80.b-1)&0xff;
	var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	z80.f = (initemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
	/* C,H and P/V flags not implemented */
	if(z80.b) {
	  z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	  z80.tstates += ( 1 );;
	  z80.pc-=2;
	}
      }
      break;
    case 0xb3:		/* OTIR */
      {
	var outitemp=z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	z80.tstates++; z80.tstates += ( 4 );;
	z80.b = (z80.b-1)&0xff;
	var hltemp = ((z80.l | (z80.h << 8)) + 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	/* This does happen first, despite what the specs say */
	z80.writeport((z80.c | (z80.b << 8)),outitemp);
	z80.f = (outitemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
	/* C,H and P/V flags not implemented */
	if(z80.b) {
	  z80.tstates += ( 1 );;
	  z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	  z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	  z80.tstates += ( 1 );;
	  z80.pc-=2;
	} else {
	  z80.tstates += ( 3 );;
	}
      }
      break;
    case 0xb8:		/* LDDR */
      {
	let bytetemp=z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	z80.tstates += ( 3 );; z80.tstates += ( 3 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	z80.writebyte_internal((z80.e | (z80.d << 8)),bytetemp);
	var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	var detemp = ((z80.e | (z80.d << 8)) - 1) & 0xffff; z80.d = detemp >> 8; z80.e = detemp & 0xff;
	var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
	bytetemp = (bytetemp + z80.a) & 0xff;
	z80.f = ( z80.f & ( 0x01 | 0x40 | 0x80 ) ) | ( (z80.c | (z80.b << 8)) ? 0x04 : 0 ) |
	  ( bytetemp & 0x08 ) | ( (bytetemp & 0x02) ? 0x20 : 0 );
	if((z80.c | (z80.b << 8))) {
	  z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	  z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	  z80.pc-=2;
	}
      }
      break;
    case 0xb9:		/* CPDR */
      {
	var value = z80.readbyte_internal( (z80.l | (z80.h << 8)) ), bytetemp = (z80.a - value) & 0xff,
	  lookup = ( (        z80.a & 0x08 ) >> 3 ) |
		   ( (  (value) & 0x08 ) >> 2 ) |
		   ( ( bytetemp & 0x08 ) >> 1 );
	z80.tstates += ( 3 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	var bctemp = ((z80.c | (z80.b << 8)) - 1) & 0xffff; z80.b = bctemp >> 8; z80.c = bctemp & 0xff;
	z80.f = ( z80.f & 0x01 ) | ( (z80.c | (z80.b << 8)) ? ( 0x04 | 0x02 ) : 0x02 ) |
	  halfcarry_sub_table[lookup] | ( bytetemp ? 0 : 0x40 ) |
	  ( bytetemp & 0x80 );
	if(z80.f & 0x10) bytetemp--;
	z80.f |= ( bytetemp & 0x08 ) | ( (bytetemp&0x02) ? 0x20 : 0 );
	if( ( z80.f & ( 0x04 | 0x40 ) ) == 0x04 ) {
	  z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	  z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	  z80.pc-=2;
	}
      }
      break;
    case 0xba:		/* INDR */
      {
	var initemp=z80.readport( (z80.c | (z80.b << 8)) );
	z80.tstates += 2; z80.tstates += ( 3 );; z80.tstates += ( 3 );;
	z80.writebyte_internal((z80.l | (z80.h << 8)),initemp);
	z80.b = (z80.b-1)&0xff;
	var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	z80.f = (initemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
	/* C,H and P/V flags not implemented */
	if(z80.b) {
	  z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	  z80.tstates += ( 1 );;
	  z80.pc-=2;
	}
      }
      break;
    case 0xbb:		/* OTDR */
      {
	var outitemp=z80.readbyte_internal( (z80.l | (z80.h << 8)) );
	z80.tstates++; z80.tstates += ( 4 );;
	z80.b = (z80.b-1)&0xff;
	var hltemp = ((z80.l | (z80.h << 8)) - 1) & 0xffff; z80.h = hltemp >> 8; z80.l = hltemp & 0xff;
	/* This does happen first, despite what the specs say */
	z80.writeport((z80.c | (z80.b << 8)),outitemp);
	z80.f = (outitemp & 0x80 ? 0x02 : 0 ) | sz53_table[z80.b];
	/* C,H and P/V flags not implemented */
	if(z80.b) {
	  z80.tstates += ( 1 );;
	  z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	  z80.tstates += ( 1 );; z80.tstates += ( 1 );; z80.tstates += ( 1 );;
	  z80.tstates += ( 1 );;
	  z80.pc-=2;
	} else {
	  z80.tstates += ( 3 );;
	}
      }
      break;
    default:		/* All other opcodes are NOPD */
      break;

	}



      }
      break;
    case 0xee:		/* XOR A,nn */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( z80.pc++ );
	{ z80.a ^= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xef:		/* RST 28 */
      z80.tstates++;
      { { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x28);};
      break;
    case 0xf0:		/* RET P */
      z80.tstates++;
      if( ! ( z80.f & 0x80 ) ) { { { z80.tstates += (3);; var lowbyte =z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; var highbyte=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xf1:		/* POP AF */
      { z80.tstates += (3);; (z80.f)=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; (z80.a)=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff;};
      break;
    case 0xf2:		/* JP P,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( ! ( z80.f & 0x80 ) ) { { var jptemp=z80.pc; var pcl =z80.readbyte_internal(jptemp++); jptemp &= 0xffff; var pch =z80.readbyte_internal(jptemp); z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xf3:		/* DI */
      z80.iff1=z80.iff2=0;
      break;
    case 0xf4:		/* CALL P,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( ! ( z80.f & 0x80 ) ) { { var calltempl, calltemph; calltempl=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (1);; calltemph=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xf5:		/* PUSH AF */
      z80.tstates++;
      { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.a)); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.f));};
      break;
    case 0xf6:		/* OR nn */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( z80.pc++ );
	{ z80.a |= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xf7:		/* RST 30 */
      z80.tstates++;
      { { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x30);};
      break;
    case 0xf8:		/* RET M */
      z80.tstates++;
      if( z80.f & 0x80 ) { { { z80.tstates += (3);; var lowbyte =z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; var highbyte=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; (z80.pc) = lowbyte | (highbyte << 8);};}; }
      break;
    case 0xf9:		/* LD SP,HL */
      z80.tstates += 2;
      z80.sp=(z80.l | (z80.h << 8));
      break;
    case 0xfa:		/* JP M,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( z80.f & 0x80 ) { { var jptemp=z80.pc; var pcl =z80.readbyte_internal(jptemp++); jptemp &= 0xffff; var pch =z80.readbyte_internal(jptemp); z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xfb:		/* EI */
      z80.iff1=z80.iff2=1;
      break;
    case 0xfc:		/* CALL M,nnnn */
      z80.tstates += ( 3 );; z80.tstates += ( 3 );;
      if( z80.f & 0x80 ) { { var calltempl, calltemph; calltempl=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (1);; calltemph=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; var pcl=calltempl; var pch=calltemph; z80.pc = pcl | (pch << 8);}; }
      else z80.pc+=2;
      break;
    case 0xfd:		/* shift FD */
      {
	var opcode2;
	z80.tstates += ( 4 );;
	opcode2 = z80.readbyte_internal( z80.pc++ );
	z80.pc &= 0xffff;
	z80.r = (z80.r+1) & 0x7f;

	switch(opcode2) {





/* opcodes_ddfd.c Z80 {DD,FD}xx opcodes
   Copyright (c) 1999-2008 Philip Kendall, Matthew Westcott

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
	
	Contact details: <matthew@west.co.tt>
	Matthew Westcott, 14 Daisy Hill Drive, Adlington, Chorley, Lancs PR6 9NE UNITED KINGDOM

*/

/* NB: this file is autogenerated by 'z80.pl' from 'opcodes_ddfd.dat',
   and included in 'z80_ops.jscpp' */

    case 0x09:		/* ADD REGISTER,BC */
      { let add16temp = ((z80.iyl | (z80.iyh << 8))) + ((z80.c | (z80.b << 8))); var lookup = ( ( ((z80.iyl | (z80.iyh << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.c | (z80.b << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); z80.tstates += 7; (z80.iyh) = (add16temp >> 8) & 0xff; (z80.iyl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x19:		/* ADD REGISTER,DE */
      { let add16temp = ((z80.iyl | (z80.iyh << 8))) + ((z80.e | (z80.d << 8))); var lookup = ( ( ((z80.iyl | (z80.iyh << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.e | (z80.d << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); z80.tstates += 7; (z80.iyh) = (add16temp >> 8) & 0xff; (z80.iyl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x21:		/* LD REGISTER,nnnn */
      z80.tstates += ( 3 );;
      z80.iyl=z80.readbyte_internal(z80.pc++);
      z80.pc &= 0xffff;
      z80.tstates += ( 3 );;
      z80.iyh=z80.readbyte_internal(z80.pc++);
      z80.pc &= 0xffff;
      break;
    case 0x22:		/* LD (nnnn),REGISTER */
      { var ldtemp; z80.tstates += (3);; ldtemp=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (3);; ldtemp|=z80.readbyte_internal(z80.pc++) << 8; z80.pc &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(ldtemp++,(z80.iyl)); ldtemp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(ldtemp,(z80.iyh));};
      break;
    case 0x23:		/* INC REGISTER */
      z80.tstates += 2;
      wordtemp = ((z80.iyl | (z80.iyh << 8)) + 1) & 0xffff;
      z80.iyh = wordtemp >> 8;
      z80.iyl = wordtemp & 0xff;
      break;
    case 0x24:		/* INC REGISTERH */
      { (z80.iyh) = ((z80.iyh) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.iyh)==0x80 ? 0x04 : 0 ) | ( (z80.iyh)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.iyh)];};
      break;
    case 0x25:		/* DEC REGISTERH */
      { z80.f = ( z80.f & 0x01 ) | ( (z80.iyh)&0x0f ? 0 : 0x10 ) | 0x02; (z80.iyh) = ((z80.iyh) - 1) & 0xff; z80.f |= ( (z80.iyh)==0x7f ? 0x04 : 0 ) | sz53_table[z80.iyh];};
      break;
    case 0x26:		/* LD REGISTERH,nn */
      z80.tstates += ( 3 );;
      z80.iyh=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff;
      break;
    case 0x29:		/* ADD REGISTER,REGISTER */
      { let add16temp = ((z80.iyl | (z80.iyh << 8))) + ((z80.iyl | (z80.iyh << 8))); var lookup = ( ( ((z80.iyl | (z80.iyh << 8))) & 0x0800 ) >> 11 ) | ( ( ((z80.iyl | (z80.iyh << 8))) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); z80.tstates += 7; (z80.iyh) = (add16temp >> 8) & 0xff; (z80.iyl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x2a:		/* LD REGISTER,(nnnn) */
      { var ldtemp; z80.tstates += (3);; ldtemp=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff; z80.tstates += (3);; ldtemp|=z80.readbyte_internal(z80.pc++) << 8; z80.pc &= 0xffff; z80.tstates += (3);; (z80.iyl)=z80.readbyte_internal(ldtemp++); ldtemp &= 0xffff; z80.tstates += (3);; (z80.iyh)=z80.readbyte_internal(ldtemp);};
      break;
    case 0x2b:		/* DEC REGISTER */
      z80.tstates += 2;
      wordtemp = ((z80.iyl | (z80.iyh << 8)) - 1) & 0xffff;
      z80.iyh = wordtemp >> 8;
      z80.iyl = wordtemp & 0xff;
      break;
    case 0x2c:		/* INC REGISTERL */
      { (z80.iyl) = ((z80.iyl) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (z80.iyl)==0x80 ? 0x04 : 0 ) | ( (z80.iyl)&0x0f ? 0 : 0x10 ) | sz53_table[(z80.iyl)];};
      break;
    case 0x2d:		/* DEC REGISTERL */
      { z80.f = ( z80.f & 0x01 ) | ( (z80.iyl)&0x0f ? 0 : 0x10 ) | 0x02; (z80.iyl) = ((z80.iyl) - 1) & 0xff; z80.f |= ( (z80.iyl)==0x7f ? 0x04 : 0 ) | sz53_table[z80.iyl];};
      break;
    case 0x2e:		/* LD REGISTERL,nn */
      z80.tstates += ( 3 );;
      z80.iyl=z80.readbyte_internal(z80.pc++); z80.pc &= 0xffff;
      break;
    case 0x34:		/* INC (REGISTER+dd) */
      z80.tstates += 15;		/* FIXME: how is this contended? */
      {
	wordtemp =
	    ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff;
	z80.pc &= 0xffff;
	let bytetemp = z80.readbyte_internal( wordtemp );
	{ (bytetemp) = ((bytetemp) + 1) & 0xff; z80.f = ( z80.f & 0x01 ) | ( (bytetemp)==0x80 ? 0x04 : 0 ) | ( (bytetemp)&0x0f ? 0 : 0x10 ) | sz53_table[(bytetemp)];};
	z80.writebyte_internal(wordtemp,bytetemp);
      }
      break;
    case 0x35:		/* DEC (REGISTER+dd) */
      z80.tstates += 15;		/* FIXME: how is this contended? */
      {
	wordtemp =
	    ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff;
	z80.pc &= 0xffff;
	let bytetemp = z80.readbyte_internal( wordtemp );
	{ z80.f = ( z80.f & 0x01 ) | ( (bytetemp)&0x0f ? 0 : 0x10 ) | 0x02; (bytetemp) = ((bytetemp) - 1) & 0xff; z80.f |= ( (bytetemp)==0x7f ? 0x04 : 0 ) | sz53_table[bytetemp];};
	z80.writebyte_internal(wordtemp,bytetemp);
      }
      break;
    case 0x36:		/* LD (REGISTER+dd),nn */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	wordtemp =
	    ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff;
	z80.pc &= 0xffff;
	z80.writebyte_internal(wordtemp,z80.readbyte_internal(z80.pc++));
	z80.pc &= 0xffff;
      }
      break;
    case 0x39:		/* ADD REGISTER,SP */
      { let add16temp = ((z80.iyl | (z80.iyh << 8))) + (z80.sp); var lookup = ( ( ((z80.iyl | (z80.iyh << 8))) & 0x0800 ) >> 11 ) | ( ( (z80.sp) & 0x0800 ) >> 10 ) | ( ( add16temp & 0x0800 ) >> 9 ); z80.tstates += 7; (z80.iyh) = (add16temp >> 8) & 0xff; (z80.iyl) = add16temp & 0xff; z80.f = ( z80.f & ( 0x04 | 0x40 | 0x80 ) ) | ( add16temp & 0x10000 ? 0x01 : 0 )| ( ( add16temp >> 8 ) & ( 0x08 | 0x20 ) ) | halfcarry_add_table[lookup];};
      break;
    case 0x44:		/* LD B,REGISTERH */
      z80.b=z80.iyh;
      break;
    case 0x45:		/* LD B,REGISTERL */
      z80.b=z80.iyl;
      break;
    case 0x46:		/* LD B,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.b = z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
      z80.pc &= 0xffff;
      break;
    case 0x4c:		/* LD C,REGISTERH */
      z80.c=z80.iyh;
      break;
    case 0x4d:		/* LD C,REGISTERL */
      z80.c=z80.iyl;
      break;
    case 0x4e:		/* LD C,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.c = z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
      z80.pc &= 0xffff;
      break;
    case 0x54:		/* LD D,REGISTERH */
      z80.d=z80.iyh;
      break;
    case 0x55:		/* LD D,REGISTERL */
      z80.d=z80.iyl;
      break;
    case 0x56:		/* LD D,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.d = z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
      z80.pc &= 0xffff;
      break;
    case 0x5c:		/* LD E,REGISTERH */
      z80.e=z80.iyh;
      break;
    case 0x5d:		/* LD E,REGISTERL */
      z80.e=z80.iyl;
      break;
    case 0x5e:		/* LD E,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.e = z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
      z80.pc &= 0xffff;
      break;
    case 0x60:		/* LD REGISTERH,B */
      z80.iyh=z80.b;
      break;
    case 0x61:		/* LD REGISTERH,C */
      z80.iyh=z80.c;
      break;
    case 0x62:		/* LD REGISTERH,D */
      z80.iyh=z80.d;
      break;
    case 0x63:		/* LD REGISTERH,E */
      z80.iyh=z80.e;
      break;
    case 0x64:		/* LD REGISTERH,REGISTERH */
      break;
    case 0x65:		/* LD REGISTERH,REGISTERL */
      z80.iyh=z80.iyl;
      break;
    case 0x66:		/* LD H,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.h = z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
      z80.pc &= 0xffff;
      break;
    case 0x67:		/* LD REGISTERH,A */
      z80.iyh=z80.a;
      break;
    case 0x68:		/* LD REGISTERL,B */
      z80.iyl=z80.b;
      break;
    case 0x69:		/* LD REGISTERL,C */
      z80.iyl=z80.c;
      break;
    case 0x6a:		/* LD REGISTERL,D */
      z80.iyl=z80.d;
      break;
    case 0x6b:		/* LD REGISTERL,E */
      z80.iyl=z80.e;
      break;
    case 0x6c:		/* LD REGISTERL,REGISTERH */
      z80.iyl=z80.iyh;
      break;
    case 0x6d:		/* LD REGISTERL,REGISTERL */
      break;
    case 0x6e:		/* LD L,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.l = z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
      z80.pc &= 0xffff;
      break;
    case 0x6f:		/* LD REGISTERL,A */
      z80.iyl=z80.a;
      break;
    case 0x70:		/* LD (REGISTER+dd),B */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.writebyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff, z80.b );
      z80.pc &= 0xffff;
      break;
    case 0x71:		/* LD (REGISTER+dd),C */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.writebyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff, z80.c );
      z80.pc &= 0xffff;
      break;
    case 0x72:		/* LD (REGISTER+dd),D */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.writebyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff, z80.d );
      z80.pc &= 0xffff;
      break;
    case 0x73:		/* LD (REGISTER+dd),E */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.writebyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff, z80.e );
      z80.pc &= 0xffff;
      break;
    case 0x74:		/* LD (REGISTER+dd),H */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.writebyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff, z80.h );
      z80.pc &= 0xffff;
      break;
    case 0x75:		/* LD (REGISTER+dd),L */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.writebyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff, z80.l );
      z80.pc &= 0xffff;
      break;
    case 0x77:		/* LD (REGISTER+dd),A */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.writebyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff, z80.a );
      z80.pc &= 0xffff;
      break;
    case 0x7c:		/* LD A,REGISTERH */
      z80.a=z80.iyh;
      break;
    case 0x7d:		/* LD A,REGISTERL */
      z80.a=z80.iyl;
      break;
    case 0x7e:		/* LD A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      z80.a = z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
      z80.pc &= 0xffff;
      break;
    case 0x84:		/* ADD A,REGISTERH */
      { var addtemp = z80.a + (z80.iyh); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyh) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x85:		/* ADD A,REGISTERL */
      { var addtemp = z80.a + (z80.iyl); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyl) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x86:		/* ADD A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ var addtemp = z80.a + (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( addtemp & 0x88 ) >> 1 ); z80.a=addtemp & 0xff; z80.f = ( addtemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x8c:		/* ADC A,REGISTERH */
      { var adctemp = z80.a + (z80.iyh) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyh) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8d:		/* ADC A,REGISTERL */
      { var adctemp = z80.a + (z80.iyl) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyl) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x8e:		/* ADC A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ var adctemp = z80.a + (bytetemp) + ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( adctemp & 0x88 ) >> 1 ); z80.a=adctemp & 0xff; z80.f = ( adctemp & 0x100 ? 0x01 : 0 ) | halfcarry_add_table[lookup & 0x07] | overflow_add_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x94:		/* SUB A,REGISTERH */
      { var subtemp = z80.a - (z80.iyh); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyh) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x95:		/* SUB A,REGISTERL */
      { var subtemp = z80.a - (z80.iyl); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyl) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x96:		/* SUB A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ var subtemp = z80.a - (bytetemp); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( (subtemp & 0x88 ) >> 1 ); z80.a=subtemp & 0xff; z80.f = ( subtemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0x9c:		/* SBC A,REGISTERH */
      { var sbctemp = z80.a - (z80.iyh) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyh) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9d:		/* SBC A,REGISTERL */
      { var sbctemp = z80.a - (z80.iyl) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyl) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      break;
    case 0x9e:		/* SBC A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ var sbctemp = z80.a - (bytetemp) - ( z80.f & 0x01 ); var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( sbctemp & 0x88 ) >> 1 ); z80.a=sbctemp & 0xff; z80.f = ( sbctemp & 0x100 ? 0x01 : 0 ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | sz53_table[z80.a];};
      }
      break;
    case 0xa4:		/* AND A,REGISTERH */
      { z80.a &= (z80.iyh); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa5:		/* AND A,REGISTERL */
      { z80.a &= (z80.iyl); z80.f = 0x10 | sz53p_table[z80.a];};
      break;
    case 0xa6:		/* AND A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ z80.a &= (bytetemp); z80.f = 0x10 | sz53p_table[z80.a];};
      }
      break;
    case 0xac:		/* XOR A,REGISTERH */
      { z80.a ^= (z80.iyh); z80.f = sz53p_table[z80.a];};
      break;
    case 0xad:		/* XOR A,REGISTERL */
      { z80.a ^= (z80.iyl); z80.f = sz53p_table[z80.a];};
      break;
    case 0xae:		/* XOR A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ z80.a ^= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xb4:		/* OR A,REGISTERH */
      { z80.a |= (z80.iyh); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb5:		/* OR A,REGISTERL */
      { z80.a |= (z80.iyl); z80.f = sz53p_table[z80.a];};
      break;
    case 0xb6:		/* OR A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ z80.a |= (bytetemp); z80.f = sz53p_table[z80.a];};
      }
      break;
    case 0xbc:		/* CP A,REGISTERH */
      { var cptemp = z80.a - z80.iyh; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyh) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.iyh & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbd:		/* CP A,REGISTERL */
      { var cptemp = z80.a - z80.iyl; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (z80.iyl) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( z80.iyl & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      break;
    case 0xbe:		/* CP A,(REGISTER+dd) */
      z80.tstates += 11;		/* FIXME: how is this contended? */
      {
	let bytetemp = 
	    z80.readbyte_internal( ((z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ))) & 0xffff );
	    z80.pc &= 0xffff;
	{ var cptemp = z80.a - bytetemp; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( bytetemp & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      }
      break;
    case 0xcb:		/* shift DDFDCB */
      /* FIXME: contention here is just a guess */
      {
	var tempaddr; var opcode3;
	z80.tstates += ( 3 );;
	tempaddr =
	    (z80.iyl | (z80.iyh << 8)) + sign_extend(z80.readbyte_internal( z80.pc++ ));
	z80.pc &= 0xffff;
	z80.tstates += ( 4 );;
	opcode3 = z80.readbyte_internal( z80.pc++ );
	z80.pc &= 0xffff;

	switch(opcode3) {

/* opcodes_ddfdcb.c Z80 {DD,FD}CBxx opcodes
   Copyright (c) 1999-2008 Philip Kendall, Matthew Westcott

	This program is free software: you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation, either version 3 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with this program.  If not, see <http://www.gnu.org/licenses/>.
	
	Contact details: <matthew@west.co.tt>
	Matthew Westcott, 14 Daisy Hill Drive, Adlington, Chorley, Lancs PR6 9NE UNITED KINGDOM

*/

/* NB: this file is autogenerated by 'z80.pl' from 'opcodes_ddfdcb.dat',
   and included in 'z80_ops.jscpp' */

    case 0x00:		/* LD B,RLC (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { (z80.b) = ( ((z80.b) & 0x7f)<<1 ) | ( (z80.b)>>7 ); z80.f = ( (z80.b) & 0x01 ) | sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x01:		/* LD C,RLC (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { (z80.c) = ( ((z80.c) & 0x7f)<<1 ) | ( (z80.c)>>7 ); z80.f = ( (z80.c) & 0x01 ) | sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x02:		/* LD D,RLC (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { (z80.d) = ( ((z80.d) & 0x7f)<<1 ) | ( (z80.d)>>7 ); z80.f = ( (z80.d) & 0x01 ) | sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x03:		/* LD E,RLC (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { (z80.e) = ( ((z80.e) & 0x7f)<<1 ) | ( (z80.e)>>7 ); z80.f = ( (z80.e) & 0x01 ) | sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x04:		/* LD H,RLC (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { (z80.h) = ( ((z80.h) & 0x7f)<<1 ) | ( (z80.h)>>7 ); z80.f = ( (z80.h) & 0x01 ) | sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x05:		/* LD L,RLC (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { (z80.l) = ( ((z80.l) & 0x7f)<<1 ) | ( (z80.l)>>7 ); z80.f = ( (z80.l) & 0x01 ) | sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x06:		/* RLC (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ (bytetemp) = ( ((bytetemp) & 0x7f)<<1 ) | ( (bytetemp)>>7 ); z80.f = ( (bytetemp) & 0x01 ) | sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x07:		/* LD A,RLC (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { (z80.a) = ( ((z80.a) & 0x7f)<<1 ) | ( (z80.a)>>7 ); z80.f = ( (z80.a) & 0x01 ) | sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x08:		/* LD B,RRC (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.b) & 0x01; (z80.b) = ( (z80.b)>>1 ) | ( ((z80.b) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x09:		/* LD C,RRC (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.c) & 0x01; (z80.c) = ( (z80.c)>>1 ) | ( ((z80.c) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x0a:		/* LD D,RRC (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.d) & 0x01; (z80.d) = ( (z80.d)>>1 ) | ( ((z80.d) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x0b:		/* LD E,RRC (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.e) & 0x01; (z80.e) = ( (z80.e)>>1 ) | ( ((z80.e) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x0c:		/* LD H,RRC (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.h) & 0x01; (z80.h) = ( (z80.h)>>1 ) | ( ((z80.h) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x0d:		/* LD L,RRC (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.l) & 0x01; (z80.l) = ( (z80.l)>>1 ) | ( ((z80.l) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x0e:		/* RRC (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ z80.f = (bytetemp) & 0x01; (bytetemp) = ( (bytetemp)>>1 ) | ( ((bytetemp) & 0x01)<<7 ); z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x0f:		/* LD A,RRC (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.a) & 0x01; (z80.a) = ( (z80.a)>>1 ) | ( ((z80.a) & 0x01)<<7 ); z80.f |= sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x10:		/* LD B,RL (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { var rltemp = (z80.b); (z80.b) = ( ((z80.b) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x11:		/* LD C,RL (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { var rltemp = (z80.c); (z80.c) = ( ((z80.c) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x12:		/* LD D,RL (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { var rltemp = (z80.d); (z80.d) = ( ((z80.d) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x13:		/* LD E,RL (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { var rltemp = (z80.e); (z80.e) = ( ((z80.e) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x14:		/* LD H,RL (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { var rltemp = (z80.h); (z80.h) = ( ((z80.h) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x15:		/* LD L,RL (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { var rltemp = (z80.l); (z80.l) = ( ((z80.l) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x16:		/* RL (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ var rltemp = (bytetemp); (bytetemp) = ( ((bytetemp) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x17:		/* LD A,RL (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { var rltemp = (z80.a); (z80.a) = ( ((z80.a) & 0x7f)<<1 ) | ( z80.f & 0x01 ); z80.f = ( rltemp >> 7 ) | sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x18:		/* LD B,RR (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { var rrtemp = (z80.b); (z80.b) = ( (z80.b)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x19:		/* LD C,RR (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { var rrtemp = (z80.c); (z80.c) = ( (z80.c)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x1a:		/* LD D,RR (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { var rrtemp = (z80.d); (z80.d) = ( (z80.d)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x1b:		/* LD E,RR (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { var rrtemp = (z80.e); (z80.e) = ( (z80.e)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x1c:		/* LD H,RR (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { var rrtemp = (z80.h); (z80.h) = ( (z80.h)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x1d:		/* LD L,RR (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { var rrtemp = (z80.l); (z80.l) = ( (z80.l)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x1e:		/* RR (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ var rrtemp = (bytetemp); (bytetemp) = ( (bytetemp)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x1f:		/* LD A,RR (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { var rrtemp = (z80.a); (z80.a) = ( (z80.a)>>1 ) | ( (z80.f & 0x01) << 7 ); z80.f = ( rrtemp & 0x01 ) | sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x20:		/* LD B,SLA (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.b) >> 7; (z80.b) <<= 1; (z80.b) &= 0xff; z80.f |= sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x21:		/* LD C,SLA (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.c) >> 7; (z80.c) <<= 1; (z80.c) &= 0xff; z80.f |= sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x22:		/* LD D,SLA (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.d) >> 7; (z80.d) <<= 1; (z80.d) &= 0xff; z80.f |= sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x23:		/* LD E,SLA (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.e) >> 7; (z80.e) <<= 1; (z80.e) &= 0xff; z80.f |= sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x24:		/* LD H,SLA (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.h) >> 7; (z80.h) <<= 1; (z80.h) &= 0xff; z80.f |= sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x25:		/* LD L,SLA (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.l) >> 7; (z80.l) <<= 1; (z80.l) &= 0xff; z80.f |= sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x26:		/* SLA (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ z80.f = (bytetemp) >> 7; (bytetemp) <<= 1; (bytetemp) &= 0xff; z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x27:		/* LD A,SLA (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.a) >> 7; (z80.a) <<= 1; (z80.a) &= 0xff; z80.f |= sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x28:		/* LD B,SRA (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.b) & 0x01; (z80.b) = ( (z80.b) & 0x80 ) | ( (z80.b) >> 1 ); z80.f |= sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x29:		/* LD C,SRA (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.c) & 0x01; (z80.c) = ( (z80.c) & 0x80 ) | ( (z80.c) >> 1 ); z80.f |= sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x2a:		/* LD D,SRA (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.d) & 0x01; (z80.d) = ( (z80.d) & 0x80 ) | ( (z80.d) >> 1 ); z80.f |= sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x2b:		/* LD E,SRA (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.e) & 0x01; (z80.e) = ( (z80.e) & 0x80 ) | ( (z80.e) >> 1 ); z80.f |= sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x2c:		/* LD H,SRA (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.h) & 0x01; (z80.h) = ( (z80.h) & 0x80 ) | ( (z80.h) >> 1 ); z80.f |= sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x2d:		/* LD L,SRA (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.l) & 0x01; (z80.l) = ( (z80.l) & 0x80 ) | ( (z80.l) >> 1 ); z80.f |= sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x2e:		/* SRA (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ z80.f = (bytetemp) & 0x01; (bytetemp) = ( (bytetemp) & 0x80 ) | ( (bytetemp) >> 1 ); z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x2f:		/* LD A,SRA (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.a) & 0x01; (z80.a) = ( (z80.a) & 0x80 ) | ( (z80.a) >> 1 ); z80.f |= sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x30:		/* LD B,SLL (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.b) >> 7; (z80.b) = ( (z80.b) << 1 ) | 0x01; (z80.b) &= 0xff; z80.f |= sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x31:		/* LD C,SLL (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.c) >> 7; (z80.c) = ( (z80.c) << 1 ) | 0x01; (z80.c) &= 0xff; z80.f |= sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x32:		/* LD D,SLL (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.d) >> 7; (z80.d) = ( (z80.d) << 1 ) | 0x01; (z80.d) &= 0xff; z80.f |= sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x33:		/* LD E,SLL (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.e) >> 7; (z80.e) = ( (z80.e) << 1 ) | 0x01; (z80.e) &= 0xff; z80.f |= sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x34:		/* LD H,SLL (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.h) >> 7; (z80.h) = ( (z80.h) << 1 ) | 0x01; (z80.h) &= 0xff; z80.f |= sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x35:		/* LD L,SLL (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.l) >> 7; (z80.l) = ( (z80.l) << 1 ) | 0x01; (z80.l) &= 0xff; z80.f |= sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x36:		/* SLL (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ z80.f = (bytetemp) >> 7; (bytetemp) = ( (bytetemp) << 1 ) | 0x01; (bytetemp) &= 0xff; z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x37:		/* LD A,SLL (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.a) >> 7; (z80.a) = ( (z80.a) << 1 ) | 0x01; (z80.a) &= 0xff; z80.f |= sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x38:		/* LD B,SRL (REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.b) & 0x01; (z80.b) >>= 1; z80.f |= sz53p_table[(z80.b)];};
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x39:		/* LD C,SRL (REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.c) & 0x01; (z80.c) >>= 1; z80.f |= sz53p_table[(z80.c)];};
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x3a:		/* LD D,SRL (REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.d) & 0x01; (z80.d) >>= 1; z80.f |= sz53p_table[(z80.d)];};
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x3b:		/* LD E,SRL (REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.e) & 0x01; (z80.e) >>= 1; z80.f |= sz53p_table[(z80.e)];};
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x3c:		/* LD H,SRL (REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.h) & 0x01; (z80.h) >>= 1; z80.f |= sz53p_table[(z80.h)];};
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x3d:		/* LD L,SRL (REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.l) & 0x01; (z80.l) >>= 1; z80.f |= sz53p_table[(z80.l)];};
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x3e:		/* SRL (REGISTER+dd) */
      z80.tstates += 8;
      {
	let bytetemp = z80.readbyte_internal(tempaddr);
	{ z80.f = (bytetemp) & 0x01; (bytetemp) >>= 1; z80.f |= sz53p_table[(bytetemp)];};
	z80.writebyte_internal(tempaddr,bytetemp);
      }
      break;
    case 0x3f:		/* LD A,SRL (REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr);
      { z80.f = (z80.a) & 0x01; (z80.a) >>= 1; z80.f |= sz53p_table[(z80.a)];};
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x40:
    case 0x41:
    case 0x42:
    case 0x43:
    case 0x44:
    case 0x45:
    case 0x46:
    case 0x47:		/* BIT 0,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (0) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x48:
    case 0x49:
    case 0x4a:
    case 0x4b:
    case 0x4c:
    case 0x4d:
    case 0x4e:
    case 0x4f:		/* BIT 1,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (1) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x50:
    case 0x51:
    case 0x52:
    case 0x53:
    case 0x54:
    case 0x55:
    case 0x56:
    case 0x57:		/* BIT 2,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (2) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x58:
    case 0x59:
    case 0x5a:
    case 0x5b:
    case 0x5c:
    case 0x5d:
    case 0x5e:
    case 0x5f:		/* BIT 3,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (3) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x60:
    case 0x61:
    case 0x62:
    case 0x63:
    case 0x64:
    case 0x65:
    case 0x66:
    case 0x67:		/* BIT 4,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (4) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x68:
    case 0x69:
    case 0x6a:
    case 0x6b:
    case 0x6c:
    case 0x6d:
    case 0x6e:
    case 0x6f:		/* BIT 5,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (5) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x70:
    case 0x71:
    case 0x72:
    case 0x73:
    case 0x74:
    case 0x75:
    case 0x76:
    case 0x77:		/* BIT 6,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (6) ) ) ) z80.f |= 0x04 | 0x40;
}
      break;
    case 0x78:
    case 0x79:
    case 0x7a:
    case 0x7b:
    case 0x7c:
    case 0x7d:
    case 0x7e:
    case 0x7f:		/* BIT 7,(REGISTER+dd) */
{
        z80.tstates += 5;
        let bytetemp = z80.readbyte_internal( tempaddr );
		z80.f = ( z80.f & 0x01 ) | 0x10 | ( ( tempaddr >> 8 ) & ( 0x08 | 0x20 ) );
		if( ! ( (bytetemp) & ( 0x01 << (7) ) ) ) z80.f |= 0x04 | 0x40;
        if( (bytetemp) & 0x80 ) z80.f |= 0x80;
}
      break;
    case 0x80:		/* LD B,RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0xfe;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x81:		/* LD C,RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0xfe;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x82:		/* LD D,RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0xfe;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x83:		/* LD E,RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0xfe;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x84:		/* LD H,RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0xfe;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x85:		/* LD L,RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0xfe;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x86:		/* RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0xfe);
      break;
    case 0x87:		/* LD A,RES 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0xfe;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x88:		/* LD B,RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0xfd;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x89:		/* LD C,RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0xfd;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x8a:		/* LD D,RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0xfd;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x8b:		/* LD E,RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0xfd;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x8c:		/* LD H,RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0xfd;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x8d:		/* LD L,RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0xfd;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x8e:		/* RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0xfd);
      break;
    case 0x8f:		/* LD A,RES 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0xfd;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x90:		/* LD B,RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0xfb;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x91:		/* LD C,RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0xfb;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x92:		/* LD D,RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0xfb;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x93:		/* LD E,RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0xfb;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x94:		/* LD H,RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0xfb;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x95:		/* LD L,RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0xfb;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x96:		/* RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0xfb);
      break;
    case 0x97:		/* LD A,RES 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0xfb;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0x98:		/* LD B,RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0xf7;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0x99:		/* LD C,RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0xf7;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0x9a:		/* LD D,RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0xf7;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0x9b:		/* LD E,RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0xf7;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0x9c:		/* LD H,RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0xf7;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0x9d:		/* LD L,RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0xf7;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0x9e:		/* RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0xf7);
      break;
    case 0x9f:		/* LD A,RES 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0xf7;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xa0:		/* LD B,RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0xef;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xa1:		/* LD C,RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0xef;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xa2:		/* LD D,RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0xef;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xa3:		/* LD E,RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0xef;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xa4:		/* LD H,RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0xef;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xa5:		/* LD L,RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0xef;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xa6:		/* RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0xef);
      break;
    case 0xa7:		/* LD A,RES 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0xef;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xa8:		/* LD B,RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0xdf;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xa9:		/* LD C,RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0xdf;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xaa:		/* LD D,RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0xdf;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xab:		/* LD E,RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0xdf;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xac:		/* LD H,RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0xdf;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xad:		/* LD L,RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0xdf;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xae:		/* RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0xdf);
      break;
    case 0xaf:		/* LD A,RES 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0xdf;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xb0:		/* LD B,RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0xbf;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xb1:		/* LD C,RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0xbf;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xb2:		/* LD D,RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0xbf;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xb3:		/* LD E,RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0xbf;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xb4:		/* LD H,RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0xbf;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xb5:		/* LD L,RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0xbf;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xb6:		/* RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0xbf);
      break;
    case 0xb7:		/* LD A,RES 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0xbf;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xb8:		/* LD B,RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) & 0x7f;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xb9:		/* LD C,RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) & 0x7f;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xba:		/* LD D,RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) & 0x7f;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xbb:		/* LD E,RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) & 0x7f;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xbc:		/* LD H,RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) & 0x7f;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xbd:		/* LD L,RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) & 0x7f;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xbe:		/* RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) & 0x7f);
      break;
    case 0xbf:		/* LD A,RES 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) & 0x7f;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xc0:		/* LD B,SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x01;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xc1:		/* LD C,SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x01;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xc2:		/* LD D,SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x01;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xc3:		/* LD E,SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x01;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xc4:		/* LD H,SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x01;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xc5:		/* LD L,SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x01;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xc6:		/* SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x01);
      break;
    case 0xc7:		/* LD A,SET 0,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x01;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xc8:		/* LD B,SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x02;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xc9:		/* LD C,SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x02;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xca:		/* LD D,SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x02;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xcb:		/* LD E,SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x02;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xcc:		/* LD H,SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x02;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xcd:		/* LD L,SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x02;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xce:		/* SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x02);
      break;
    case 0xcf:		/* LD A,SET 1,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x02;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xd0:		/* LD B,SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x04;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xd1:		/* LD C,SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x04;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xd2:		/* LD D,SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x04;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xd3:		/* LD E,SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x04;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xd4:		/* LD H,SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x04;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xd5:		/* LD L,SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x04;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xd6:		/* SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x04);
      break;
    case 0xd7:		/* LD A,SET 2,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x04;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xd8:		/* LD B,SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x08;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xd9:		/* LD C,SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x08;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xda:		/* LD D,SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x08;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xdb:		/* LD E,SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x08;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xdc:		/* LD H,SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x08;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xdd:		/* LD L,SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x08;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xde:		/* SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x08);
      break;
    case 0xdf:		/* LD A,SET 3,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x08;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xe0:		/* LD B,SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x10;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xe1:		/* LD C,SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x10;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xe2:		/* LD D,SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x10;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xe3:		/* LD E,SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x10;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xe4:		/* LD H,SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x10;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xe5:		/* LD L,SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x10;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xe6:		/* SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x10);
      break;
    case 0xe7:		/* LD A,SET 4,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x10;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xe8:		/* LD B,SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x20;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xe9:		/* LD C,SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x20;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xea:		/* LD D,SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x20;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xeb:		/* LD E,SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x20;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xec:		/* LD H,SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x20;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xed:		/* LD L,SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x20;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xee:		/* SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x20);
      break;
    case 0xef:		/* LD A,SET 5,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x20;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xf0:		/* LD B,SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x40;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xf1:		/* LD C,SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x40;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xf2:		/* LD D,SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x40;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xf3:		/* LD E,SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x40;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xf4:		/* LD H,SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x40;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xf5:		/* LD L,SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x40;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xf6:		/* SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x40);
      break;
    case 0xf7:		/* LD A,SET 6,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x40;
      z80.writebyte_internal(tempaddr, z80.a);
      break;
    case 0xf8:		/* LD B,SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.b=z80.readbyte_internal(tempaddr) | 0x80;
      z80.writebyte_internal(tempaddr, z80.b);
      break;
    case 0xf9:		/* LD C,SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.c=z80.readbyte_internal(tempaddr) | 0x80;
      z80.writebyte_internal(tempaddr, z80.c);
      break;
    case 0xfa:		/* LD D,SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.d=z80.readbyte_internal(tempaddr) | 0x80;
      z80.writebyte_internal(tempaddr, z80.d);
      break;
    case 0xfb:		/* LD E,SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.e=z80.readbyte_internal(tempaddr) | 0x80;
      z80.writebyte_internal(tempaddr, z80.e);
      break;
    case 0xfc:		/* LD H,SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.h=z80.readbyte_internal(tempaddr) | 0x80;
      z80.writebyte_internal(tempaddr, z80.h);
      break;
    case 0xfd:		/* LD L,SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.l=z80.readbyte_internal(tempaddr) | 0x80;
      z80.writebyte_internal(tempaddr, z80.l);
      break;
    case 0xfe:		/* SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.writebyte_internal(tempaddr, z80.readbyte_internal(tempaddr) | 0x80);
      break;
    case 0xff:		/* LD A,SET 7,(REGISTER+dd) */
      z80.tstates += 8;
      z80.a=z80.readbyte_internal(tempaddr) | 0x80;
      z80.writebyte_internal(tempaddr, z80.a);
      break;

	}



      }
      break;
    case 0xe1:		/* POP REGISTER */
      { z80.tstates += (3);; (z80.iyl)=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff; z80.tstates += (3);; (z80.iyh)=z80.readbyte_internal(z80.sp++); z80.sp &= 0xffff;};
      break;
    case 0xe3:		/* EX (SP),REGISTER */
      {
	let bytetempl = z80.readbyte_internal( z80.sp     ),
	                 bytetemph = z80.readbyte_internal( z80.sp + 1 );
	z80.tstates += ( 3 );; z80.tstates += ( 4 );;
	z80.tstates += ( 3 );; z80.tstates += ( 5 );;
	z80.writebyte_internal(z80.sp+1,z80.iyh); z80.writebyte_internal(z80.sp,z80.iyl);
	z80.iyl=bytetempl; z80.iyh=bytetemph;
      }
      break;
    case 0xe5:		/* PUSH REGISTER */
      z80.tstates++;
      { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.iyh)); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.iyl));};
      break;
    case 0xe9:		/* JP REGISTER */
      z80.pc=(z80.iyl | (z80.iyh << 8));		/* NB: NOT INDIRECT! */
      break;
    case 0xf9:		/* LD SP,REGISTER */
      z80.tstates += 2;
      z80.sp=(z80.iyl | (z80.iyh << 8));
      break;
    default:		/* Instruction did not involve H or L, so backtrack
			   one instruction and parse again */
      z80.pc--;		/* FIXME: will be contended again */
      z80.pc &= 0xffff;
      z80.r--;		/* Decrement the R register as well */
      z80.r &= 0x7f;
      break;





	}



      }
      break;
    case 0xfe:		/* CP nn */
      z80.tstates += ( 3 );;
      {
	let bytetemp = z80.readbyte_internal( z80.pc++ );
	{ var cptemp = z80.a - bytetemp; var lookup = ( ( z80.a & 0x88 ) >> 3 ) | ( ( (bytetemp) & 0x88 ) >> 2 ) | ( ( cptemp & 0x88 ) >> 1 ); z80.f = ( cptemp & 0x100 ? 0x01 : ( cptemp ? 0 : 0x40 ) ) | 0x02 | halfcarry_sub_table[lookup & 0x07] | overflow_sub_table[lookup >> 4] | ( bytetemp & ( 0x08 | 0x20 ) ) | ( cptemp & 0x80 );};
      }
      break;
    case 0xff:		/* RST 38 */
      z80.tstates++;
      { { z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) >> 8); z80.sp--; z80.sp &= 0xffff; z80.tstates += (3);; z80.writebyte_internal(z80.sp,(z80.pc) & 0xff);}; z80.pc=(0x38);};
      break;

    }
  }

}


