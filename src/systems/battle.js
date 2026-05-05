/* Lane-based auto-battle simulator.
   Pure-ish: build with Battle.init, advance with Battle.tick(bs, dt), resolve
   with Battle.summarize(bs). The Battle.jsx screen drives ticks via RAF;
   ai.js uses Battle.quickResolve for off-screen resolution.

   Each side has a hero + a retinue (list of {unit, count}). Spawns are
   distributed round-robin into 3 lanes; everyone walks toward their target
   and engages when in range. Hero abilities are triggered by the player. */

import { CONST } from "../core/constants.js";
import { UNITS } from "../data/units.js";
import { ITEMS } from "../data/items.js";
import { HEROES } from "../data/heroes.js";

const C = () => CONST.BATTLE;

function heroHasPerk(bs, side, perkId) {
  const hero = bs.fighters.find((f) => f.kind === "hero" && f.side === side);
  if (!hero) return false;
  return (hero.perks || []).includes(perkId);
}

function makeFighter(unitId, side, lane, idx, fac, lvl = 1) {
  const u = UNITS[unitId];
  // FE-style level scaling: +10% per level over 1 on hp/atk/def. Speed
  // intentionally unscaled — speed feeds the targeting loop and small
  // perturbations cascade weirdly. lvl defaults to 1 so legacy garrison
  // stacks (no lvl field) still work.
  const m = 1 + Math.max(0, (lvl - 1)) * 0.10;
  return {
    uid: side + "_" + unitId + "_" + lane + "_" + idx + "_" + Math.random().toString(36).slice(2, 6),
    kind: "unit",
    unitId, side, lane, fac,
    lvl,
    hp: Math.round(u.hp * m), maxHp: Math.round(u.hp * m),
    atk: Math.round(u.atk * m), def: Math.round(u.def * m),
    spd: u.spd, range: u.range,
    icon: u.icon, name: u.name, traits: u.traits || [],
    x: side === "L" ? 4 + idx * 2 : C().LANE_LENGTH - 4 - idx * 2,
    atkCd: 0, alive: true,
    target: null,
    role: u.role,
    didCharge: false,
  };
}

function makeHeroFighter(hero, side, fac) {
  const def = HEROES[hero.id];
  let atk = def.base.atk + (hero.lvl - 1) * def.perRank.atk;
  let dfn = def.base.def + (hero.lvl - 1) * def.perRank.def;
  let hp  = hero.maxHp;
  let spd = def.base.spd;
  for (const slot of ["weapon", "armor", "trinket", "mount"]) {
    const id = hero.equipment?.[slot];
    if (!id) continue;
    const it = ITEMS[id];
    if (!it) continue;
    atk += it.stats.atk || 0;
    dfn += it.stats.def || 0;
    hp  += it.stats.hp  || 0;
    spd += it.stats.spd || 0;
  }
  return {
    uid: side + "_hero",
    kind: "hero",
    heroId: hero.id, side, lane: 1, fac,
    hp, maxHp: hp, atk, def: dfn, spd, range: 1,
    icon: def.portrait, name: def.name, traits: ["hero"],
    x: side === "L" ? 8 : C().LANE_LENGTH - 8,
    atkCd: 0, alive: true,
    mp: hero.mp ?? hero.maxMp ?? 30,
    maxMp: hero.maxMp || 30,
    cooldowns: {},
    abilities: def.abilities,
    perks: hero.perks || [],
    didCharge: false,
  };
}

function spawnSide(retinue, hero, side, fac) {
  const fighters = [];
  fighters.push(makeHeroFighter(hero, side, fac));
  const lanes = [0, 1, 2];
  // Flatten the retinue into per-individual {unitId, lvl} pairs so each
  // soldier inherits its stack's level. Garrison stacks without a lvl
  // field default to L1.
  const flat = [];
  for (const stack of retinue) {
    const lvl = stack.lvl ?? 1;
    for (let i = 0; i < stack.count; i++) flat.push({ unitId: stack.unit, lvl });
  }
  flat.forEach(({ unitId, lvl }, i) => {
    const lane = lanes[i % 3];
    const idx = fighters.filter((f) => f.side === side && f.lane === lane).length;
    if (idx >= C().MAX_PER_LANE) return;
    fighters.push(makeFighter(unitId, side, lane, idx, fac, lvl));
  });
  return fighters;
}

function snapshotCounts(stacks) {
  const m = {};
  for (const s of stacks) m[s.unit] = (m[s.unit] || 0) + s.count;
  return m;
}

export const Battle = {
  init({ attackerHero, attackerRetinue, attackerFac, defenderHero, defenderGarrison, defenderFac }) {
    const fighters = [
      ...spawnSide(attackerRetinue, attackerHero, "L", attackerFac),
      ...spawnSide(defenderGarrison, defenderHero, "R", defenderFac),
    ];
    return {
      time: 0,
      fighters,
      events: [],
      ended: false,
      winner: null,
      attackerFac, defenderFac,
      attackerStart: snapshotCounts(attackerRetinue),
      defenderStart: snapshotCounts(defenderGarrison),
      floats: [],
      timers: [],
    };
  },

  tick(bs, dt) {
    if (bs.ended) return bs;
    bs.time += dt;
    const tickEvents = [];

    if (bs.timers && bs.timers.length) {
      const remaining = [];
      for (const t of bs.timers) {
        if (bs.time >= t.deadline) {
          t.undo();
        } else {
          remaining.push(t);
        }
      }
      bs.timers = remaining;
    }

    for (const f of bs.fighters) {
      if (!f.alive) continue;
      if (f.kind === "hero") {
        f.mp = Math.min(f.maxMp, f.mp + CONST.BATTLE.HERO_REGEN_MP * dt);
        for (const k of Object.keys(f.cooldowns)) {
          f.cooldowns[k] = Math.max(0, f.cooldowns[k] - dt);
        }
      }
      f.atkCd = Math.max(0, f.atkCd - dt);
    }

    for (const f of bs.fighters) {
      if (!f.alive) continue;
      const enemies = bs.fighters.filter((o) => o.alive && o.side !== f.side);
      let target = null;
      const inSameLane = enemies.filter((o) => o.lane === f.lane);
      if (inSameLane.length) {
        target = inSameLane.reduce((a, b) => (Math.abs(a.x - f.x) < Math.abs(b.x - f.x) ? a : b));
      } else if (enemies.length) {
        target = enemies.reduce((a, b) => (Math.abs(a.x - f.x) < Math.abs(b.x - f.x) ? a : b));
      }
      f.target = target?.uid || null;
      if (!target) continue;

      const dist = Math.abs(target.x - f.x);
      if (dist > f.range) {
        const dir = target.x > f.x ? 1 : -1;
        f.x += dir * f.spd * CONST.BATTLE.UNIT_MOVE_SCALE * dt;
      } else if (f.atkCd <= 0) {
        const variance = (Math.random() - 0.5) * 2 * CONST.BATTLE.DAMAGE_VARIANCE;
        // perk_shieldwall: +15% def to vanguard troops on the defender's side
        let effDef = target.def;
        if (target.role === "vanguard" && heroHasPerk(bs, target.side, "perk_shieldwall")) {
          effDef = effDef * 1.15;
        }
        // perk_apex (defender hero, low HP): +30% def
        if (target.kind === "hero"
            && target.hp / target.maxHp < 0.35
            && heroHasPerk(bs, target.side, "perk_apex")) {
          effDef = effDef * 1.3;
        }
        let dmg = Math.max(1, Math.round(f.atk * (1 + variance) - effDef * 0.5));
        let isCrit = false;
        if (f.traits.includes("crit") && Math.random() < 0.2) {
          dmg = Math.round(dmg * 1.6);
          isCrit = true;
        }
        if (f.traits.includes("frenzy")) dmg = Math.round(dmg * (1 + (1 - f.hp / f.maxHp) * 0.4));
        // perk_strike: +10% melee damage when attacker is range 1 and same-side hero has it
        if (f.range === 1 && heroHasPerk(bs, f.side, "perk_strike")) {
          dmg = Math.round(dmg * 1.1);
        }
        // perk_lance: +25% on charge (first attack) for mounted units (knight, or vanguard with "charge")
        const isMounted = f.unitId === "knight"
          || (f.role === "vanguard" && f.traits.includes("charge"));
        if (isMounted && !f.didCharge && heroHasPerk(bs, f.side, "perk_lance")) {
          dmg = Math.round(dmg * 1.25);
        }
        if (isMounted && !f.didCharge) f.didCharge = true;
        // perk_apex (attacker hero, low HP): +30% atk effectively
        if (f.kind === "hero"
            && f.hp / f.maxHp < 0.35
            && heroHasPerk(bs, f.side, "perk_apex")) {
          dmg = Math.round(dmg * 1.3);
        }
        target.hp -= dmg;
        bs.floats.push({
          id: Math.random().toString(36).slice(2),
          x: target.x, lane: target.lane, side: target.side,
          text: `-${dmg}`, t: 0,
        });
        f.atkCd = CONST.BATTLE.ATTACK_COOLDOWN;
        tickEvents.push({ kind: "hit", from: f.uid, to: target.uid, dmg });
        // perk_decap: crits restore 5 MP to the attacker's side hero
        if (isCrit && heroHasPerk(bs, f.side, "perk_decap")) {
          const sideHero = bs.fighters.find((h) => h.kind === "hero" && h.side === f.side && h.alive);
          if (sideHero) sideHero.mp = Math.min(sideHero.maxMp, sideHero.mp + 5);
        }
        // perk_thornarmor: reflect 20% melee damage back to attacker
        if (f.range === 1 && heroHasPerk(bs, target.side, "perk_thornarmor") && f.alive) {
          const reflect = Math.round(dmg * 0.2);
          if (reflect > 0) {
            f.hp -= reflect;
            bs.floats.push({
              id: Math.random().toString(36).slice(2),
              x: f.x, lane: f.lane, side: f.side,
              text: `-${reflect}`, t: 0,
            });
            tickEvents.push({ kind: "hit", from: target.uid, to: f.uid, dmg: reflect });
            if (f.hp <= 0) {
              f.alive = false;
              tickEvents.push({ kind: "die", uid: f.uid });
            }
          }
        }
        if (target.hp <= 0) {
          target.alive = false;
          tickEvents.push({ kind: "die", uid: target.uid });
          if (target.traits?.includes("undying") && !target.didRevive) {
            target.didRevive = true;
            target.alive = true;
            target.hp = Math.round(target.maxHp * 0.5);
            tickEvents.push({ kind: "revive", uid: target.uid });
          }
        }
      }
    }

    bs.floats = bs.floats.map((f) => ({ ...f, t: f.t + dt })).filter((f) => f.t < 0.7);

    const lAlive = bs.fighters.some((f) => f.alive && f.side === "L");
    const rAlive = bs.fighters.some((f) => f.alive && f.side === "R");
    if (!lAlive || !rAlive) {
      bs.ended = true;
      bs.winner = lAlive ? "L" : rAlive ? "R" : "draw";
    }
    bs.events = bs.events.concat(tickEvents);
    return bs;
  },

  castAbility(bs, side, abilityId) {
    const hero = bs.fighters.find((f) => f.kind === "hero" && f.side === side && f.alive);
    if (!hero) return bs;
    const ab = hero.abilities.find((a) => a.id === abilityId);
    if (!ab) return bs;
    let cost = ab.cost;
    if (hero.perks.includes("perk_tactician")) cost = Math.round(cost * 0.8);
    if (hero.mp < cost) return bs;
    if ((hero.cooldowns[abilityId] || 0) > 0) return bs;
    hero.mp -= cost;
    hero.cooldowns[abilityId] = ab.cd;

    const enemies = bs.fighters.filter((f) => f.alive && f.side !== side);
    const allies = bs.fighters.filter((f) => f.alive && f.side === side);

    switch (abilityId) {
      case "rally": {
        // perk_warcry: rally cooldown −2s
        hero.cooldowns[abilityId] = ab.cd - (hero.perks.includes("perk_warcry") ? 2 : 0);
        for (const a of allies) a.atk = Math.round(a.atk * 1.30);
        if (!bs.timers) bs.timers = [];
        bs.timers.push({
          deadline: bs.time + 4,
          undo: () => { for (const a of allies) a.atk = Math.round(a.atk / 1.30); },
        });
        break;
      }
      case "cleave": {
        // perk_kindle: +10% ability damage (30 → 33)
        const dmg = heroHasPerk(bs, side, "perk_kindle") ? 33 : 30;
        const targets = enemies.filter((e) => Math.abs(e.x - hero.x) < 12);
        for (const t of targets) {
          t.hp -= dmg;
          if (t.hp <= 0) t.alive = false;
          bs.floats.push({ id: Math.random().toString(36).slice(2), x: t.x, lane: t.lane, side: t.side, text: `-${dmg}`, t: 0 });
        }
        break;
      }
      case "surge": {
        for (const e of enemies) e.x += side === "L" ? 14 : -14;
        break;
      }
      case "frenzy": {
        for (const a of allies) a.atkCd = 0;
        break;
      }
      case "raise": {
        const fallen = bs.fighters.find((f) => !f.alive && f.side === side && f.kind !== "hero");
        if (fallen) {
          fallen.alive = true;
          fallen.hp = Math.round(fallen.maxHp * 0.5);
        }
        break;
      }
      case "plague": {
        // perk_kindle: +10% ability damage (30 → 33)
        const dmg = heroHasPerk(bs, side, "perk_kindle") ? 33 : 30;
        for (const e of enemies) {
          if (Math.abs(e.x - hero.x) < 20 && e.lane === hero.lane) {
            e.hp -= dmg;
            if (e.hp <= 0) e.alive = false;
            bs.floats.push({ id: Math.random().toString(36).slice(2), x: e.x, lane: e.lane, side: e.side, text: `-${dmg}`, t: 0 });
          }
        }
        break;
      }
      case "thorns": {
        bs.fighters.push({
          uid: "thorn_" + Math.random().toString(36).slice(2),
          kind: "summon", side, lane: hero.lane, fac: hero.fac,
          hp: 80, maxHp: 80, atk: 0, def: 4, spd: 0, range: 0,
          icon: "🌿", name: "Thorn Wall", traits: ["bulwark"],
          x: hero.x + (side === "L" ? 8 : -8),
          atkCd: 99, alive: true, target: null,
        });
        break;
      }
      case "mend": {
        // perk_warden: +10% ability healing (25 → 28 rounded)
        const heal = heroHasPerk(bs, side, "perk_warden") ? Math.round(25 * 1.1) : 25;
        for (const a of allies) a.hp = Math.min(a.maxHp, a.hp + heal);
        break;
      }
    }
    bs.events.push({ kind: "ability", side, abilityId });
    return bs;
  },

  /* Fast-forward a battle without RAF — used by AI for off-screen turns. */
  quickResolve(setup) {
    let bs = Battle.init(setup);
    let safety = 0;
    while (!bs.ended && safety < 4000) {
      bs = Battle.tick(bs, 0.1);
      safety++;
    }
    return Battle.summarize(bs);
  },

  summarize(bs) {
    const winnerSide = bs.winner === "L" ? "attacker" : bs.winner === "R" ? "defender" : "draw";
    const aliveCounts = (side) => {
      const map = {};
      for (const f of bs.fighters) {
        if (f.kind === "unit" && f.side === side && f.alive) {
          map[f.unitId] = (map[f.unitId] || 0) + 1;
        }
      }
      return map;
    };
    const lossesFrom = (start, alive) =>
      Object.keys(start)
        .map((unit) => ({ unit, count: Math.max(0, start[unit] - (alive[unit] || 0)) }))
        .filter((x) => x.count > 0);

    const attackerLosses = lossesFrom(bs.attackerStart, aliveCounts("L"));
    const defenderLosses = lossesFrom(bs.defenderStart, aliveCounts("R"));
    const xp = defenderLosses.reduce((s, l) => s + (UNITS[l.unit]?.cost || 0) * l.count, 0) / 4 + 20;
    return {
      winner: winnerSide,
      attackerLosses, defenderLosses,
      xp: Math.round(xp),
      duration: bs.time,
    };
  },
};
