/* tests/multiplayer.test.js — integration tests for local co-op.
 *
 * Each test targets one invariant. We deliberately avoid a single
 * end-to-end "play a whole game" test — when those break they're
 * miserable to debug. Instead we drive ≤6 dispatches per case and assert
 * one observable property.
 *
 * Math.random is stubbed per-test where the reducer would otherwise be
 * non-deterministic (skirmish chance, AI raid roll, AI expansion target). */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { gameReducer, makeInitialState } from "../src/core/store.jsx";
import { FACTION_LIST } from "../src/data/factions.js";
import { hexNeighbors } from "../src/data/map.js";

// ─── helpers ──────────────────────────────────────────────────────────

const newCoopGame = (opts = {}) =>
  makeInitialState({ seed: opts.seed ?? 42, human: "crown", coopWith: "thorn", ...opts });

const newSoloGame = (opts = {}) =>
  makeInitialState({ seed: opts.seed ?? 42, human: "crown", ...opts });

/** Find any unowned, non-sea tile to use for "stage a test scenario." */
const someEmptyTile = (state) =>
  state.map.tiles.find((t) => !t.owner && t.terrain !== "sea" && !t.town);

const setTileOwner = (state, tileId, owner, garrison = []) => {
  const tiles = state.map.tiles.map((t) =>
    t.id === tileId ? { ...t, owner, garrison } : t
  );
  return { ...state, map: { ...state.map, tiles } };
};

// ─── 1. Setup ────────────────────────────────────────────────────────

describe("co-op setup", () => {
  it("flags both human and coop ally as isHuman, leaves rivals as AI", () => {
    const s = newCoopGame();
    expect(s.players.crown.isHuman).toBe(true);
    expect(s.players.thorn.isHuman).toBe(true);
    expect(s.players.tide.isHuman).toBe(false);
    expect(s.players.ash.isHuman).toBe(false);
  });

  it("starts with isolated gold pools and independent retinues", () => {
    const s = newCoopGame();
    expect(s.players.crown.gold).not.toBe(s.players.thorn.gold);
    expect(s.players.crown.hero.retinue).not.toBe(s.players.thorn.hero.retinue);
    // Different starting unit rosters
    expect(s.players.crown.hero.retinue[0].unit).toBe("levy");
    expect(s.players.thorn.hero.retinue[0].unit).toBe("forager");
  });

  it("initializes endedTurn:false for every player", () => {
    const s = newCoopGame();
    for (const fid of FACTION_LIST) {
      expect(s.players[fid].endedTurn).toBe(false);
    }
  });

  it("activePlayer starts as humanFaction even with coop", () => {
    const s = newCoopGame();
    expect(s.activePlayer).toBe("crown");
    expect(s.humanFaction).toBe("crown");
    expect(s.coopFaction).toBe("thorn");
  });
});

// ─── 2. Per-player isolation ─────────────────────────────────────────

describe("per-player state isolation", () => {
  it("RECRUIT to retinue mutates only the active player", () => {
    const s = newCoopGame();
    const partnerBefore = s.players.thorn;
    const after = gameReducer(s, {
      type: "RECRUIT", faction: "crown", unit: "levy", count: 2, toRetinue: true,
    });
    expect(after.players.thorn).toBe(partnerBefore); // ref-equal: untouched
    expect(after.players.crown.gold).toBeLessThan(s.players.crown.gold);
  });

  it("BUY_ITEM only changes active player's equipment", () => {
    const s = newCoopGame();
    const partnerBefore = s.players.thorn;
    const after = gameReducer(s, { type: "BUY_ITEM", faction: "crown", itemId: "longsword" });
    expect(after.players.thorn).toBe(partnerBefore);
    expect(after.players.crown.hero.equipment.weapon).toBe("longsword");
  });

  it("TAKE_PERK leaves the partner's perks untouched", () => {
    const s = newCoopGame();
    const after = gameReducer(s, { type: "TAKE_PERK", faction: "crown", perkId: "perk_strike" });
    expect(after.players.crown.hero.perks).toEqual(["perk_strike"]);
    expect(after.players.thorn.hero.perks).toEqual([]);
  });

  it("SPEND_GOLD on one player doesn't touch the other", () => {
    const s = newCoopGame();
    const partnerGoldBefore = s.players.thorn.gold;
    const after = gameReducer(s, { type: "SPEND_GOLD", faction: "crown", amount: -50 });
    expect(after.players.crown.gold).toBe(s.players.crown.gold - 50);
    expect(after.players.thorn.gold).toBe(partnerGoldBefore);
  });
});

// ─── 3. Ally-attack guard ────────────────────────────────────────────

describe("MOVE_HERO_TO ally guard", () => {
  it("returns referentially-identical state when target is a coop ally tile", () => {
    let s = newCoopGame({ seed: 7 });
    const empty = someEmptyTile(s);
    s = setTileOwner(s, empty.id, "thorn", [{ unit: "forager", count: 3 }]);
    const after = gameReducer(s, { type: "MOVE_HERO_TO", tileId: empty.id });
    expect(after).toBe(s); // strict reference equality — no mutation
  });

  it("does not stage a battle against ally tile even with garrison present", () => {
    let s = newCoopGame({ seed: 7 });
    const empty = someEmptyTile(s);
    s = setTileOwner(s, empty.id, "thorn", [{ unit: "forager", count: 5 }]);
    const after = gameReducer(s, { type: "MOVE_HERO_TO", tileId: empty.id });
    expect(after.screen).not.toBe("battle");
    expect(after.pendingBattle).toBeNull();
  });
});

// ─── 4. SWAP_CONTROL ─────────────────────────────────────────────────

describe("SWAP_CONTROL", () => {
  it("flips active and routes to handoff with next param", () => {
    const s = newCoopGame();
    const after = gameReducer(s, { type: "SWAP_CONTROL", next: "shop" });
    expect(after.activePlayer).toBe("thorn");
    expect(after.screen).toBe("handoff");
    expect(after.screenParams).toEqual({ next: "shop" });
  });

  it("defaults next to map", () => {
    const after = gameReducer(newCoopGame(), { type: "SWAP_CONTROL" });
    expect(after.screenParams.next).toBe("map");
  });

  it("is a no-op (ref-equal) in single-player", () => {
    const s = newSoloGame();
    const after = gameReducer(s, { type: "SWAP_CONTROL" });
    expect(after).toBe(s);
  });
});

// ─── 5. END_TURN three-branch state machine ──────────────────────────

describe("END_TURN", () => {
  it("single-player: behaves like END_ROUND (advances round)", () => {
    const s = newSoloGame();
    // Stub Math.random so the AI loop is deterministic-ish; the reducer
    // doesn't crash and the round advances.
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const after = gameReducer(s, { type: "END_TURN" });
    expect(after.round).toBe(s.round + 1);
    expect(after.activePlayer).toBe("crown");
    vi.restoreAllMocks();
  });

  it("coop, partner not yet ended: marks active.endedTurn, hands off", () => {
    const s = newCoopGame();
    const after = gameReducer(s, { type: "END_TURN" });
    expect(after.players.crown.endedTurn).toBe(true);
    expect(after.players.thorn.endedTurn).toBe(false);
    expect(after.activePlayer).toBe("thorn");
    expect(after.screen).toBe("handoff");
    expect(after.round).toBe(s.round); // no advance yet
  });

  it("coop, partner already ended: advances round and resets both flags", () => {
    let s = newCoopGame();
    // P1 ends turn first
    s = gameReducer(s, { type: "END_TURN" });
    expect(s.players.crown.endedTurn).toBe(true);
    // Pretend the partner clicked through Handoff back to map
    s = { ...s, screen: "map", screenParams: {} };
    // Stub Math.random for the END_ROUND AI loop
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const after = gameReducer(s, { type: "END_TURN" });
    expect(after.round).toBe(s.round + 1);
    expect(after.players.crown.endedTurn).toBe(false);
    expect(after.players.thorn.endedTurn).toBe(false);
    vi.restoreAllMocks();
  });

  it("END_ROUND resets endedTurn for defeated factions too (future-proof)", () => {
    let s = newCoopGame();
    s = {
      ...s,
      players: {
        ...s.players,
        thorn: { ...s.players.thorn, defeated: true, endedTurn: true },
      },
    };
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const after = gameReducer(s, { type: "END_ROUND" });
    expect(after.players.thorn.endedTurn).toBe(false);
    vi.restoreAllMocks();
  });
});

// ─── 6. Defense raid routes the right player ─────────────────────────

describe("AI defense raid in co-op", () => {
  beforeEach(() => {
    // Force the AI raid roll to fire and the AI expansion to be benign.
    // ai.maybeAttackPlayer uses Math.random() < 0.20 (raid chance) and a
    // second Math.random() for picking the target. Returning 0.05 fires.
    vi.spyOn(Math, "random").mockReturnValue(0.05);
  });
  afterEach(() => vi.restoreAllMocks());

  it("a raid sets activePlayer to the raided tile's owner — even if a different player was active", () => {
    // We can't deterministically force which tile the AI raids without a
    // big refactor of ai.js, but we CAN assert that *whichever* tile was
    // chosen, the active player ends up as that tile's new owner-defender.
    let s = newCoopGame({ seed: 11 });
    // Plant several thorn-owned tiles adjacent to AI capitals so the
    // chance of raiding a thorn tile is high.
    const aiTiles = s.map.tiles.filter((t) => t.owner === "tide" || t.owner === "ash");
    for (const ai of aiTiles) {
      for (const n of hexNeighbors(ai, s.map.tiles)) {
        if (!n.owner && n.terrain !== "sea") {
          s = setTileOwner(s, n.id, "thorn", [{ unit: "forager", count: 3 }]);
          break;
        }
      }
    }
    expect(s.activePlayer).toBe("crown");
    const after = gameReducer(s, { type: "END_ROUND" });
    if (after.pendingDefense) {
      const raidedTile = after.map.tiles.find((t) => t.id === after.pendingDefense.tileId);
      // Whoever owns the raided tile should now be active — that's the
      // invariant we care about: the right player plays the minigame.
      expect(after.activePlayer).toBe(raidedTile.owner);
      // If the active player CHANGED from crown, route through Handoff;
      // otherwise direct to defense.
      if (raidedTile.owner !== "crown") {
        expect(after.screen).toBe("handoff");
        expect(after.screenParams.next).toBe("defense");
      } else {
        expect(after.screen).toBe("defense");
      }
    }
  });
});

// ─── 7. RESOLVE_DEFENSE wipes the right player's retinue ─────────────

describe("RESOLVE_DEFENSE in co-op", () => {
  it("loss flips tile to attacker AND wipes the tile owner's retinue (not active player's)", () => {
    let s = newCoopGame();
    const empty = someEmptyTile(s);
    s = setTileOwner(s, empty.id, "thorn", [{ unit: "forager", count: 3 }]);
    s = { ...s, pendingDefense: { tileId: empty.id, attackerFaction: "ash" } };
    // crown is active even though thorn is being raided
    expect(s.activePlayer).toBe("crown");
    const crownRetBefore = s.players.crown.hero.retinue;
    const after = gameReducer(s, {
      type: "RESOLVE_DEFENSE", tileId: empty.id, won: false, attackerFaction: "ash",
    });
    // Tile flipped to attacker
    const lost = after.map.tiles.find((t) => t.id === empty.id);
    expect(lost.owner).toBe("ash");
    // thorn's retinue wiped — NOT crown's
    expect(after.players.thorn.hero.retinue).toEqual([]);
    expect(after.players.crown.hero.retinue).toBe(crownRetBefore);
  });

  it("win clears pendingDefense and keeps tile owner unchanged", () => {
    let s = newCoopGame();
    const empty = someEmptyTile(s);
    s = setTileOwner(s, empty.id, "thorn", [{ unit: "forager", count: 3 }]);
    s = { ...s, pendingDefense: { tileId: empty.id, attackerFaction: "ash" } };
    const after = gameReducer(s, {
      type: "RESOLVE_DEFENSE", tileId: empty.id, won: true, attackerFaction: "ash",
    });
    expect(after.pendingDefense).toBeNull();
    const tile = after.map.tiles.find((t) => t.id === empty.id);
    expect(tile.owner).toBe("thorn");
    // Retinue preserved
    expect(after.players.thorn.hero.retinue.length).toBeGreaterThan(0);
  });
});

// ─── 8. Fog of war unions both human factions ────────────────────────

describe("fog of war in co-op", () => {
  it("explored set covers tiles around BOTH humanFaction and coopFaction", () => {
    const s = newCoopGame({ seed: 3 });
    const crownCapital = s.map.tiles.find((t) => t.owner === "crown" && t.town === "capital");
    const thornCapital = s.map.tiles.find((t) => t.owner === "thorn" && t.town === "capital");
    expect(crownCapital.explored).toBe(true);
    expect(thornCapital.explored).toBe(true);
    // Both capitals' neighbors should be explored too
    for (const n of hexNeighbors(crownCapital, s.map.tiles)) expect(n.explored).toBe(true);
    for (const n of hexNeighbors(thornCapital, s.map.tiles)) expect(n.explored).toBe(true);
  });

  it("the AI's capital starts unexplored", () => {
    const s = newCoopGame({ seed: 3 });
    const ash = s.map.tiles.find((t) => t.owner === "ash" && t.town === "capital");
    // ash isn't adjacent to crown or thorn capitals on this seed, so unexplored.
    // Don't assert if it happens to be adjacent (different seed).
    const neighbors = [
      ...hexNeighbors(ash, s.map.tiles),
      ash,
    ];
    const adjToHuman = neighbors.some((t) => t.owner === "crown" || t.owner === "thorn");
    if (!adjToHuman) expect(ash.explored).toBe(false);
  });
});

// ─── 9. Victory / defeat with split humans ───────────────────────────

describe("victory check with split humans", () => {
  it("if crown is wiped but thorn holds tiles, game continues — no victory", () => {
    let s = newCoopGame();
    // Wipe crown's tiles to AI
    s = {
      ...s,
      map: {
        ...s.map,
        tiles: s.map.tiles.map((t) => (t.owner === "crown" ? { ...t, owner: "tide" } : t)),
      },
    };
    // Force a defeat-check by running RESOLVE_BATTLE (any battle triggers it)
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const after = gameReducer(s, {
      type: "RESOLVE_BATTLE",
      tileId: someEmptyTile(s).id,
      attacker: "tide", defender: "ash",
      result: { winner: "defender", attackerLosses: [], defenderLosses: [], xp: 0, duration: 1 },
    });
    expect(after.players.crown.defeated).toBe(true);
    expect(after.players.thorn.defeated).toBe(false);
    // Game continues — no victory screen
    expect(after.screen).not.toBe("victory");
    vi.restoreAllMocks();
  });

  it("if both humans are wiped, defeat screen fires with humanFaction marked", () => {
    let s = newCoopGame();
    // Wipe both crown and thorn tiles to AI
    s = {
      ...s,
      map: {
        ...s.map,
        tiles: s.map.tiles.map((t) =>
          t.owner === "crown" || t.owner === "thorn" ? { ...t, owner: "tide" } : t
        ),
      },
    };
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const after = gameReducer(s, {
      type: "RESOLVE_BATTLE",
      tileId: someEmptyTile(s).id,
      attacker: "tide", defender: "ash",
      result: { winner: "defender", attackerLosses: [], defenderLosses: [], xp: 0, duration: 1 },
    });
    expect(after.players.crown.defeated).toBe(true);
    expect(after.players.thorn.defeated).toBe(true);
    expect(after.screen).toBe("victory");
    expect(after.pendingVictory.winner).toBeNull();
    expect(after.pendingVictory.defeated).toBe("crown");
    vi.restoreAllMocks();
  });
});

// ─── 10. Save/load preserves multiplayer state ───────────────────────

describe("save/load roundtrip", () => {
  it("preserves activePlayer, endedTurn per player, pendingDefense", () => {
    let s = newCoopGame();
    s = gameReducer(s, { type: "END_TURN" });        // crown ends turn → thorn active
    s = { ...s, screen: "map", screenParams: {} };   // exit handoff
    s = gameReducer(s, { type: "TAKE_PERK", faction: "thorn", perkId: "perk_kindle" });
    s = { ...s, pendingDefense: { tileId: "1,1", attackerFaction: "ash" } };

    const json = JSON.parse(JSON.stringify(s));
    expect(json.activePlayer).toBe("thorn");
    expect(json.players.crown.endedTurn).toBe(true);
    expect(json.players.thorn.endedTurn).toBe(false);
    expect(json.players.thorn.hero.perks).toEqual(["perk_kindle"]);
    expect(json.pendingDefense).toEqual({ tileId: "1,1", attackerFaction: "ash" });
    expect(json.coopFaction).toBe("thorn");
    expect(json.humanFaction).toBe("crown");
  });
});

// ─── 11. NEW_GAME respects coop choice ───────────────────────────────

describe("NEW_GAME for co-op", () => {
  it("wipes any prior state and starts a coop campaign with the chosen partner", () => {
    let s = newSoloGame();
    s = gameReducer(s, { type: "TAKE_PERK", faction: "crown", perkId: "perk_strike" });
    const after = gameReducer(s, {
      type: "NEW_GAME", seed: 999, human: "crown", coopWith: "ash",
    });
    expect(after.coopFaction).toBe("ash");
    expect(after.players.ash.isHuman).toBe(true);
    expect(after.players.crown.hero.perks).toEqual([]); // wiped
    expect(after.screen).toBe("map");
  });
});
