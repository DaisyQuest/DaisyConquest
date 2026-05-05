/* Defense — wave-based defense minigame.
   Player places defenders along a fixed path; enemies walk in waves.
   Used when an enemy attacks a player territory. */

import { FACTIONS } from "../data/factions.js";
import { UNITS } from "../data/units.js";

export const PATH = [
  { x:0, y:50 }, { x:18, y:50 }, { x:32, y:30 }, { x:48, y:30 },
  { x:62, y:60 }, { x:78, y:60 }, { x:92, y:40 }, { x:100, y:40 },
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

export const Defense = {
  PATH, pathPosAt,

  init({ defenderRetinue, attackerFaction, defenderPerks = [], waves = 3 }) {
    const enemyFac = FACTIONS[attackerFaction];
    const waveList = [];
    for (let w = 0; w < waves; w++) {
      const tier = Math.min(3, w + 1);
      const unitId = enemyFac.units[Math.min(enemyFac.units.length - 1, tier - 1)];
      const count = 4 + w * 2;
      waveList.push({ unitId, count, spawned: 0, spawnTimer: 0 });
    }
    return {
      time: 0,
      waveIdx: 0,
      waves: waveList,
      attackers: [],
      defenders: [],
      availableDefenders: defenderRetinue.map((s) => ({ ...s })),
      defenderPerks,
      baseHp: 100,
      gold: 30,
      ended: false,
      won: null,
      floats: [],
    };
  },

  place(ds, slotIdx, unitId) {
    const stack = ds.availableDefenders.find((s) => s.unit === unitId);
    if (!stack || stack.count <= 0) return ds;
    stack.count -= 1;
    const u = UNITS[unitId];
    // perk_architect: garrison/defender units gain +1 effective defense
    // when the side's hero has the architect capstone.
    const archBonus = (ds.defenderPerks || []).includes("perk_architect") ? 1 : 0;
    ds.defenders.push({
      uid: "def_" + Math.random().toString(36).slice(2),
      unitId, slotIdx, hp: u.hp, maxHp: u.hp,
      atk: u.atk, def: u.def + archBonus, range: u.range,
      atkCd: 0, icon: u.icon, name: u.name,
    });
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
        wave.spawnTimer = 0.7;
        const u = UNITS[wave.unitId];
        ds.attackers.push({
          uid: "atk_" + Math.random().toString(36).slice(2),
          unitId: wave.unitId,
          prog: 0,
          hp: u.hp, maxHp: u.hp,
          atk: u.atk, def: u.def, spd: u.spd,
          atkCd: 0, icon: u.icon, name: u.name,
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
      a.prog += a.spd * 0.04 * dt;
      if (a.prog >= 1) {
        ds.baseHp -= 8;
        a.hp = 0;
      }
    }

    for (const d of ds.defenders) {
      if (d.hp <= 0) continue;
      d.atkCd = Math.max(0, d.atkCd - dt);
      const slotX = 12 + d.slotIdx * 18;
      let best = null;
      let bestDist = 999;
      for (const a of ds.attackers) {
        if (a.hp <= 0) continue;
        const pos = pathPosAt(a.prog);
        const dist = Math.hypot(pos.x - slotX, pos.y - 50);
        if (dist < bestDist) {
          bestDist = dist;
          best = a;
        }
      }
      if (best && bestDist <= d.range * 12 && d.atkCd <= 0) {
        const dmg = Math.max(1, d.atk - best.def * 0.5);
        best.hp -= dmg;
        d.atkCd = 1.0;
        ds.floats.push({
          id: Math.random().toString(36).slice(2),
          x: pathPosAt(best.prog).x,
          y: pathPosAt(best.prog).y,
          text: `-${Math.round(dmg)}`,
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
        const slotX = 12 + d.slotIdx * 18;
        if (Math.abs(slotX - aPos.x) < 8 && Math.abs(50 - aPos.y) < 14 && a.atkCd <= 0) {
          const dmg = Math.max(1, a.atk - d.def * 0.5);
          d.hp -= dmg;
          a.atkCd = 1.0;
        }
      }
    }

    ds.attackers = ds.attackers.filter((a) => a.hp > 0);
    ds.defenders = ds.defenders.filter((d) => d.hp > 0);
    ds.floats = ds.floats.map((f) => ({ ...f, t: f.t + dt })).filter((f) => f.t < 0.6);

    if (ds.baseHp <= 0) {
      ds.ended = true;
      ds.won = false;
    }
    return ds;
  },
};
