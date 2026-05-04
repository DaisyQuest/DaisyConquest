import { describe, it, expect } from "vitest";
import { Economy } from "../src/core/economy.js";
import { CONST } from "../src/core/constants.js";
import { UNITS } from "../src/data/units.js";
import { TOWN_TYPES } from "../src/data/map.js";

// Build a minimal state shape that Economy reads. Economy only touches
// state.map.tiles and state.players[fid].hero.
function makeState({ tiles = [], hero = null } = {}) {
  return {
    map: { tiles },
    players: {
      crown: { hero: hero || { perks: [], retinue: [] } },
    },
  };
}

describe("Economy.computeIncome", () => {
  it("sums tile gold + town goldBonus + ROUND_INCOME_BASE", () => {
    const tiles = [
      { id: "a", owner: "crown", gold: 5, town: null },
      { id: "b", owner: "crown", gold: 3, town: "city" }, // +2
      { id: "c", owner: "crown", gold: 7, town: "town" }, // +1
      { id: "d", owner: "tide",  gold: 9, town: null }, // ignored
    ];
    const state = makeState({ tiles });
    const expected = CONST.ROUND_INCOME_BASE + 5 + 3 + TOWN_TYPES.city.goldBonus + 7 + TOWN_TYPES.town.goldBonus;
    expect(Economy.computeIncome(state, "crown")).toBe(expected);
  });

  it("returns just ROUND_INCOME_BASE when no tiles owned", () => {
    const state = makeState({ tiles: [{ id: "x", owner: "tide", gold: 5, town: null }] });
    expect(Economy.computeIncome(state, "crown")).toBe(CONST.ROUND_INCOME_BASE);
  });

  it("applies perk_treasury (×1.25, floored)", () => {
    const tiles = [
      { id: "a", owner: "crown", gold: 5, town: null },
      { id: "b", owner: "crown", gold: 3, town: null },
    ];
    const state = makeState({
      tiles,
      hero: { perks: ["perk_treasury"], retinue: [] },
    });
    const base = CONST.ROUND_INCOME_BASE + 5 + 3;
    expect(Economy.computeIncome(state, "crown")).toBe(Math.floor(base * 1.25));
  });
});

describe("Economy.computeUpkeep", () => {
  it("sums garrison upkeep across owned tiles", () => {
    const tiles = [
      { id: "a", owner: "crown", garrison: [{ unit: "levy", count: 3 }] }, // 3 * 1
      { id: "b", owner: "crown", garrison: [{ unit: "manAtArms", count: 2 }] }, // 2 * 3
      { id: "c", owner: "tide",  garrison: [{ unit: "levy", count: 99 }] }, // ignored
    ];
    const state = makeState({ tiles });
    const expected = 3 * UNITS.levy.upkeep + 2 * UNITS.manAtArms.upkeep;
    expect(Economy.computeUpkeep(state, "crown")).toBe(expected);
  });

  it("includes hero retinue upkeep", () => {
    const tiles = [
      { id: "a", owner: "crown", garrison: [{ unit: "levy", count: 2 }] },
    ];
    const hero = {
      perks: [],
      retinue: [
        { unit: "knight", count: 1 },
        { unit: "manAtArms", count: 2 },
      ],
    };
    const state = makeState({ tiles, hero });
    const expected =
      2 * UNITS.levy.upkeep +
      1 * UNITS.knight.upkeep +
      2 * UNITS.manAtArms.upkeep;
    expect(Economy.computeUpkeep(state, "crown")).toBe(expected);
  });
});

describe("Economy.troopCost", () => {
  it("multiplies unit cost by count", () => {
    expect(Economy.troopCost("levy", 3, null)).toBe(UNITS.levy.cost * 3);
  });

  it("applies perk_quartermaster (×0.9, floored)", () => {
    const hero = { perks: ["perk_quartermaster"] };
    const raw = UNITS.knight.cost * 2;
    expect(Economy.troopCost("knight", 2, hero)).toBe(Math.floor(raw * 0.9));
  });

  it("returns 0 for unknown unit", () => {
    expect(Economy.troopCost("nonexistent_unit", 5, null)).toBe(0);
  });
});
