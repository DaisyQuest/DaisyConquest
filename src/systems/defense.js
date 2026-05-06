/* Defense — wave-based defense minigame.
   Player places defenders at fixed slots adjacent to a winding path;
   enemies walk in waves toward the gate. Used when an enemy attacks a
   player territory.

   Tower-defense feel: each placed defender behaves like a turret using
   its unit-data atk/def/range/spd. Range gates how far down the path it
   can reach — melee (range 1) only hits enemies stepping past its slot,
   archers (range 3) cover a wide arc, siege (range 4+) blanket the
   battlefield. Retinue level scales hp/atk/def +10% per level above 1
   to match battle.js. */

import { FACTIONS } from "../data/factions.js";
import { UNITS } from "../data/units.js";

/* Path the attackers walk. Coords are 0..100 in both dimensions; the UI
   maps these to viewport percentages. The path zigzags so well-placed
   defenders can hold a chokepoint. */
export const PATH = [
  { x:0, y:50 }, { x:18, y:50 }, { x:32, y:30 }, { x:48, y:30 },
  { x:62, y:60 }, { x:78, y:60 }, { x:92, y:40 }, { x:100, y:40 },
];

/* Defender slot positions, hand-tuned to sit RIGHT NEXT TO the path so a
   range-1 melee unit can actually engage. Previously slots were stacked
   at y=50 ignoring the zigzag — defenders in slots 2/3 effectively did
   nothing because every enemy passed 18+ units away vertically. */
export const SLOT_POSITIONS = [
  { x: 12, y: 50 },  // 0 — first stretch, on the path
  { x: 25, y: 40 },  // 1 — diagonal ramp up
  { x: 40, y: 30 },  // 2 — top plateau
  { x: 55, y: 45 },  // 3 — diagonal ramp down (covers crossover)
  { x: 70, y: 60 },  // 4 — bottom plateau
  { x: 85, y: 50 },  // 5 — final stretch, last line of defense
];

export function pathPosAt(prog) {
  if (prog <= 0) return PATH[0];
  if (prog >= 1) return PATH[PATH.length - 1];
  const segs = [];
  let total = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const dx = PATH[i + 1].x - PATH[i].x;
    const dy = PATH[i + 1].y - PATH[i].y;
    const d = Math.hypot(dx, dy);
    segs.push({ a: PATH[i], b: PATH[i + 1], d });
    total += d;
  }
  const want = prog * total;
  let acc = 0;
  for (const s of segs) {
    if (acc + s.d >= want) {
      const t = (want - acc) / s.d;
      return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
    }
    acc += s.d;
  }
  return PATH[PATH.length - 1];
}

/* Range scale: a unit with range=1 should have a meaningful but not
   game-breaking radius. range=3 archer covers about a third of the map.
   This number is also used by Defense.jsx to draw range circles. */
export const RANGE_SCALE = 14;

/* Refund fraction when player removes a placed defender mid-battle.
   The unit goes back into the deployable pool so they can be re-placed
   elsewhere — costs nothing, just one decision per move. */

export const Defense = {
  PATH, pathPosAt, SLOT_POSITIONS, RANGE_SCALE,

  init({ defenderRetinue, attackerFaction, defenderPerks = [], waves = 3 }) {
    const enemyFac = FACTIONS[attackerFaction];
    const waveList = [];
    for (let w = 0; w < waves; w++) {
      const tier = Math.min(3, w + 1);
      const unitId = enemyFac.units[Math.min(enemyFac.units.length - 1, tier - 1)];
      // Slightly fewer enemies per wave so the encounter is winnable with
      // a sensibly-placed garrison.
      const count = 3 + w * 2;
      waveList.push({ unitId, count, spawned: 0, spawnTimer: 0.5 });
    }
    return {
      time: 0,
      waveIdx: 0,
      waves: waveList,
      attackers: [],
      defenders: [],
      // Retinue is preserved with full stack data (lvl, xp, lane). place()
      // pops `count` and stamps `lvl` onto the placed defender so retinue
      // progression feeds tower power.
      availableDefenders: defenderRetinue.map((s) => ({ ...s })),
      defenderPerks,
      baseHp: 150,
      maxBaseHp: 150,
      gold: 30,
      ended: false,
      won: null,
      floats: [],
      // Projectile / swing visuals — a short-lived list of in-flight shots.
      // Each entry is { fromX, fromY, toX, toY, t, life, ranged }. The tick
      // decays `t` toward `life` and the renderer interpolates the head's
      // position. When t >= life the entry is culled.
      shots: [],
      // Wave entrance pulses at the spawn point, also short-lived. Lets
      // the player see "a unit is arriving here" before the icon resolves.
      spawnFlashes: [],
    };
  },

  /* Spawn a defender at a slot. Captures the source stack's level so the
     placed turret scales with promotion. Refuses if the unit is empty. */
  place(ds, slotIdx, unitId) {
    const stack = ds.availableDefenders.find((s) => s.unit === unitId);
    if (!stack || stack.count <= 0) return ds;
    if (slotIdx < 0 || slotIdx >= SLOT_POSITIONS.length) return ds;
    if (ds.defenders.some((d) => d.slotIdx === slotIdx)) return ds;
    stack.count -= 1;
    const u = UNITS[unitId];
    const lvl = stack.lvl ?? 1;
    const m = 1 + Math.max(0, lvl - 1) * 0.10;
    // perk_architect: garrison/defender units gain +1 effective defense
    // when the side's hero has the architect capstone.
    const archBonus = (ds.defenderPerks || []).includes("perk_architect") ? 1 : 0;
    ds.defenders.push({
      uid: "def_" + Math.random().toString(36).slice(2),
      unitId, slotIdx, lvl,
      hp: Math.round(u.hp * m), maxHp: Math.round(u.hp * m),
      atk: Math.round(u.atk * m),
      def: Math.round(u.def * m) + archBonus,
      range: u.range,
      atkCd: 0,
      icon: u.icon, name: u.name,
      traits: u.traits || [],
      role: u.role,
    });
    return ds;
  },

  /* Pull a placed defender back into the available pool. Used when the
     player wants to reposition without paying a fresh recruitment cost.
     Returns the (mutated) ds so the caller can chain. */
  refund(ds, slotIdx) {
    const idx = ds.defenders.findIndex((d) => d.slotIdx === slotIdx);
    if (idx < 0) return ds;
    const def = ds.defenders[idx];
    if (def.hp <= 0) return ds;
    const stack = ds.availableDefenders.find((s) => s.unit === def.unitId);
    if (stack) {
      stack.count += 1;
    } else {
      ds.availableDefenders.push({
        unit: def.unitId, count: 1, lvl: def.lvl ?? 1, xp: 0,
      });
    }
    ds.defenders.splice(idx, 1);
    return ds;
  },

  tick(ds, dt) {
    if (ds.ended) return ds;
    ds.time += dt;

    const wave = ds.waves[ds.waveIdx];
    if (wave) {
      wave.spawnTimer -= dt;
      if (wave.spawnTimer <= 0 && wave.spawned < wave.count) {
        wave.spawned++;
        // Slower spawn cadence — gives defenders time to fire between
        // arrivals so they don't get swarmed mid-cooldown.
        wave.spawnTimer = 1.4;
        const u = UNITS[wave.unitId];
        const spawnPos = pathPosAt(0);
        ds.attackers.push({
          uid: "atk_" + Math.random().toString(36).slice(2),
          unitId: wave.unitId,
          prog: 0,
          hp: u.hp, maxHp: u.hp,
          atk: u.atk, def: u.def, spd: u.spd,
          atkCd: 0, icon: u.icon, name: u.name,
          traits: u.traits || [],
        });
        ds.spawnFlashes = ds.spawnFlashes || [];
        ds.spawnFlashes.push({
          id: "sf_" + Math.random().toString(36).slice(2),
          x: spawnPos.x, y: spawnPos.y, t: 0, life: 0.6,
        });
      }
      if (wave.spawned >= wave.count && ds.attackers.length === 0) {
        ds.waveIdx++;
      }
    } else if (ds.attackers.length === 0) {
      ds.ended = true;
      ds.won = true;
    }

    for (const a of ds.attackers) {
      if (a.hp <= 0) continue;
      // Slower march — was 0.04, now 0.025. Combined with slower spawns,
      // gives defenders meaningfully more shots per attacker.
      a.prog += a.spd * 0.025 * dt;
      if (a.prog >= 1) {
        ds.baseHp -= 6;
        a.hp = 0;
      }
    }

    for (const d of ds.defenders) {
      if (d.hp <= 0) continue;
      d.atkCd = Math.max(0, d.atkCd - dt);
      const slotPos = SLOT_POSITIONS[d.slotIdx];
      let best = null;
      let bestDist = Infinity;
      for (const a of ds.attackers) {
        if (a.hp <= 0) continue;
        const pos = pathPosAt(a.prog);
        const dist = Math.hypot(pos.x - slotPos.x, pos.y - slotPos.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = a;
        }
      }
      const reach = d.range * RANGE_SCALE;
      if (best && bestDist <= reach && d.atkCd <= 0) {
        // Damage formula tuned up: defenders are static turrets — they
        // need to feel meaningful. Bonus +1 per level (was nothing).
        let dmg = Math.max(2, Math.round(d.atk * 1.4 - best.def * 0.4));
        if ((d.traits || []).includes("pierce")) dmg = Math.round(dmg * 1.5);
        if ((d.traits || []).includes("siege") && best.maxHp >= 50) {
          dmg = Math.round(dmg * 1.25);
        }
        best.hp -= dmg;
        // Faster cooldown — was 1.0s, now 0.6s. Still slower than the
        // open-field battle 0.5 so the minigame stays distinct.
        d.atkCd = 0.6;
        const targetPos = pathPosAt(best.prog);
        // Projectile / swing visual. Ranged units get a flying bolt, melee
        // get a quick swing slash (rendered the same way but with a tag
        // the UI uses to switch styling).
        ds.shots.push({
          id: "sh_" + Math.random().toString(36).slice(2),
          fromX: slotPos.x, fromY: slotPos.y,
          toX: targetPos.x, toY: targetPos.y,
          t: 0, life: d.range >= 2 ? 0.28 : 0.18,
          ranged: d.range >= 2,
          crit: dmg > best.maxHp * 0.3,
        });
        ds.floats.push({
          id: Math.random().toString(36).slice(2),
          x: targetPos.x, y: targetPos.y,
          text: `-${Math.round(dmg)}`,
          kind: "hit",
          t: 0,
        });
      }
    }

    for (const a of ds.attackers) {
      if (a.hp <= 0) continue;
      a.atkCd = Math.max(0, a.atkCd - dt);
      const aPos = pathPosAt(a.prog);
      for (const d of ds.defenders) {
        if (d.hp <= 0) continue;
        const slotPos = SLOT_POSITIONS[d.slotIdx];
        const dist = Math.hypot(slotPos.x - aPos.x, slotPos.y - aPos.y);
        // Attackers can only retaliate when they walk into melee range
        // of a slot — they can't shoot down archers from a distance.
        if (dist < 8 && a.atkCd <= 0) {
          const dmg = Math.max(1, Math.round(a.atk - d.def * 0.5));
          d.hp -= dmg;
          a.atkCd = 1.0;
          ds.floats.push({
            id: Math.random().toString(36).slice(2),
            x: slotPos.x,
            y: slotPos.y,
            text: `-${dmg}`,
            kind: "ouch",
            t: 0,
          });
        }
      }
    }

    ds.attackers = ds.attackers.filter((a) => a.hp > 0);
    ds.defenders = ds.defenders.filter((d) => d.hp > 0);
    ds.floats = ds.floats.map((f) => ({ ...f, t: f.t + dt })).filter((f) => f.t < 0.6);
    ds.shots = (ds.shots || [])
      .map((s) => ({ ...s, t: s.t + dt }))
      .filter((s) => s.t < s.life);
    ds.spawnFlashes = (ds.spawnFlashes || [])
      .map((s) => ({ ...s, t: s.t + dt }))
      .filter((s) => s.t < s.life);

    if (ds.baseHp <= 0) {
      ds.ended = true;
      ds.won = false;
    }
    return ds;
  },
};
