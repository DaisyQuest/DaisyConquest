/* Economy — income, upkeep, troop costs.
   Runs once per round-end and any time the UI needs to show a forecast. */

import { CONST } from "./constants.js";
import { UNITS } from "../data/units.js";
import { TOWN_TYPES } from "../data/map.js";

export const Economy = {
  computeIncome(state, factionId) {
    const owned = state.map.tiles.filter((t) => t.owner === factionId);
    let g = CONST.ROUND_INCOME_BASE;
    for (const t of owned) {
      g += t.gold;
      if (t.town && TOWN_TYPES[t.town]) g += TOWN_TYPES[t.town].goldBonus;
    }
    const hero = state.players[factionId]?.hero;
    if (hero?.perks?.includes("perk_treasury")) g = Math.floor(g * 1.25);
    return g;
  },

  computeUpkeep(state, factionId) {
    const tiles = state.map.tiles.filter((t) => t.owner === factionId);
    let u = 0;
    for (const t of tiles) {
      for (const stack of t.garrison || []) {
        const def = UNITS[stack.unit];
        if (def) u += def.upkeep * stack.count;
      }
    }
    const hero = state.players[factionId]?.hero;
    if (hero?.retinue) {
      for (const s of hero.retinue) {
        const def = UNITS[s.unit];
        if (def) u += def.upkeep * s.count;
      }
    }
    return u;
  },

  troopCost(unitId, count, hero) {
    const u = UNITS[unitId];
    if (!u) return 0;
    let c = u.cost * count;
    if (hero?.perks?.includes("perk_quartermaster")) c = Math.floor(c * 0.9);
    return c;
  },
};
