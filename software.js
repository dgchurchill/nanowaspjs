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
        title: "Frankenstein's Monster",
        url: "software/frank.mwb",
        filename: "frank.mwb",
        tapeParameters: ["B", 0x08C0, 0x0000, false, 0x47]
    },
    {
        title: "Jeksil's Revenge",
        url: "software/jeksil.mwb",
        filename: "jeksil.mwb"
    },
    {
        title: "The Towers of Hanoi",
        url: "software/hanoi.mwb",
        filename: "hanoi.mwb"
    },

    {
        title: "Depth Charge",
        author: "Brad Robinson",
        url: "software/brad_robinson/d-charge.bee",
        filename: "d-charge.bee"
    },
    {
        title: "Laser Blazer",
        author: "Brad Robinson",
        url: "software/brad_robinson/lazer.bee",
        filename: "lazer.bee"
    },
    {
        title: "Robot Fire",
        author: "Brad Robinson",
        url: "software/brad_robinson/robotf.bee",
        filename: "robotf.bee",
        tapeParameters: ["M", 0x03fc, 0x1983, true, 0x00]
    },
    {
        title: "Space Lanes",
        author: "Brad Robinson",
        url: "software/brad_robinson/sp-lanes.bee",
        filename: "sp-lanes.bee"
    },

    {
        title: "Bounce",
        author: "Richard Larkin",
        url: "software/richard_larkin/bounce.mwb",
        filename: "bounce.mwb"
    },
    {
        title: "Break Out",
        author: "Richard Larkin",
        url: "software/richard_larkin/bricks.mwb",
        filename: "bricks.mwb"
    },
    {
        title: "Catack",
        author: "Richard Larkin",
        url: "software/richard_larkin/catack.bee",
        filename: "catack.bee"
    },
    {
        title: "Catter",
        author: "Richard Larkin",
        url: "software/richard_larkin/catter.mwb",
        filename: "catter.mwb"
    },
    {
        title: "Catter 2",
        author: "Richard Larkin",
        url: "software/richard_larkin/cater2.mwb",
        filename: "cater2.mwb"
    },
    {
        title: "Catter 3",
        author: "Richard Larkin",
        url: "software/richard_larkin/cater3.mwb",
        filename: "cater3.mwb"
    },
        {
        title: "Earth",
        author: "Richard Larkin",
        url: "software/richard_larkin/earth.mwb",
        filename: "earth.mwb"
    },
    {
        title: "Isbok Adventure",
        author: "Richard Larkin",
        url: "software/richard_larkin/isbok-g.mwb",
        filename: "isbok-g.mwb"
    },
    {
        title: "Mazes!",
        author: "Richard Larkin",
        url: "software/richard_larkin/mazes.bee",
        filename: "mazes.bee",
        tapeParameters: ["M", 0x4000, 0x4000, true, 0x00]
    },
    {
        title: "Othello",
        author: "Richard Larkin",
        url: "software/richard_larkin/othello.bee",
        filename: "othello.bee",
        tapeParameters: ["M", 0x0400, 0x0400, true, 0x00]
    },
    {
        title: "Pucker",
        author: "Richard Larkin",
        url: "software/richard_larkin/pucker.bee",
        filename: "pucker.bee",
        tapeParameters: ["M", 0x03a2, 0x03a2, true, 0x00]
    },
    {
        title: "Sheepdog Trials",
        url: "software/sheepd.mwb",
        filename: "sheepd.mwb"
    }
];
