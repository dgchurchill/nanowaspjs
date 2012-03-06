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

var nanowasp = nanowasp || {};

nanowasp.software = [
    {
        title: "Camel Race",
        url: "software/camel.mwb",
        filename: "camel.mwb"
    },
    {
        title: "Depth Charge",
        url: "software/d-charge.bee",
        filename: "d-charge.bee"
    },
    {
        title: "Frankenstein's Monster",
        url: "software/frank.mwb",
        filename: "frank.mwb",
        tapeParameters: ["B", 0x08C0, 0x0000, false, 0x47]
    },
    {
        title: "Towers of Hanoi",
        url: "software/hanoi.mwb",
        filename: "hanoi.mwb"
    },
    {
        title: "Jeksil's Revenge",
        url: "software/jeksil.mwb",
        filename: "jeksil.mwb"
    },
    {
        title: "Lazer",
        url: "software/lazer.bee",
        filename: "lazer.bee"
    },
    {
        title: "Robotf",
        url: "software/robotf.bee",
        filename: "robotf.bee"
    },
    {
        title: "Space Lanes",
        url: "software/sp-lanes.bee",
        filename: "sp-lanes.bee"
    }
];
