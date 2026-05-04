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
import { generateMap, TERRAINS, TOWN_TYPES } from "../data/map.js";
import { AI } from "../systems/ai.js";

const StoreCtx = createContext(null);

export function makeInitialState(opts = {}) {
  const seed = opts.seed ?? CONST.MAP.DEFAULT_SEED;
  const human = opts.human ?? "crown";
  const coopWith = opts.coopWith ?? null;

  const map = generateMap(seed, { cols: CONST.MAP.COLS, rows: CONST.MAP.ROWS });

  const players = {};
  for (const fid of FACTION_LIST) {
    const fac = FACTIONS[fid];
    const heroDef = HEROES[fac.heroStarter];
    players[fid] = {
      faction: fid,
      gold: fid === human ? CONST.STARTING_GOLD : 150,
      isHuman: fid === human || fid === coopWith,
      defeated: false,
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
        consumables: ["potionHeal", "potionHeal"],
        perks: [],
        retinue: [
          { unit: fac.units[0], count: 4 },
          { unit: fac.units[1], count: 1 },
        ],
        mounted: false,
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
    const eq = { ...p.hero.equipment };
    const cons = [...p.hero.consumables];
    for (const itemId of d.items) {
      const item = ITEMS[itemId];
      if (!item) continue;
      if (item.slot === "consumable") cons.push(item.id);
      else eq[item.slot] = item.id;
    }
    p.hero = { ...p.hero, equipment: eq, consumables: cons };
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
        return { ...state, map: { ...state.map, tiles }, log };
      }
      // 5. Empty enemy tile (rare) — just claim
      if (target.owner && target.owner !== me) {
        target.owner = me;
        target.garrison = [];
        return { ...state, map: { ...state.map, tiles } };
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
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      const cost = Economy.troopCost(action.unit, action.count, p.hero);
      if (p.gold < cost) return state;
      p.gold -= cost;
      if (action.toRetinue) {
        const r = [...p.hero.retinue];
        const idx = r.findIndex((s) => s.unit === action.unit);
        if (idx >= 0) r[idx] = { ...r[idx], count: r[idx].count + action.count };
        else r.push({ unit: action.unit, count: action.count });
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

    case "EQUIP": {
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      const eq = { ...p.hero.equipment, [action.slot]: action.itemId };
      p.hero = { ...p.hero, equipment: eq };
      players[action.faction] = p;
      return { ...state, players };
    }

    case "BUY_ITEM": {
      const players = { ...state.players };
      const p = { ...players[action.faction] };
      const item = ITEMS[action.itemId];
      if (!item || p.gold < item.cost) return state;
      p.gold -= item.cost;
      if (item.slot === "consumable") {
        p.hero = { ...p.hero, consumables: [...p.hero.consumables, item.id] };
      } else {
        p.hero = { ...p.hero, equipment: { ...p.hero.equipment, [item.slot]: item.id } };
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
      const atkRet = applyLosses(atk.hero.retinue, action.result.attackerLosses);
      atk.hero = { ...atk.hero, retinue: atkRet };
      if (tile) tile.garrison = applyLosses(tile.garrison, action.result.defenderLosses);
      atk.hero.xp += action.result.xp || 30;
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
      const dv = applyDefeatAndVictory(state, players, tiles);
      const nextScreen = dv.screen || "summary";
      return {
        ...state,
        screen: nextScreen,
        pendingBattle: null,
        pendingSummary: { ...action.result, tileId: action.tileId, attacker: action.attacker, defender: action.defender },
        pendingVictory: dv.pendingVictory ?? state.pendingVictory,
        map: { ...state.map, tiles },
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
        map: { ...state.map, tiles },
        log,
        pendingEncounter: null,
        screen: "map",
      };
    }

    case "END_ROUND": {
      const players = { ...state.players };
      const log = [...state.log];
      for (const fid of FACTION_LIST) {
        if (players[fid].defeated) continue;
        const inc = Economy.computeIncome(state, fid);
        const upk = Economy.computeUpkeep(state, fid);
        const next = players[fid].gold + inc - upk;
        players[fid] = { ...players[fid], gold: Math.max(0, next) };
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
        log.push({
          round: newRound,
          text: `${fac.short} marches on your borders!`,
        });
        return {
          ...state,
          players: dv.players,
          log,
          map,
          round: newRound,
          screen: "defense",
          screenParams: { tileId: pendingDefense.tileId },
          pendingDefense,
        };
      }

      return { ...state, players: dv.players, log, map, round: newRound, screen: "map" };
    }

    case "RESOLVE_DEFENSE": {
      const tiles = state.map.tiles.map((t) => ({ ...t, garrison: [...(t.garrison || [])] }));
      const tile = tiles.find((t) => t.id === action.tileId);
      const log = [...state.log];
      let players = state.players;
      if (action.won) {
        if (tile) {
          log.push({
            round: state.round,
            text: `The walls of ${tile.id} held against the assault.`,
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
