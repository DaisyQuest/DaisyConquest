/* Economy — income, upkeep, troop costs.
   Runs once per round-end and any time the UI needs to show a forecast. */

import { CONST } from "./constants.js";
import { UNITS } from "../data/units.js";
import { TOWN_TYPES } from "../data/map.js";
import { equipmentEffects } from "../data/items.js";

export const Economy = {
  computeIncome(state, factionId) {
    const owned = state.map.tiles.filter((t) => t.owner === factionId);
    let g = CONST.ROUND_INCOME_BASE;
    for (const t of owned) {
      g += t.gold;
      if (t.town && TOWN_TYPES[t.town]) g += TOWN_TYPES[t.town].goldBonus;
    }
    const hero = state.players[factionId]?.hero;
    const perks = hero?.perks || [];
    // perk_taxreform: +1g per controlled tile per round (flat add before the
    // treasury percentage so treasury also lifts the tax-reform bonus).
    if (perks.includes("perk_taxreform")) g += owned.length;
    // perk_forager: support units in the retinue trickle gold each round.
    if (perks.includes("perk_forager") && hero?.retinue) {
      for (const s of hero.retinue) {
        const def = UNITS[s.unit];
        if (def?.role === "support") g += s.count;
      }
    }
    // perk_crowned: capstone — +1g per current round number.
    if (perks.includes("perk_crowned")) g += state.round || 1;
    // Equipment perRound effects (e.g. Merchant's Coffer / Crown Jewel).
    // Stack additively before the treasury multiplier so the player's gear
    // benefits from compounding tax policy.
    for (const eff of equipmentEffects(hero, "perRound")) {
      const a = eff.action;
      if (a && a.type === "gold") g += a.value || 0;
    }
    if (perks.includes("perk_treasury")) g = Math.floor(g * 1.25);
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
    // perk_logistics: −20% upkeep across the board.
    if (hero?.perks?.includes("perk_logistics")) {
      u = Math.floor(u * 0.8);
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
