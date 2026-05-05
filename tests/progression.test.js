/* tests/progression.test.js — Fire Emblem-style stack progression.
 *
 * Three invariants:
 *   1. RECRUIT into an existing archetype merges count, preserves lvl/xp.
 *   2. RESOLVE_BATTLE pools result.xp across surviving stacks, levels up,
 *      clamps at STACK_LEVEL_CAP.
 *   3. PROMOTE_STACK: validates at-cap + branch + gold; swaps unit, resets
 *      lvl, deducts gold; idempotently rejects bad inputs. */

import { describe, it, expect } from "vitest";
import { gameReducer, makeInitialState } from "../src/core/store.jsx";
import { STACK_LEVEL_CAP, xpForStackLevel, promotionCost } from "../src/data/units.js";

const newGame = (opts = {}) => makeInitialState({ seed: opts.seed ?? 1, human: "crown" });

// ─── 1. RECRUIT merge invariant ─────────────────────────────────────

describe("RECRUIT merge preserves veteran level", () => {
  it("merging into an existing stack of the same archetype keeps lvl/xp", () => {
    let s = newGame();
    // Hand-elevate the starting levy stack to L3 with some xp banked.
    s = {
      ...s,
      players: {
        ...s.players,
        crown: {
          ...s.players.crown,
          gold: 999,
          hero: {
            ...s.players.crown.hero,
            retinue: [{ unit: "levy", count: 4, lvl: 3, xp: 7 }],
          },
        },
      },
    };
    const after = gameReducer(s, {
      type: "RECRUIT", faction: "crown", unit: "levy", count: 5, toRetinue: true,
    });
    expect(after.players.crown.hero.retinue).toHaveLength(1);
    const merged = after.players.crown.hero.retinue[0];
    expect(merged.unit).toBe("levy");
    expect(merged.count).toBe(9);
    expect(merged.lvl).toBe(3);   // veteran level kept
    expect(merged.xp).toBe(7);    // xp progress preserved
  });

  it("a brand-new archetype gets lvl:1 xp:0 stamped on the new stack", () => {
    let s = newGame();
    s = {
      ...s,
      players: { ...s.players, crown: { ...s.players.crown, gold: 999 } },
    };
    // knight isn't in crown's starting retinue, so this exercises the
    // "push a new stack" branch rather than the merge branch.
    const after = gameReducer(s, {
      type: "RECRUIT", faction: "crown", unit: "knight", count: 2, toRetinue: true,
    });
    const fresh = after.players.crown.hero.retinue.find((r) => r.unit === "knight");
    expect(fresh).toMatchObject({ unit: "knight", count: 2, lvl: 1, xp: 0 });
  });
});

// ─── 2. Battle XP distribution + cap ─────────────────────────────────

describe("RESOLVE_BATTLE distributes XP and caps at STACK_LEVEL_CAP", () => {
  it("splits result.xp across surviving stacks and levels up over the curve", () => {
    let s = newGame();
    // Two stacks of two archetypes; both survive (no losses).
    s = {
      ...s,
      players: {
        ...s.players,
        crown: {
          ...s.players.crown,
          hero: {
            ...s.players.crown.hero,
            retinue: [
              { unit: "levy", count: 4, lvl: 1, xp: 0 },
              { unit: "manAtArms", count: 2, lvl: 1, xp: 0 },
            ],
          },
        },
      },
    };
    const battleTile = s.map.tiles.find((t) => t.terrain !== "sea" && !t.owner);
    // Pool sized to land each stack at L2 with overflow we can reason about
    // straight from the curve constant (curve-agnostic test).
    const perStack = xpForStackLevel(2) + 7; // surplus 7
    const pool = perStack * 2;
    const after = gameReducer(s, {
      type: "RESOLVE_BATTLE",
      tileId: battleTile.id,
      attacker: "crown",
      defender: "tide",
      result: {
        winner: "attacker",
        attackerLosses: [],
        defenderLosses: [],
        xp: pool,
        duration: 3.5,
      },
    });
    const r = after.players.crown.hero.retinue;
    for (const stack of r) {
      expect(stack.lvl).toBe(2);
      expect(stack.xp).toBe(7);
    }
  });

  it("clamps stacks at STACK_LEVEL_CAP and discards surplus XP", () => {
    let s = newGame();
    s = {
      ...s,
      players: {
        ...s.players,
        crown: {
          ...s.players.crown,
          hero: {
            ...s.players.crown.hero,
            retinue: [{ unit: "levy", count: 4, lvl: STACK_LEVEL_CAP, xp: 999 }],
          },
        },
      },
    };
    const battleTile = s.map.tiles.find((t) => t.terrain !== "sea" && !t.owner);
    const after = gameReducer(s, {
      type: "RESOLVE_BATTLE",
      tileId: battleTile.id,
      attacker: "crown",
      defender: "tide",
      result: { winner: "attacker", attackerLosses: [], defenderLosses: [], xp: 100, duration: 1 },
    });
    const stack = after.players.crown.hero.retinue[0];
    expect(stack.lvl).toBe(STACK_LEVEL_CAP);
    expect(stack.xp).toBe(0); // surplus discarded
  });

  it("dead stacks (count → 0) drop out of XP distribution entirely", () => {
    let s = newGame();
    s = {
      ...s,
      players: {
        ...s.players,
        crown: {
          ...s.players.crown,
          hero: {
            ...s.players.crown.hero,
            retinue: [
              { unit: "levy", count: 4, lvl: 1, xp: 0 },
              { unit: "manAtArms", count: 1, lvl: 1, xp: 0 }, // about to die
            ],
          },
        },
      },
    };
    const battleTile = s.map.tiles.find((t) => t.terrain !== "sea" && !t.owner);
    // Send 100 xp; survivor takes the entire pool (manAtArms wiped first).
    const after = gameReducer(s, {
      type: "RESOLVE_BATTLE",
      tileId: battleTile.id,
      attacker: "crown",
      defender: "tide",
      result: {
        winner: "attacker",
        attackerLosses: [{ unit: "manAtArms", count: 1 }], // wipes the manAtArms stack
        defenderLosses: [],
        xp: 100,
        duration: 1,
      },
    });
    const r = after.players.crown.hero.retinue;
    expect(r).toHaveLength(1);
    expect(r[0].unit).toBe("levy");
    // 100 XP applied via the actual curve: figure out lvl/xp by walking it.
    let lvl = 1;
    let xp = 100;
    while (lvl < 5 && xp >= xpForStackLevel(lvl + 1)) {
      xp -= xpForStackLevel(lvl + 1);
      lvl += 1;
    }
    expect(r[0].lvl).toBe(lvl);
    expect(r[0].xp).toBe(xp);
    // Sanity: did level up at least once
    expect(r[0].lvl).toBeGreaterThan(1);
  });
});

// ─── 3. PROMOTE_STACK validation + execution ────────────────────────

describe("PROMOTE_STACK", () => {
  const seed = (override) => {
    const s = newGame();
    return {
      ...s,
      players: {
        ...s.players,
        crown: {
          ...s.players.crown,
          gold: 9999,
          hero: {
            ...s.players.crown.hero,
            retinue: [{ unit: "levy", count: 3, lvl: STACK_LEVEL_CAP, xp: 0 }],
          },
          ...override,
        },
      },
    };
  };

  it("swaps unit id, resets lvl to 1, charges gold, when at cap and branch valid", () => {
    const s = seed();
    const before = s.players.crown.gold;
    const cost = promotionCost(3);
    const after = gameReducer(s, {
      type: "PROMOTE_STACK", faction: "crown", stackIndex: 0, toUnit: "manAtArms",
    });
    const stack = after.players.crown.hero.retinue[0];
    expect(stack.unit).toBe("manAtArms");
    expect(stack.lvl).toBe(1);
    expect(stack.xp).toBe(0);
    expect(stack.count).toBe(3);
    expect(after.players.crown.gold).toBe(before - cost);
  });

  it("rejects below cap", () => {
    let s = seed();
    s = {
      ...s,
      players: {
        ...s.players,
        crown: {
          ...s.players.crown,
          hero: {
            ...s.players.crown.hero,
            retinue: [{ unit: "levy", count: 3, lvl: 2, xp: 0 }],
          },
        },
      },
    };
    const after = gameReducer(s, {
      type: "PROMOTE_STACK", faction: "crown", stackIndex: 0, toUnit: "manAtArms",
    });
    expect(after).toBe(s);
  });

  it("rejects an invalid branch", () => {
    const s = seed();
    const after = gameReducer(s, {
      type: "PROMOTE_STACK", faction: "crown", stackIndex: 0, toUnit: "knight", // levy → knight skips a tier
    });
    expect(after).toBe(s);
  });

  it("rejects when the player can't afford the cost", () => {
    let s = seed();
    s = { ...s, players: { ...s.players, crown: { ...s.players.crown, gold: 1 } } };
    const after = gameReducer(s, {
      type: "PROMOTE_STACK", faction: "crown", stackIndex: 0, toUnit: "manAtArms",
    });
    expect(after).toBe(s);
  });

  it("merges into an existing stack of the target archetype, preserving the merge invariant", () => {
    let s = seed();
    s = {
      ...s,
      players: {
        ...s.players,
        crown: {
          ...s.players.crown,
          hero: {
            ...s.players.crown.hero,
            retinue: [
              { unit: "levy", count: 3, lvl: STACK_LEVEL_CAP, xp: 0 },
              { unit: "manAtArms", count: 2, lvl: 2, xp: 8 }, // existing
            ],
          },
        },
      },
    };
    const after = gameReducer(s, {
      type: "PROMOTE_STACK", faction: "crown", stackIndex: 0, toUnit: "manAtArms",
    });
    expect(after.players.crown.hero.retinue).toHaveLength(1);
    const merged = after.players.crown.hero.retinue[0];
    expect(merged.unit).toBe("manAtArms");
    expect(merged.count).toBe(5);   // 3 promoted + 2 existing
    expect(merged.lvl).toBe(2);     // existing stack's veteran level kept
    expect(merged.xp).toBe(8);
  });

  it("offers branched promotion at T2 (manAtArms → knight or paladin)", () => {
    let s = newGame();
    s = {
      ...s,
      players: {
        ...s.players,
        crown: {
          ...s.players.crown,
          gold: 9999,
          hero: {
            ...s.players.crown.hero,
            retinue: [{ unit: "manAtArms", count: 2, lvl: STACK_LEVEL_CAP, xp: 0 }],
          },
        },
      },
    };
    const knight = gameReducer(s, {
      type: "PROMOTE_STACK", faction: "crown", stackIndex: 0, toUnit: "knight",
    });
    expect(knight.players.crown.hero.retinue[0].unit).toBe("knight");

    const paladin = gameReducer(s, {
      type: "PROMOTE_STACK", faction: "crown", stackIndex: 0, toUnit: "paladin",
    });
    expect(paladin.players.crown.hero.retinue[0].unit).toBe("paladin");
  });
});
