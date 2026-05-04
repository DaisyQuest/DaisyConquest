/* Mulberry32 seeded PRNG. makeRNG(seed) returns () => float in [0, 1). */

export function makeRNG(seed) {
  let s = (seed >>> 0) || 1;
  return function rng() {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickWeighted(rng, options) {
  const total = options.reduce((sum, o) => sum + (o.weight || 1), 0);
  let r = rng() * total;
  for (const o of options) {
    r -= o.weight || 1;
    if (r <= 0) return o;
  }
  return options[options.length - 1];
}
