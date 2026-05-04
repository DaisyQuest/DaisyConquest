import { describe, it, expect, beforeEach } from "vitest";
import { gameReducer, makeInitialState } from "../src/core/store.jsx";
import { Economy } from "../src/core/economy.js";
import { UNITS } from "../src/data/units.js";
import { ITEMS } from "../src/data/items.js";
import { heroXpForLevel, HEROES } from "../src/data/heroes.js";

let state;
beforeEach(() => {
  state = makeInitialState({ seed: 1, human: "crown" });
});

describe("SET_SCREEN", () => {
  it("transitions screen and clears params if not provided", () => {
    let s = gameReducer(state, { type: "SET_SCREEN", screen: "shop", params: { tileId: "1,1" } });
    expect(s.screen).toBe("shop");
    expect(s.screenParams).toEqual({ tileId: "1,1" });
    s = gameReducer(s, { type: "SET_SCREEN", screen: "map" });
    expect(s.screen).toBe("map");
    expect(s.screenParams).toEqual({});
  });
});

describe("SET_ACTIVE_PLAYER", () => {
  it("swaps activePlayer", () => {
    expect(state.activePlayer).toBe("crown");
    const s = gameReducer(state, { type: "SET_ACTIVE_PLAYER", faction: "tide" });
    expect(s.activePlayer).toBe("tide");
  });
});

describe("SWAP_CONTROL (co-op handoff)", () => {
  it("flips active between human and coop ally and routes through handoff", () => {
    const coop = makeInitialState({ seed: 2, human: "crown", coopWith: "thorn" });
    expect(coop.activePlayer).toBe("crown");
    const after = gameReducer(coop, { type: "SWAP_CONTROL", next: "map" });
    expect(after.activePlayer).toBe("thorn");
    expect(after.screen).toBe("handoff");
    expect(after.screenParams).toEqual({ next: "map" });
    const back = gameReducer(after, { type: "SWAP_CONTROL", next: "map" });
    expect(back.activePlayer).toBe("crown");
  });
  it("is a no-op when no co-op partner exists", () => {
    const after = gameReducer(state, { type: "SWAP_CONTROL", next: "map" });
    expect(after).toBe(state);
  });
});

describe("MOVE_HERO_TO co-op ally guard", () => {
  it("does not stage a battle against a co-op ally tile", () => {
    let s = makeInitialState({ seed: 3, human: "crown", coopWith: "thorn" });
    // Plant a thorn-owned tile with a garrison adjacent to crown's territory.
    const tiles = s.map.tiles.map((t) => ({ ...t }));
    const target = tiles.find((t) => t.terrain !== "sea" && !t.owner);
    target.owner = "thorn";
    target.garrison = [{ unit: "forager", count: 3 }];
    s = { ...s, map: { ...s.map, tiles } };
    const after = gameReducer(s, { type: "MOVE_HERO_TO", tileId: target.id });
    expect(after).toBe(s); // unchanged — no battle staged
    expect(after.screen).not.toBe("battle");
  });
});

describe("SELECT_TILE", () => {
  it("updates only the active player's selectedTile", () => {
    const tideBefore = state.players.tide.selectedTile;
    const s = gameReducer(state, { type: "SELECT_TILE", tileId: "2,3" });
    expect(s.players.crown.selectedTile).toBe("2,3");
    expect(s.players.tide.selectedTile).toBe(tideBefore);
  });
});

describe("SPEND_GOLD", () => {
  it("clamps to 0 on negative balance", () => {
    const s = gameReducer(state, { type: "SPEND_GOLD", faction: "crown", amount: -9999 });
    expect(s.players.crown.gold).toBe(0);
  });

  it("adds positive amount", () => {
    const startGold = state.players.crown.gold;
    const s = gameReducer(state, { type: "SPEND_GOLD", faction: "crown", amount: 50 });
    expect(s.players.crown.gold).toBe(startGold + 50);
  });
});

describe("RECRUIT", () => {
  it("to garrison: deducts gold, adds units, merges into existing stack", () => {
    // Find a tile owned by crown that has a garrison.
    const tile = state.map.tiles.find((t) => t.owner === "crown" && (t.garrison || []).length > 0);
    expect(tile).toBeTruthy();
    const startGold = state.players.crown.gold;
    const startStack = tile.garrison.find((s) => s.unit === "levy");
    const startCount = startStack ? startStack.count : 0;

    const s = gameReducer(state, {
      type: "RECRUIT",
      faction: "crown",
      tileId: tile.id,
      unit: "levy",
      count: 2,
      toRetinue: false,
    });
    const cost = Economy.troopCost("levy", 2, state.players.crown.hero);
    expect(s.players.crown.gold).toBe(startGold - cost);
    const newTile = s.map.tiles.find((t) => t.id === tile.id);
    const newStack = newTile.garrison.find((st) => st.unit === "levy");
    expect(newStack.count).toBe(startCount + 2);
  });

  it("to garrison: appends new stack when unit type not already present", () => {
    const tile = state.map.tiles.find((t) => t.owner === "crown" && (t.garrison || []).length > 0);
    // Choose a unit not currently on the tile.
    const presentUnits = tile.garrison.map((s) => s.unit);
    const allCrownUnits = ["levy", "manAtArms", "knight", "ballista"];
    const fresh = allCrownUnits.find((u) => !presentUnits.includes(u));
    expect(fresh).toBeTruthy();
    const s = gameReducer(state, {
      type: "RECRUIT",
      faction: "crown",
      tileId: tile.id,
      unit: fresh,
      count: 1,
      toRetinue: false,
    });
    const newTile = s.map.tiles.find((t) => t.id === tile.id);
    const stack = newTile.garrison.find((st) => st.unit === fresh);
    expect(stack).toBeTruthy();
    expect(stack.count).toBe(1);
  });

  it("to retinue: skips tile mutation, hits hero.retinue", () => {
    const startRetinue = state.players.crown.hero.retinue;
    const startTilesRef = state.map.tiles;
    const s = gameReducer(state, {
      type: "RECRUIT",
      faction: "crown",
      unit: "levy",
      count: 3,
      toRetinue: true,
    });
    // map.tiles untouched
    expect(s.map.tiles).toBe(startTilesRef);
    const ret = s.players.crown.hero.retinue;
    // Retinue grew by either +3 to existing stack or a new entry.
    const totalBefore = startRetinue.reduce((a, r) => a + (r.unit === "levy" ? r.count : 0), 0);
    const totalAfter = ret.reduce((a, r) => a + (r.unit === "levy" ? r.count : 0), 0);
    expect(totalAfter).toBe(totalBefore + 3);
  });

  it("insufficient gold: returns state unchanged", () => {
    // Drain crown gold by simulating SPEND_GOLD to zero.
    const drained = {
      ...state,
      players: {
        ...state.players,
        crown: { ...state.players.crown, gold: 1 },
      },
    };
    const s = gameReducer(drained, {
      type: "RECRUIT",
      faction: "crown",
      unit: "knight",
      count: 1,
      toRetinue: true,
    });
    expect(s).toBe(drained);
  });
});

describe("BUY_ITEM", () => {
  it("weapon goes into equipment.weapon slot", () => {
    const startGold = state.players.crown.gold;
    const s = gameReducer(state, { type: "BUY_ITEM", faction: "crown", itemId: "longsword" });
    expect(s.players.crown.gold).toBe(startGold - ITEMS.longsword.cost);
    expect(s.players.crown.hero.equipment.weapon).toBe("longsword");
  });

  it("armor goes into equipment.armor slot", () => {
    const s = gameReducer(state, { type: "BUY_ITEM", faction: "crown", itemId: "mail" });
    expect(s.players.crown.hero.equipment.armor).toBe("mail");
  });

  it("consumable is appended to consumables list", () => {
    const before = state.players.crown.hero.consumables.length;
    const s = gameReducer(state, { type: "BUY_ITEM", faction: "crown", itemId: "potionMana" });
    expect(s.players.crown.hero.consumables.length).toBe(before + 1);
    expect(s.players.crown.hero.consumables[s.players.crown.hero.consumables.length - 1]).toBe("potionMana");
  });

  it("insufficient gold: state unchanged", () => {
    const drained = {
      ...state,
      players: {
        ...state.players,
        crown: { ...state.players.crown, gold: 0 },
      },
    };
    const s = gameReducer(drained, { type: "BUY_ITEM", faction: "crown", itemId: "longsword" });
    expect(s).toBe(drained);
  });
});

describe("EQUIP", () => {
  it("changes equipment slot", () => {
    const s = gameReducer(state, {
      type: "EQUIP",
      faction: "crown",
      slot: "weapon",
      itemId: "warhammer",
    });
    expect(s.players.crown.hero.equipment.weapon).toBe("warhammer");
  });
});

describe("TAKE_PERK", () => {
  it("adds perk", () => {
    const s = gameReducer(state, { type: "TAKE_PERK", faction: "crown", perkId: "perk_strike" });
    expect(s.players.crown.hero.perks).toContain("perk_strike");
  });

  it("idempotent for already-owned", () => {
    const once = gameReducer(state, { type: "TAKE_PERK", faction: "crown", perkId: "perk_strike" });
    const twice = gameReducer(once, { type: "TAKE_PERK", faction: "crown", perkId: "perk_strike" });
    expect(twice).toBe(once);
    expect(twice.players.crown.hero.perks.filter((p) => p === "perk_strike").length).toBe(1);
  });
});

describe("ADD_XP", () => {
  it("levels up when crossing threshold", () => {
    const need = heroXpForLevel(2);
    const heroBefore = state.players.crown.hero;
    const def = HEROES[heroBefore.id];
    const s = gameReducer(state, { type: "ADD_XP", faction: "crown", amount: need });
    const heroAfter = s.players.crown.hero;
    expect(heroAfter.lvl).toBe(2);
    expect(heroAfter.maxHp).toBe(heroBefore.maxHp + def.perRank.hp);
    expect(heroAfter.hp).toBe(heroAfter.maxHp);
    expect(heroAfter.maxMp).toBe(heroBefore.maxMp + def.perRank.mp);
  });

  it("does not level up below threshold", () => {
    const s = gameReducer(state, { type: "ADD_XP", faction: "crown", amount: 1 });
    expect(s.players.crown.hero.lvl).toBe(1);
    expect(s.players.crown.hero.xp).toBe(1);
  });
});

describe("RESOLVE_BATTLE", () => {
  it("winner=attacker: tile flips owner, garrison set to half of survivors", () => {
    const enemyTile = state.map.tiles.find(
      (t) => t.owner && t.owner !== "crown" && (t.garrison || []).length > 0,
    );
    expect(enemyTile).toBeTruthy();

    // Crown's retinue stack 0 has count 4 of fac.units[0] (levy). Use 4 survivors → garrison count 2.
    const crownHero = state.players.crown.hero;
    const survivorUnit = crownHero.retinue[0].unit;
    const action = {
      type: "RESOLVE_BATTLE",
      tileId: enemyTile.id,
      attacker: "crown",
      defender: enemyTile.owner,
      result: {
        winner: "attacker",
        attackerLosses: [],
        defenderLosses: enemyTile.garrison.map((g) => ({ unit: g.unit, count: g.count })),
        xp: 30,
      },
    };
    const s = gameReducer(state, action);
    const newTile = s.map.tiles.find((t) => t.id === enemyTile.id);
    expect(newTile.owner).toBe("crown");
    expect(newTile.garrison.length).toBe(1);
    expect(newTile.garrison[0].unit).toBe(survivorUnit);
    expect(newTile.garrison[0].count).toBe(Math.max(1, Math.floor(crownHero.retinue[0].count / 2)));
    expect(s.screen).toBe("summary");
    expect(s.pendingSummary.tileId).toBe(enemyTile.id);
  });

  it("winner=defender: tile keeps owner, attacker takes losses", () => {
    const enemyTile = state.map.tiles.find(
      (t) => t.owner && t.owner !== "crown" && (t.garrison || []).length > 0,
    );
    const heroBefore = state.players.crown.hero;
    const startRetinue0 = heroBefore.retinue[0];
    const action = {
      type: "RESOLVE_BATTLE",
      tileId: enemyTile.id,
      attacker: "crown",
      defender: enemyTile.owner,
      result: {
        winner: "defender",
        attackerLosses: [{ unit: startRetinue0.unit, count: 1 }],
        defenderLosses: [],
        xp: 10,
      },
    };
    const s = gameReducer(state, action);
    const newTile = s.map.tiles.find((t) => t.id === enemyTile.id);
    expect(newTile.owner).toBe(enemyTile.owner);
    const newRet0 = s.players.crown.hero.retinue.find((r) => r.unit === startRetinue0.unit);
    expect(newRet0.count).toBe(startRetinue0.count - 1);
  });
});

describe("END_ROUND", () => {
  it("increments round and applies income/upkeep, clamped to 0", () => {
    // To avoid the AI loop using Math.random, mark all AI factions as defeated
    // for crown's turn — END_ROUND skips defeated players for the AI loop too.
    const stripped = {
      ...state,
      players: {
        ...state.players,
        tide:  { ...state.players.tide,  defeated: true },
        ash:   { ...state.players.ash,   defeated: true },
        thorn: { ...state.players.thorn, defeated: true },
      },
    };
    const startGold = stripped.players.crown.gold;
    const inc = Economy.computeIncome(stripped, "crown");
    const upk = Economy.computeUpkeep(stripped, "crown");
    const expected = Math.max(0, startGold + inc - upk);
    const s = gameReducer(stripped, { type: "END_ROUND" });
    expect(s.round).toBe(stripped.round + 1);
    expect(s.players.crown.gold).toBe(expected);
    // Defeated players are not updated.
    expect(s.players.tide.gold).toBe(stripped.players.tide.gold);
  });

  it("clamps gold to 0 when upkeep exceeds gold + income", () => {
    // Build a stripped state with tons of upkeep (huge garrison) and 1 gold.
    const tilesWithFat = state.map.tiles.map((t, i) =>
      i === 0 ? { ...t, owner: "crown", garrison: [{ unit: "knight", count: 999 }] } : t,
    );
    const stripped = {
      ...state,
      map: { ...state.map, tiles: tilesWithFat },
      players: {
        ...state.players,
        crown: { ...state.players.crown, gold: 1 },
        tide:  { ...state.players.tide,  defeated: true },
        ash:   { ...state.players.ash,   defeated: true },
        thorn: { ...state.players.thorn, defeated: true },
      },
    };
    const s = gameReducer(stripped, { type: "END_ROUND" });
    expect(s.players.crown.gold).toBe(0);
  });
});

describe("DISMISS_SUMMARY", () => {
  it("clears pendingSummary and returns to map", () => {
    const dirty = { ...state, screen: "summary", pendingSummary: { winner: "attacker" } };
    const s = gameReducer(dirty, { type: "DISMISS_SUMMARY" });
    expect(s.screen).toBe("map");
    expect(s.pendingSummary).toBeNull();
  });
});
