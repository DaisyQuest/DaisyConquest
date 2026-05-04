/* Enemy faction logic, runs at end of round.
   Strategy: each turn, expand to an adjacent unowned tile or contest a
   weaker neighbor. Battles are fast-forwarded via Battle.quickResolve. */

import { FACTIONS } from "../data/factions.js";
import { hexNeighbors } from "../data/map.js";
import { Battle } from "./battle.js";

export const AI = {
  takeTurn(state, factionId) {
    const tiles = state.map.tiles.map((t) => ({ ...t, garrison: [...(t.garrison || [])] }));
    const owned = tiles.filter((t) => t.owner === factionId);
    if (!owned.length) return state.map;
    const fac = FACTIONS[factionId];

    const candidates = [];
    for (const o of owned) {
      for (const n of hexNeighbors(o, tiles)) {
        if (!n) continue;
        if (n.terrain === "sea") continue;
        if (n.owner === factionId) continue;
        if (n.town === "capital" && n.owner) continue;
        candidates.push(n);
      }
    }
    if (!candidates.length) return { ...state.map, tiles };

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    if (!pick.owner) {
      pick.owner = factionId;
      pick.garrison = [{ unit: fac.units[0], count: 1 + Math.floor(Math.random() * 2) }];
    } else {
      const attackerRetinue = [{ unit: fac.units[0], count: 3 }, { unit: fac.units[1], count: 1 }];
      const defenderFac = FACTIONS[pick.owner];
      const defenderHero = state.players[pick.owner]?.hero;
      const attackerHero = state.players[factionId]?.hero;
      if (!defenderHero || !attackerHero) return { ...state.map, tiles };
      const result = Battle.quickResolve({
        attackerHero, attackerRetinue, attackerFac: factionId,
        defenderHero: { ...defenderHero, hp: defenderHero.maxHp, mp: defenderHero.maxMp },
        defenderGarrison: pick.garrison.length ? pick.garrison : [{ unit: defenderFac.units[0], count: 1 }],
        defenderFac: pick.owner,
      });
      if (result.winner === "attacker") {
        pick.owner = factionId;
        pick.garrison = [{ unit: fac.units[0], count: 2 }];
      }
    }
    return { ...state.map, tiles };
  },
};
