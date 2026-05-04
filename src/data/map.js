/* Map — hex world generator + terrain/town templates.
   Hex layout: pointy-top, offset coordinates (col, row).
   Each tile: { id, q, r, x, y, terrain, owner, town, garrison, gold, revealed } */

import { FACTIONS } from "./factions.js";
import { makeRNG } from "../core/rng.js";

export const TERRAINS = {
  plains:   { name:"Plains",   icon:"🌾", color:"#d6c98a", income:6,  defBonus:0 },
  forest:   { name:"Forest",   icon:"🌲", color:"#6f9c5a", income:5,  defBonus:1 },
  hills:    { name:"Hills",    icon:"⛰️", color:"#a89272", income:4,  defBonus:2 },
  mountain: { name:"Mountain", icon:"🗻", color:"#7d7468", income:2,  defBonus:3 },
  coast:    { name:"Coast",    icon:"🏖️", color:"#d8c98e", income:7,  defBonus:0 },
  sea:      { name:"Sea",      icon:"🌊", color:"#4d7ad0", income:0,  defBonus:0, impassable:true },
  wastes:   { name:"Wastes",   icon:"🏜️", color:"#c0a878", income:3,  defBonus:1 },
  swamp:    { name:"Swamp",    icon:"🪷", color:"#647c4a", income:3,  defBonus:1 },
};

export const TOWN_TYPES = {
  capital:  { name:"Capital",  icon:"🏰", goldBonus:4, recruit:true,  shop:true,  isCapital:true },
  city:     { name:"City",     icon:"🏯", goldBonus:2, recruit:true,  shop:true },
  town:     { name:"Town",     icon:"🏘️", goldBonus:1, recruit:true,  shop:false },
  fort:     { name:"Fort",     icon:"🛡️", goldBonus:0, recruit:true,  shop:false, defBonus:2 },
  cave:     { name:"Cave",     icon:"🕳️", goldBonus:0, recruit:false, shop:false, encounter:true },
  ruin:     { name:"Ruin",     icon:"🗿", goldBonus:0, recruit:false, shop:false, encounter:true },
  shrine:   { name:"Shrine",   icon:"🛕", goldBonus:0, recruit:false, shop:false, encounter:true },
};

const HEX_W = 120;
const HEX_H = 138;

/* Generate a hex map. Casual tuning: 8×6 grid (fewer, bigger hexes), simplified
   terrain mix (4 land types + sea), bigger hex pixel size so tiles read at a glance. */
export function generateMap(seed = 1, opts = {}) {
  const { cols = 8, rows = 6 } = opts;
  const rng = makeRNG(seed);
  const tiles = [];

  // Step 1: terrain — bigger biomes, fewer types, more readable
  for (let r = 0; r < rows; r++) {
    for (let q = 0; q < cols; q++) {
      const id = `${q},${r}`;
      const n = rng();
      let terrain = "plains";
      const edgeDist = Math.min(q, r, cols - 1 - q, rows - 1 - r);
      if (edgeDist === 0) {
        terrain = n < 0.7 ? "sea" : "coast";
      } else if (edgeDist === 1) {
        if (n < 0.20) terrain = "forest";
        else if (n < 0.35) terrain = "hills";
        else if (n < 0.50) terrain = "coast";
        else terrain = "plains";
      } else {
        if (n < 0.15) terrain = "mountain";
        else if (n < 0.40) terrain = "forest";
        else if (n < 0.58) terrain = "hills";
        else terrain = "plains";
      }

      const x = q * HEX_W * 0.86 + (r % 2 ? HEX_W * 0.43 : 0);
      const y = r * HEX_H * 0.75;

      tiles.push({
        id, q, r, x, y, terrain,
        owner: null,
        town: null,
        garrison: [],
        gold: TERRAINS[terrain].income,
        revealed: true,
      });
    }
  }

  // Step 2: faction capitals at the four quadrants
  const corners = [
    { faction:"crown", q: Math.floor(cols * 0.18), r: Math.floor(rows * 0.25), terrain:"plains" },
    { faction:"tide",  q: Math.floor(cols * 0.82), r: Math.floor(rows * 0.25), terrain:"coast"  },
    { faction:"ash",   q: Math.floor(cols * 0.18), r: Math.floor(rows * 0.78), terrain:"wastes" },
    { faction:"thorn", q: Math.floor(cols * 0.82), r: Math.floor(rows * 0.78), terrain:"forest" },
  ];
  corners.forEach((c) => {
    const t = tiles.find((x) => x.q === c.q && x.r === c.r);
    if (!t) return;
    t.terrain = c.terrain;
    t.owner = c.faction;
    t.town = "capital";
    t.gold = TERRAINS[c.terrain].income + 4;
    const fac = FACTIONS[c.faction];
    t.garrison = [
      { unit: fac.units[0], count: 6 },
      { unit: fac.units[1], count: 3 },
    ];
  });

  // Step 3: scatter a smaller, more legible feature set. Casual mode: ~14
  // features instead of ~27 — every tile feels meaningful.
  const otherTowns = [
    { type:"city",   count: 4 },
    { type:"town",   count: 4 },
    { type:"fort",   count: 2 },
    { type:"cave",   count: 2 },
    { type:"shrine", count: 1 },
    { type:"ruin",   count: 1 },
  ];
  otherTowns.forEach(({ type, count }) => {
    let placed = 0;
    let attempts = 0;
    while (placed < count && attempts < 200) {
      attempts++;
      const t = tiles[Math.floor(rng() * tiles.length)];
      if (!t || t.town || t.terrain === "sea") continue;
      const tooClose = tiles.some((o) => o.town === "capital" && hexDist(t, o) < 2);
      if (tooClose) continue;
      t.town = type;
      if (["city", "town", "fort"].includes(type)) {
        const closestCap = tiles
          .filter((o) => o.town === "capital")
          .map((o) => ({ o, d: hexDist(t, o) }))
          .sort((a, b) => a.d - b.d)[0];
        if (closestCap && closestCap.d <= 3) {
          t.owner = closestCap.o.owner;
          const fac = FACTIONS[t.owner];
          t.garrison = [{ unit: fac.units[0], count: 2 + Math.floor(rng() * 3) }];
        }
      }
      placed++;
    }
  });

  return { tiles, cols, rows, seed };
}

export function hexDist(a, b) {
  const ac = offsetToCube(a.q, a.r);
  const bc = offsetToCube(b.q, b.r);
  return (Math.abs(ac.x - bc.x) + Math.abs(ac.y - bc.y) + Math.abs(ac.z - bc.z)) / 2;
}

function offsetToCube(col, row) {
  const x = col - Math.floor((row - (row & 1)) / 2);
  const z = row;
  const y = -x - z;
  return { x, y, z };
}

export function hexNeighbors(tile, allTiles) {
  const isOdd = tile.r % 2 === 1;
  const dirs = isOdd
    ? [[+1, 0], [+1, -1], [0, -1], [-1, 0], [0, +1], [+1, +1]]
    : [[+1, 0], [0, -1], [-1, -1], [-1, 0], [-1, +1], [0, +1]];
  return dirs
    .map(([dq, dr]) => allTiles.find((t) => t.q === tile.q + dq && t.r === tile.r + dr))
    .filter(Boolean);
}
