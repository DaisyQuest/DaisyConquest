import { describe, it, expect, beforeEach } from "vitest";
import { SaveSystem } from "../src/core/save.js";
import { CONST } from "../src/core/constants.js";

// In-memory localStorage shim. Vitest's default node env has no localStorage.
function makeLocalStorageShim() {
  const store = new Map();
  return {
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
    _store: store,
  };
}

beforeEach(() => {
  globalThis.localStorage = makeLocalStorageShim();
});

describe("SaveSystem", () => {
  it("save/load roundtrip preserves state shape", () => {
    const state = {
      round: 3,
      players: { crown: { gold: 42, hero: { lvl: 2 } } },
      map: { tiles: [{ id: "0,0", owner: "crown" }], cols: 8, rows: 6, seed: 1 },
      log: [{ round: 1, text: "hello" }],
    };
    expect(SaveSystem.save(state)).toBe(true);
    const loaded = SaveSystem.load();
    expect(loaded).toEqual(state);
  });

  it("load returns null when key absent", () => {
    expect(SaveSystem.load()).toBeNull();
  });

  it("load returns null when version mismatches", () => {
    localStorage.setItem(
      CONST.SAVE_KEY,
      JSON.stringify({ v: 99, t: 0, state: { round: 5 } }),
    );
    expect(SaveSystem.load()).toBeNull();
  });

  it("load returns null on malformed JSON", () => {
    localStorage.setItem(CONST.SAVE_KEY, "{not json");
    expect(SaveSystem.load()).toBeNull();
  });

  it("clear removes the key", () => {
    SaveSystem.save({ round: 1 });
    expect(localStorage.getItem(CONST.SAVE_KEY)).not.toBeNull();
    SaveSystem.clear();
    expect(localStorage.getItem(CONST.SAVE_KEY)).toBeNull();
  });
});
