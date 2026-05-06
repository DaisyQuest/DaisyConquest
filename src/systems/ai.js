/* Enemy faction logic, runs at end of round.
   Strategy: each turn, expand to an adjacent unowned tile or contest a
   weaker neighbor. Battles are fast-forwarded via Battle.quickResolve. */

import { FACTIONS, FACTION_LIST } from "../data/factions.js";
import { hexNeighbors } from "../data/map.js";
import { Battle } from "./battle.js";

// Per-AI-faction probability of staging a defense-minigame attack on a
// neighboring human tile each round. Tunable.
const ATTACK_CHANCE = 0.20;

export const AI = {
  takeTurn(state, factionId) {
    const tiles = state.map.tiles.map((t) => ({ ...t, garrison: [...(t.garrison || [])] }));
    const owned = tiles.filter((t) => t.owner === factionId);
    if (!owned.length) return state.map;
    const fac = FACTIONS[factionId];

    // Track candidates as { from, to } pairs so we can stamp the captured
    // tile with its source — the world map uses this to draw movement
    // arrows the human player can see and intercept.
    const candidates = [];
    for (const o of owned) {
      for (const n of hexNeighbors(o, tiles)) {
        if (!n) continue;
        if (n.terrain === "sea") continue;
        if (n.owner === factionId) continue;
        if (n.town === "capital" && n.owner) continue;
        candidates.push({ from: o, to: n });
      }
    }
    if (!candidates.length) return { ...state.map, tiles };

    const pickCand = candidates[Math.floor(Math.random() * candidates.length)];
    const pick = pickCand.to;
    const sourceTile = pickCand.from;

    /* Stamp the destination with where the move came from + which round
       it happened. WorldMap renders an arrow whenever lastMoveRound ===
       state.round - 1 (i.e., "this happened during the AI's last turn"),
       so the player gets one round to react before the trail fades. */
    const stampMove = () => {
      pick.lastMoveFromId = sourceTile.id;
      pick.lastMoveRound  = state.round;
      pick.lastMoveBy     = factionId;
    };

    if (!pick.owner) {
      pick.owner = factionId;
      pick.garrison = [{ unit: fac.units[0], count: 1 + Math.floor(Math.random() * 2) }];
      stampMove();
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
        stampMove();
      }
    }
    return { ...state.map, tiles };
  },

  /* Roll for AI factions to launch a defense-minigame raid on a neighboring
     human-owned tile. Returns a pendingDefense object { tileId, attackerFaction }
     if a raid fires this round, otherwise null. Picks at most one raid per
     round-end (queueing is out of scope). */
  maybeAttackPlayer(state) {
    const tiles = state.map.tiles;
    const players = state.players;
    const humanFactions = FACTION_LIST.filter((f) => players[f]?.isHuman && !players[f]?.defeated);
    if (!humanFactions.length) return null;

    const aiFactions = FACTION_LIST.filter((f) => !players[f]?.isHuman && !players[f]?.defeated);
    const candidates = [];
    for (const ai of aiFactions) {
      // perk_diplomat: any human defender with this capstone halves the
      // raid chance against ALL their borders this round. Picks the lowest
      // multiplier across human players to keep the math simple.
      let chanceMul = 1;
      for (const f of FACTION_LIST) {
        if (!players[f]?.isHuman || players[f].defeated) continue;
        if (players[f].hero?.perks?.includes("perk_diplomat")) chanceMul = Math.min(chanceMul, 0.5);
      }
      if (Math.random() >= ATTACK_CHANCE * chanceMul) continue;
      // Find a human-owned tile adjacent to any tile this AI owns,
      // where the human player has at least one retinue unit.
      const aiOwned = tiles.filter((t) => t.owner === ai);
      if (!aiOwned.length) continue;
      const seen = new Set();
      const targets = [];
      for (const o of aiOwned) {
        for (const n of hexNeighbors(o, tiles)) {
          if (!n || seen.has(n.id)) continue;
          if (!n.owner) continue;
          const owner = players[n.owner];
          if (!owner?.isHuman || owner.defeated) continue;
          const totalRetinue = (owner.hero?.retinue || []).reduce((a, s) => a + (s.count || 0), 0);
          if (totalRetinue < 1) continue;
          seen.add(n.id);
          targets.push(n);
        }
      }
      if (!targets.length) continue;
      const tile = targets[Math.floor(Math.random() * targets.length)];
      candidates.push({ tileId: tile.id, attackerFaction: ai });
    }
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  },
};
