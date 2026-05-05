/* The single source of truth.
   Every screen reads `state` and dispatches actions; the reducer is the
   only place state mutates. State shape:

   {
     screen: "main"|"map"|"zone"|"recruit"|"upgrade"|"shop"|"battle"
            |"defense"|"summary"|"encounter"|"coop"|"victory",
     screenParams: { ... },
     round: 1,
     map: { tiles, cols, rows, seed },
     players: {
       [factionId]: {
         gold, isHuman, defeated,
         hero: { id, lvl, xp, hp, mp, equipment, perks, retinue, mounted },
         selectedTile,
       }
     },
     activePlayer, humanFaction, coopFaction,
     log: [{ round, text }],
     pendingEncounter, pendingBattle, pendingDefense, pendingSummary,
     pendingVictory: null | { winner: factionId|null, round, defeated? },
     theme, seed,
   } */

import React, { createContext, useContext, useReducer, useEffect } from "react";
import { CONST } from "./constants.js";
import { SaveSystem } from "./save.js";
import { Economy } from "./economy.js";
import { FACTIONS, FACTION_LIST } from "../data/factions.js";
import { HEROES, heroXpForLevel } from "../data/heroes.js";
import { ITEMS } from "../data/items.js";
import { ENCOUNTERS } from "../data/encounters.js";
import { generateMap, revealAround, TERRAINS, TOWN_TYPES } from "../data/map.js";
import {
  PROMOTIONS,
  STACK_LEVEL_CAP,
  xpForStackLevel,
  promotionCost,
} from "../data/units.js";
import { AI } from "../systems/ai.js";

/* Apply XP to a single retinue stack; level up while overflowing the
   curve. Caps at STACK_LEVEL_CAP — surplus XP on a capped stack is lost.
   Defensive on legacy stacks: lvl ?? 1, xp ?? 0. */
function awardStackXp(stack, xpDelta) {
  let lvl = stack.lvl ?? 1;
  let xp = (stack.xp ?? 0) + Math.max(0, xpDelta | 0);
  while (lvl < STACK_LEVEL_CAP && xp >= xpForStackLevel(lvl + 1)) {
    xp -= xpForStackLevel(lvl + 1);
    lvl += 1;
  }
  if (lvl >= STACK_LEVEL_CAP) xp = 0; // capped — discard surplus
  return { ...stack, lvl, xp };
}

const StoreCtx = createContext(null);

export function makeInitialState(opts = {}) {
  const seed = opts.seed ?? CONST.MAP.DEFAULT_SEED;
  const human = opts.human ?? "crown";
  const coopWith = opts.coopWith ?? null;

  const baseMap = generateMap(seed, { cols: CONST.MAP.COLS, rows: CONST.MAP.ROWS });
  // Initial reveal: capitals + neighbors of human (and coop ally, if any).
  const humanIds = [human, coopWith].filter(Boolean);
  const map = { ...baseMap, tiles: revealAround(baseMap.tiles, humanIds) };

  const players = {};
  for (const fid of FACTION_LIST) {
    const fac = FACTIONS[fid];
    const heroDef = HEROES[fac.heroStarter];
    players[fid] = {
      faction: fid,
      gold: fid === human ? CONST.STARTING_GOLD : 150,
      isHuman: fid === human || fid === coopWith,
      defeated: false,
      // In coop, each human player tracks whether they've ended their turn
      // this round. Reset to false at every END_ROUND. Single-player ignores.
      endedTurn: false,
      hero: {
        id: fac.heroStarter,
        name: heroDef.name,
        lvl: 1,
        xp: 0,
        hp: heroDef.base.hp,
        maxHp: heroDef.base.hp,
        mp: heroDef.base.mp,
        maxMp: heroDef.base.mp,
        equipment: { weapon: "rustyBlade", armor: "gambeson", trinket: null, mount: null },
        // Stash of unequipped gear. Always present; missing on legacy saves
        // is tolerated by reading via `hero.inventory || []`.
        inventory: [],
        consumables: ["potionHeal", "potionHeal"],
        perks: [],
        retinue: [
          { unit: fac.units[0], count: 4, lvl: 1, xp: 0 },
          { unit: fac.units[1], count: 1, lvl: 1, xp: 0 },
        ],
        mounted: false,
        // Battlefield behaviors — pre-battle hero AI knobs the player sets
        // in the ARMY tab. Defaults preserve the prior auto-pilot feel:
        //   stance:    balanced (no atk/def trade-off)
        //   targeting: closest  (current targeting algorithm)
        //   autoCast:  false    (player still triggers abilities)
        behavior: { stance: "balanced", targeting: "closest", autoCast: false },
      },
      selectedTile: null,
    };
  }

  return {
    screen: "main",
    screenParams: {},
    round: 1,
    map,
    players,
    activePlayer: human,
    humanFaction: human,
    coopFaction: coopWith,
    log: [{ round: 1, text: "The kingdoms are at war. Take the throne." }],
    pendingEncounter: null,
    pendingBattle: null,
    pendingDefense: null,
    pendingSummary: null,
    pendingVictory: null,
    theme: "parchment",
    seed,
  };
}

/* Mark factions with zero owned tiles as defeated. Returns a new players
   map (referentially identical to input if nothing changed). bandit is
   excluded since it isn't in FACTION_LIST. */
function recomputeDefeated(players, tiles) {
  let changed = false;
  const next = { ...players };
  for (const fid of FACTION_LIST) {
    const owned = tiles.some((t) => t.owner === fid);
    if (!owned && !next[fid].defeated) {
      next[fid] = { ...next[fid], defeated: true };
      changed = true;
    }
  }
  return changed ? next : players;
}

/* If exactly one undefeated faction remains in FACTION_LIST, return a
   pendingVictory descriptor. If the human faction(s) are all defeated and
   there are still rivals left, return a defeat descriptor. Otherwise null. */
function checkVictory(state, players) {
  if (state.pendingVictory) return state.pendingVictory;
  const undefeated = FACTION_LIST.filter((f) => !players[f].defeated);
  if (undefeated.length === 1) {
    return { winner: undefeated[0], round: state.round };
  }
  const humanFid = state.humanFaction;
  const coopFid = state.coopFaction;
  const humanLost = humanFid && players[humanFid]?.defeated;
  const coopLost = !coopFid || players[coopFid]?.defeated;
  if (humanLost && coopLost) {
    return { winner: null, defeated: humanFid, round: state.round };
  }
  return null;
}

/* Reveal tiles owned by the human (and co-op ally, if any) plus their
   neighbors. Called from every reducer branch where a human gains a tile;
   `explored` is monotonic, so it's safe to over-call. */
function revealForHumans(state, tiles) {
  return revealAround(tiles, [state.humanFaction, state.coopFaction]);
}

/* Compose defeat-check + victory-check after any tile-ownership change.
   Returns a partial state delta: { players, pendingVictory?, screen? }. */
function applyDefeatAndVictory(state, players, tiles) {
  const nextPlayers = recomputeDefeated(players, tiles);
  const pendingVictory = checkVictory(state, nextPlayers);
  if (pendingVictory) {
    return { players: nextPlayers, pendingVictory, screen: "victory" };
  }
  return { players: nextPlayers };
}

function applyLosses(stacks, losses) {
  if (!losses) return stacks;
  const out = stacks.map((s) => ({ ...s }));
  for (const L of losses) {
    const i = out.findIndex((s) => s.unit === L.unit);
    if (i >= 0) out[i].count = Math.max(0, out[i].count - L.count);
  }
  return out.filter((s) => s.count > 0);
}

function applyEncounterDelta(player, delta) {
  const p = { ...player };
  const d = delta || {};
  if (d.gold) p.gold += d.gold;
  if (d.heroHp) p.hero = { ...p.hero, hp: Math.max(1, Math.min(p.hero.maxHp, p.hero.hp + d.heroHp)) };
  if (d.heroXp) p.hero = { ...p.hero, xp: p.hero.xp + d.heroXp };
  if (d.items) {
    const inv = [...(p.hero.inventory || [])];
    const cons = [...p.hero.consumables];
    for (const itemId of d.items) {
      const item = ITEMS[itemId];
      if (!item) continue;
      if (item.slot === "consumable") cons.push(item.id);
      else inv.push(item.id);
    }
    p.hero = { ...p.hero, inventory: inv, consumables: cons };
  }
  if (d.troops) {
    const r = [...p.hero.retinue];
    for (const t of d.troops) {
      const idx = r.findIndex((s) => s.unit === t.unit);
      if (idx >= 0) r[idx] = { ...r[idx], count: r[idx].count + t.count };
      else r.push(t);
    }
    p.hero = { ...p.hero, retinue: r };
  }
  return p;
}

export function gameReducer(state, action) {
  switch (action.type) {
    case "SET_SCREEN":
      return { ...state, screen: action.screen, screenParams: action.params || {} };

    case "SET_ACTIVE_PLAYER":
      return { ...state, activePlayer: action.faction };

    case "SWAP_CONTROL": {
      // Co-op hand-off: flip activePlayer between humanFaction and coopFaction
      // and route through the Handoff screen. `next` is where the new active
      // player will land (defaults to map).
      if (!state.coopFaction) return state;
      const next =
        state.activePlayer === state.humanFaction
          ? state.coopFaction
          : state.humanFaction;
      return {
        ...state,
        activePlayer: next,
        screen: "handoff",
        screenParams: { next: action.next || "map" },
      };
    }

    case "END_TURN": {
      // The single end-of-something action UI dispatches. Three branches:
      //   1. single-player → identical to END_ROUND.
      //   2. coop, partner has not yet ended → mark active.endedTurn,
      //      hand off to partner via the Handoff screen.
      //   3. coop, partner already ended → run END_ROUND (which resets the
      //      flags as part of round advance).
      const coop = state.coopFaction;
      if (!coop) return gameReducer(state, { type: "END_ROUND" });

      const me = state.activePlayer;
      const partner = me === state.humanFaction ? coop : state.humanFaction;
      const partnerEnded = !!state.players[partner]?.endedTurn;

      if (partnerEnded) {
        return gameReducer(state, { type: "END_ROUND" });
      }

      const players = {
        ...state.players,
        [me]: { ...state.players[me], endedTurn: true },
      };
      return {
        ...state,
        players,
        activePlayer: partner,
        screen: "handoff",
        screenParams: { next: "map" },
      };
    }

    case "SELECT_TILE": {
      const players = { ...state.players };
      players[state.activePlayer] = { ...players[state.activePlayer], selectedTile: action.tileId };
      return { ...state, players };
    }

    case "MOVE_HERO_TO": {
      // Casual tuning: every move costs something. Wilderness has bandits,
      // features have encounters, enemies always trigger a battle.
      const tiles = state.map.tiles.map((t) => ({ ...t }));
      const target = tiles.find((t) => t.id === action.tileId);
      if (!target) return state;
      const me = state.activePlayer;

      // Co-op guard: never attack a fellow human (ally) tile. Treat as no-op
      // so the player can still "select" without wrecking shared state.
      const allies = [state.humanFaction, state.coopFaction].filter(Boolean);
      if (target.owner && allies.includes(target.owner) && target.owner !== me) {
        return state;
      }

      // 1. Enemy with a garrison → battle
      if (target.owner && target.owner !== me && (target.garrison?.length || 0) > 0) {
        return {
          ...state,
          screen: "battle",
          pendingBattle: { tileId: target.id, attacker: me, defender: target.owner },
        };
      }
      // 2. Unowned cave/shrine/ruin → encounter
      if (!target.owner && target.town && TOWN_TYPES[target.town]?.encounter) {
        const enc = ENCOUNTERS[Math.floor(Math.random() * ENCOUNTERS.length)];
        return {
          ...state,
          screen: "encounter",
          pendingEncounter: { tileId: target.id, encId: enc.id },
        };
      }
      // 3. Unowned town/city/fort → bandit garrison, must fight
      if (!target.owner && target.town && ["town", "city", "fort"].includes(target.town)) {
        if (!target.garrison || target.garrison.length === 0) {
          const tier = target.town === "city" ? 4 : target.town === "fort" ? 3 : 2;
          target.garrison = [
            { unit: "bandit_raider", count: tier + 2 },
            { unit: "bandit_archer", count: Math.max(1, tier - 1) },
          ];
        }
        return {
          ...state,
          map: { ...state.map, tiles },
          screen: "battle",
          pendingBattle: { tileId: target.id, attacker: me, defender: "bandit" },
        };
      }
      // 4. Empty wilderness → small skirmish before claim, scaled by terrain
      if (!target.owner && !target.town) {
        const terr = TERRAINS[target.terrain];
        const skirmishChance = (
          { mountain: 0.85, hills: 0.55, forest: 0.65, coast: 0.4, plains: 0.35, sea: 0 }
        )[target.terrain] ?? 0.5;
        if (Math.random() < skirmishChance) {
          target.garrison = [{ unit: "bandit_raider", count: 2 + Math.floor(Math.random() * 2) }];
          return {
            ...state,
            map: { ...state.map, tiles },
            screen: "battle",
            pendingBattle: { tileId: target.id, attacker: me, defender: "bandit" },
          };
        }
        target.owner = me;
        const log = [...state.log, { round: state.round, text: `${FACTIONS[me].short} secured ${terr.name}.` }];
        return { ...state, map: { ...state.map, tiles: revealForHumans(state, tiles) }, log };
      }
      // 5. Empty enemy tile (rare) — just claim
      if (target.owner && target.owner !== me) {
        target.owner = me;
        target.garrison = [];
        return { ...state, map: { ...state.map, tiles: revealForHumans(state, tiles) } };
      }
      // 6. Already mine — no-op
      return state;
    }

    case "CLAIM_TILE": {
      const tiles = state.map.tiles.map((t) =>
        t.id === action.tileId
          ? { ...t, owner: action.faction, garrison: action.garrison || t.garrison }
          : t
      );
      return { ...state, map: { ...state.map, tiles } };
    }

    case "SPEND_GOLD": {
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      p.gold = Math.max(0, p.gold + action.amount);
      players[action.faction] = p;
      return { ...state, players };
    }

    case "RECRUIT": {
      // Merge invariant: when recruiting more of an archetype that's
      // already in the retinue, count goes up but lvl/xp on the existing
      // stack are preserved. New recruits inherit the veteran level — this
      // keeps the player's mental model "one stack per archetype" and
      // means PROMOTE_STACK / loss-application don't have to disambiguate.
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      const cost = Economy.troopCost(action.unit, action.count, p.hero);
      if (p.gold < cost) return state;
      p.gold -= cost;
      if (action.toRetinue) {
        const r = [...p.hero.retinue];
        const idx = r.findIndex((s) => s.unit === action.unit);
        if (idx >= 0) {
          r[idx] = { ...r[idx], count: r[idx].count + action.count };
        } else {
          r.push({ unit: action.unit, count: action.count, lvl: 1, xp: 0 });
        }
        p.hero = { ...p.hero, retinue: r };
        players[action.faction] = p;
        return { ...state, players };
      }
      const tiles = state.map.tiles.map((t) => {
        if (t.id !== action.tileId) return t;
        const g = [...(t.garrison || [])];
        const idx = g.findIndex((s) => s.unit === action.unit);
        if (idx >= 0) g[idx] = { ...g[idx], count: g[idx].count + action.count };
        else g.push({ unit: action.unit, count: action.count });
        return { ...t, garrison: g };
      });
      players[action.faction] = p;
      return { ...state, players, map: { ...state.map, tiles } };
    }

    case "SET_HERO_BEHAVIOR": {
      // action: { faction, key: "stance"|"targeting"|"autoCast", value }
      // Pre-battle hero AI tuning surfaced from the ARMY tab. We validate
      // each key's enum so the reducer rejects bad UI inputs without
      // letting them poison the save file.
      const VALID = {
        stance:    ["aggressive", "balanced", "defensive"],
        targeting: ["closest", "wounded", "threat", "support"],
        autoCast:  ["__bool__"],
      };
      const { key, value } = action;
      const allow = VALID[key];
      if (!allow) return state;
      if (allow[0] === "__bool__") {
        if (typeof value !== "boolean") return state;
      } else if (!allow.includes(value)) {
        return state;
      }
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      const prev = p.hero.behavior || { stance: "balanced", targeting: "closest", autoCast: false };
      p.hero = { ...p.hero, behavior: { ...prev, [key]: value } };
      players[action.faction] = p;
      return { ...state, players };
    }

    case "SET_STACK_LANE": {
      // action: { faction, stackIndex, lane: 0|1|2|null }
      // Player-chosen formation per retinue stack. Battle.spawnSide reads
      // this; missing/null falls back to round-robin so legacy retinues
      // and freshly recruited units distribute themselves automatically.
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      const r = [...(p.hero.retinue || [])];
      const stack = r[action.stackIndex];
      if (!stack) return state;
      const lane = action.lane;
      if (lane !== null && lane !== 0 && lane !== 1 && lane !== 2) return state;
      r[action.stackIndex] = { ...stack, lane: lane === null ? undefined : lane };
      p.hero = { ...p.hero, retinue: r };
      players[action.faction] = p;
      return { ...state, players };
    }

    case "PROMOTE_STACK": {
      // action: { faction, stackIndex, toUnit }
      // FE-style class change: must be at STACK_LEVEL_CAP, target must be
      // a valid branch in PROMOTIONS, player must afford the cost.
      // Resets lvl to 1; xp is wiped (no overflow into the new tier).
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      const r = [...(p.hero.retinue || [])];
      const stack = r[action.stackIndex];
      if (!stack) return state;
      const branches = PROMOTIONS[stack.unit] || [];
      if (!branches.includes(action.toUnit)) return state;
      if ((stack.lvl ?? 1) < STACK_LEVEL_CAP) return state;
      const cost = promotionCost(stack.count);
      if (p.gold < cost) return state;

      // Merge into an existing stack of the target archetype if present —
      // preserves the "one stack per archetype" invariant from RECRUIT.
      const existingIdx = r.findIndex(
        (s, i) => i !== action.stackIndex && s.unit === action.toUnit
      );
      if (existingIdx >= 0) {
        r[existingIdx] = {
          ...r[existingIdx],
          count: r[existingIdx].count + stack.count,
        };
        r.splice(action.stackIndex, 1);
      } else {
        r[action.stackIndex] = {
          ...stack,
          unit: action.toUnit,
          lvl: 1,
          xp: 0,
        };
      }

      p.gold -= cost;
      p.hero = { ...p.hero, retinue: r };
      players[action.faction] = p;
      return { ...state, players };
    }

    case "EQUIP": {
      // Direct slot-set used by encounters and tests. Does not interact with
      // the inventory pool — anything previously in the slot is overwritten.
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      const eq = { ...p.hero.equipment, [action.slot]: action.itemId };
      p.hero = { ...p.hero, equipment: eq };
      players[action.faction] = p;
      return { ...state, players };
    }

    case "EQUIP_FROM_INVENTORY": {
      // Move an item from hero.inventory into the matching slot. The item
      // currently in that slot (if any) drops back into inventory — a swap.
      // Refuses if the item id isn't in the inventory.
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      const item = ITEMS[action.itemId];
      if (!item || item.slot === "consumable") return state;
      const inv = [...(p.hero.inventory || [])];
      const idx = inv.indexOf(action.itemId);
      if (idx < 0) return state;
      inv.splice(idx, 1);
      const slot = item.slot;
      const prev = p.hero.equipment?.[slot];
      if (prev) inv.push(prev);
      const eq = { ...p.hero.equipment, [slot]: action.itemId };
      p.hero = { ...p.hero, equipment: eq, inventory: inv };
      players[action.faction] = p;
      return { ...state, players };
    }

    case "UNEQUIP_TO_INVENTORY": {
      // Pop a slot back into inventory. No-op if the slot is already empty.
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      const slot = action.slot;
      const cur = p.hero.equipment?.[slot];
      if (!cur) return state;
      const inv = [...(p.hero.inventory || []), cur];
      const eq = { ...p.hero.equipment, [slot]: null };
      p.hero = { ...p.hero, equipment: eq, inventory: inv };
      players[action.faction] = p;
      return { ...state, players };
    }

    case "SELL_ITEM": {
      // Sell from inventory only (refund 50% of cost, rounded down). Equipped
      // items must be unequipped first — keeps the data flow simple and the
      // UI's "are you sure" friction in the right place.
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      const inv = [...(p.hero.inventory || [])];
      const idx = inv.indexOf(action.itemId);
      if (idx < 0) return state;
      const item = ITEMS[action.itemId];
      if (!item) return state;
      inv.splice(idx, 1);
      const refund = Math.floor((item.cost || 0) * 0.5);
      p.gold += refund;
      p.hero = { ...p.hero, inventory: inv };
      players[action.faction] = p;
      return { ...state, players };
    }

    case "BUY_ITEM": {
      // Always lands in inventory (or consumables list). Players equip via
      // EQUIP_FROM_INVENTORY in the inventory tab. Keeps purchase/equipping
      // as two distinct decisions.
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      const item = ITEMS[action.itemId];
      if (!item || p.gold < item.cost) return state;
      p.gold -= item.cost;
      if (item.slot === "consumable") {
        p.hero = { ...p.hero, consumables: [...p.hero.consumables, item.id] };
      } else {
        p.hero = { ...p.hero, inventory: [...(p.hero.inventory || []), item.id] };
      }
      players[action.faction] = p;
      return { ...state, players };
    }

    case "TAKE_PERK": {
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      if (p.hero.perks.includes(action.perkId)) return state;
      p.hero = { ...p.hero, perks: [...p.hero.perks, action.perkId] };
      players[action.faction] = p;
      return { ...state, players };
    }

    case "ADD_XP": {
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      let h = { ...p.hero, xp: p.hero.xp + action.amount };
      while (h.xp >= heroXpForLevel(h.lvl + 1)) {
        const def = HEROES[h.id];
        h.lvl += 1;
        h.maxHp += def.perRank.hp;
        h.hp = h.maxHp;
        h.maxMp += def.perRank.mp;
      }
      p.hero = h;
      players[action.faction] = p;
      return { ...state, players };
    }

    case "RESOLVE_BATTLE": {
      const tiles = state.map.tiles.map((t) => ({ ...t, garrison: [...(t.garrison || [])] }));
      const tile = tiles.find((t) => t.id === action.tileId);
      const players = { ...state.players };
      const atk = { ...players[action.attacker] };
      const atkRetAfterLoss = applyLosses(atk.hero.retinue, action.result.attackerLosses);
      // FE-style stack XP: pool the same `result.xp` figure the hero earns
      // and split it evenly across surviving stacks. Level-up loop inside
      // awardStackXp clamps at STACK_LEVEL_CAP. Hero XP and stack XP are
      // independent pools — neither steals from the other.
      // perk_scholar: hero XP gets a +50% multiplier; stack XP keeps the
      // base figure so promotion pacing stays unchanged.
      const baseXp = action.result.xp || 30;
      const xpPerStack = atkRetAfterLoss.length
        ? Math.floor(baseXp / atkRetAfterLoss.length)
        : 0;
      const atkRet = atkRetAfterLoss.map((s) => awardStackXp(s, xpPerStack));
      atk.hero = { ...atk.hero, retinue: atkRet };
      if (tile) tile.garrison = applyLosses(tile.garrison, action.result.defenderLosses);
      const heroXp = atk.hero?.perks?.includes("perk_scholar")
        ? Math.round(baseXp * 1.5)
        : baseXp;
      atk.hero.xp += heroXp;
      // Equipment-driven gold payouts (onKill/onCrit type:"gold") accumulate
      // during the battle and are deposited regardless of outcome — the
      // hero earned them swing by swing.
      const bonus = action.result.attackerBonusGold || 0;
      if (bonus > 0) atk.gold = (atk.gold || 0) + bonus;
      while (atk.hero.xp >= heroXpForLevel(atk.hero.lvl + 1)) {
        const def = HEROES[atk.hero.id];
        atk.hero.lvl += 1;
        atk.hero.maxHp += def.perRank.hp;
        atk.hero.hp = atk.hero.maxHp;
        atk.hero.maxMp += def.perRank.mp;
      }
      players[action.attacker] = atk;

      if (action.result.winner === "attacker") {
        if (tile) {
          tile.owner = action.attacker;
          tile.garrison = atkRet.length
            ? [{ unit: atkRet[0].unit, count: Math.max(1, Math.floor(atkRet[0].count / 2)) }]
            : [];
        }
      }
      const revealed = revealForHumans(state, tiles);
      const dv = applyDefeatAndVictory(state, players, revealed);
      const nextScreen = dv.screen || "summary";
      return {
        ...state,
        screen: nextScreen,
        pendingBattle: null,
        pendingSummary: { ...action.result, tileId: action.tileId, attacker: action.attacker, defender: action.defender },
        pendingVictory: dv.pendingVictory ?? state.pendingVictory,
        map: { ...state.map, tiles: revealed },
        players: dv.players,
      };
    }

    case "RESOLVE_ENCOUNTER": {
      // action: { delta, optional?, tileId? }
      // If optional, we don't claim the tile and we return to the zone screen.
      // Otherwise we consume state.pendingEncounter and claim its tile.
      const players = { ...state.players };
      const me = state.activePlayer;
      players[me] = applyEncounterDelta(players[me], action.delta);
      const log = [...state.log, { round: state.round, text: action.delta?.log || "An encounter resolved." }];

      if (action.optional) {
        return {
          ...state,
          players, log,
          screen: "zone",
          screenParams: { tileId: action.tileId },
        };
      }
      const claimedId = state.pendingEncounter?.tileId ?? action.tileId;
      const tiles = state.map.tiles.map((t) => (t.id === claimedId ? { ...t, owner: me } : t));
      return {
        ...state,
        players,
        map: { ...state.map, tiles: revealForHumans(state, tiles) },
        log,
        pendingEncounter: null,
        screen: "map",
      };
    }

    case "END_ROUND": {
      const players = { ...state.players };
      const log = [...state.log];
      for (const fid of FACTION_LIST) {
        // Always reset endedTurn — even defeated factions, in case a future
        // mechanic resurrects them; the flag should never carry across rounds.
        const base = { ...players[fid], endedTurn: false };
        if (base.defeated) {
          players[fid] = base;
          continue;
        }
        const inc = Economy.computeIncome(state, fid);
        const upk = Economy.computeUpkeep(state, fid);
        const next = base.gold + inc - upk;
        players[fid] = { ...base, gold: Math.max(0, next) };
      }
      log.push({ round: state.round + 1, text: `Round ${state.round + 1} begins.` });
      let map = state.map;
      const aiFactions = FACTION_LIST.filter((f) => !players[f].isHuman && !players[f].defeated);
      for (const f of aiFactions) {
        map = AI.takeTurn({ ...state, map, players }, f);
      }
      const newRound = state.round + 1;
      const stateAfterAI = { ...state, map, players, round: newRound };

      // Defeat / victory check after AI expansions.
      const dv = applyDefeatAndVictory(stateAfterAI, players, map.tiles);
      if (dv.screen) {
        return {
          ...state,
          players: dv.players,
          log,
          map,
          round: newRound,
          screen: "victory",
          pendingVictory: dv.pendingVictory,
        };
      }

      // Roll for an AI-vs-human defense raid; pick at most one.
      const pendingDefense = AI.maybeAttackPlayer({ ...stateAfterAI, players: dv.players });
      if (pendingDefense) {
        const fac = FACTIONS[pendingDefense.attackerFaction];
        // Find the defending human (tile owner). In co-op the active player
        // and the defender may differ — auto-switch so the right partner
        // plays the minigame and their retinue loads.
        const defenderTile = map.tiles.find((t) => t.id === pendingDefense.tileId);
        const defenderFaction = defenderTile?.owner || state.activePlayer;
        log.push({
          round: newRound,
          text: `${fac.short} marches on ${FACTIONS[defenderFaction]?.short || "your"} borders!`,
        });
        // In coop, route through Handoff first so the partner physically
        // holding the device knows control is being passed before the
        // minigame starts. The Handoff screen reads screenParams.next.
        const isCoop = !!state.coopFaction;
        const switchingPlayer =
          isCoop && state.activePlayer !== defenderFaction;
        return {
          ...state,
          players: dv.players,
          log,
          map,
          round: newRound,
          activePlayer: defenderFaction,
          screen: switchingPlayer ? "handoff" : "defense",
          screenParams: switchingPlayer
            ? { next: "defense", tileId: pendingDefense.tileId }
            : { tileId: pendingDefense.tileId },
          pendingDefense,
        };
      }

      return { ...state, players: dv.players, log, map, round: newRound, screen: "map" };
    }

    case "RESOLVE_DEFENSE": {
      const tiles = state.map.tiles.map((t) => ({ ...t, garrison: [...(t.garrison || [])] }));
      const tile = tiles.find((t) => t.id === action.tileId);
      const regionName = tile
        ? (TOWN_TYPES[tile.town]?.name || TERRAINS[tile.terrain]?.name || "the region")
        : "the region";
      const log = [...state.log];
      let players = state.players;
      if (action.won) {
        if (tile) {
          log.push({
            round: state.round,
            text: `The walls of ${regionName} held against the assault.`,
          });
        }
      } else if (tile) {
        const attackerFaction = action.attackerFaction;
        const defenderFaction = tile.owner;
        tile.owner = attackerFaction;
        tile.garrison = [];
        // Defenders wiped: the retinue is hero-bound, but the lore is they
        // died defending — wipe the hero's retinue for the tile's prior owner.
        const dPlayer = defenderFaction ? players[defenderFaction] : null;
        if (dPlayer) {
          players = {
            ...players,
            [defenderFaction]: {
              ...dPlayer,
              hero: { ...dPlayer.hero, retinue: [] },
            },
          };
        }
        const fac = FACTIONS[attackerFaction];
        log.push({
          round: state.round,
          text: `${fac.short} overran the defenders and seized the region.`,
        });
      }

      const dv = applyDefeatAndVictory(state, players, tiles);
      const nextScreen = dv.screen || "map";
      return {
        ...state,
        screen: nextScreen,
        screenParams: {},
        pendingDefense: null,
        pendingVictory: dv.pendingVictory ?? state.pendingVictory,
        players: dv.players,
        map: { ...state.map, tiles },
        log,
      };
    }

    case "SET_THEME":
      return { ...state, theme: action.theme };

    case "REGEN_MAP": {
      const ns = makeInitialState({
        seed: action.seed,
        human: state.humanFaction,
        coopWith: state.coopFaction,
      });
      return { ...ns, theme: state.theme };
    }

    case "NEW_GAME": {
      // Replace state wholesale with a freshly seeded game, but preserve theme.
      const ns = makeInitialState({
        seed: action.seed,
        human: action.human,
        coopWith: action.coopWith,
      });
      return { ...ns, screen: "map", theme: state.theme };
    }

    case "LOAD_STATE":
      return action.state;

    case "DISMISS_SUMMARY":
      return { ...state, screen: "map", pendingSummary: null };

    default:
      return state;
  }
}

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, null, () => SaveSystem.load() || makeInitialState());

  // Autosave
  useEffect(() => {
    const t = setInterval(() => SaveSystem.save(state), CONST.SAVE_AUTOSAVE_MS);
    return () => clearInterval(t);
  }, [state]);

  // Apply theme to <html data-theme>
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", state.theme || "parchment");
  }, [state.theme]);

  return <StoreCtx.Provider value={{ state, dispatch }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  return useContext(StoreCtx);
}
