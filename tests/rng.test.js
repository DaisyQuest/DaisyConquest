import { describe, it, expect } from "vitest";
import { makeRNG, pickWeighted } from "../src/core/rng.js";

describe("makeRNG", () => {
  it("produces the same sequence for the same seed", () => {
    const a = makeRNG(12345);
    const b = makeRNG(12345);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = makeRNG(1);
    const b = makeRNG(2);
    const seqA = [a(), a(), a(), a(), a()];
    const seqB = [b(), b(), b(), b(), b()];
    expect(seqA).not.toEqual(seqB);
  });

  it("output is in range [0, 1)", () => {
    const r = makeRNG(99);
    for (let i = 0; i < 200; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("pickWeighted", () => {
  it("respects weights — high-tail RNG picks the heavy option", () => {
    // weights [1, 1, 998] total 1000. rng() returning 0.999 → r = 999.
    // first option subtracts 1 → r=998, not <=0.
    // second option subtracts 1 → r=997, not <=0.
    // third option subtracts 998 → r=-1, <=0 → picked.
    const fakeRng = () => 0.999;
    const options = [
      { id: "a", weight: 1 },
      { id: "b", weight: 1 },
      { id: "c", weight: 998 },
    ];
    expect(pickWeighted(fakeRng, options).id).toBe("c");
  });

  it("low-tail RNG picks the first option", () => {
    const fakeRng = () => 0; // r = 0; first iteration: r -= 1 → -1, picked.
    const options = [
      { id: "a", weight: 1 },
      { id: "b", weight: 1 },
      { id: "c", weight: 998 },
    ];
    expect(pickWeighted(fakeRng, options).id).toBe("a");
  });
});
