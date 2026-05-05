/* Lane-based auto-battle simulator.
   Pure-ish: build with Battle.init, advance with Battle.tick(bs, dt), resolve
   with Battle.summarize(bs). The Battle.jsx screen drives ticks via RAF;
   ai.js uses Battle.quickResolve for off-screen resolution.

   Each side has a hero + a retinue (list of {unit, count}). Spawns are
   distributed round-robin into 3 lanes; everyone walks toward their target
   and engages when in range. Hero abilities are triggered by the player. */

import { CONST } from "../core/constants.js";
import { UNITS } from "../data/units.js";
import { ITEMS, equipmentEffects } from "../data/items.js";
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
  // Equipment grants extra unit-traits (drain/holy/pierce/shield/bulwark/rally
  // /undying) — they slot into the hero's `traits` so the existing trait
  // checks in the tick loop work without modification.
  const heroTraits = ["hero"];
  for (const slot of ["weapon", "armor", "trinket", "mount"]) {
    const id = hero.equipment?.[slot];
    if (!id) continue;
    const it = ITEMS[id];
    if (!it) continue;
    atk += it.stats.atk || 0;
    dfn += it.stats.def || 0;
    hp  += it.stats.hp  || 0;
    spd += it.stats.spd || 0;
    for (const eff of it.effects || []) {
      if (eff.kind === "grantTrait" && eff.trait && !heroTraits.includes(eff.trait)) {
        heroTraits.push(eff.trait);
      }
    }
  }
  // passiveStat: multiplicative bumps applied after flat stats. Stacks
  // across slots since each effect is a separate multiplier.
  for (const eff of equipmentEffects(hero, "passiveStat")) {
    const m = eff.mul || {};
    if (m.atk) atk = Math.round(atk * m.atk);
    if (m.def) dfn = Math.round(dfn * m.def);
    if (m.hp)  hp  = Math.round(hp  * m.hp);
    if (m.spd) spd = spd * m.spd;
  }
  // Stance bakes into the spawned fighter's atk/def so all the per-tick
  // damage math stays untouched. Aggressive trades def for atk; defensive
  // does the inverse; balanced (default) is a no-op.
  const stance = hero.behavior?.stance || "balanced";
  if (stance === "aggressive") {
    atk = Math.round(atk * 1.20);
    dfn = Math.round(dfn * 0.85);
  } else if (stance === "defensive") {
    atk = Math.round(atk * 0.90);
    dfn = Math.round(dfn * 1.25);
  }
  return {
    uid: side + "_hero",
    kind: "hero",
    heroId: hero.id, side, lane: 1, fac,
    hp, maxHp: hp, atk, def: dfn, spd, range: 1,
    icon: def.portrait, name: def.name, traits: heroTraits,
    x: side === "L" ? 8 : C().LANE_LENGTH - 8,
    atkCd: 0, alive: true,
    mp: hero.mp ?? hero.maxMp ?? 30,
    maxMp: hero.maxMp || 30,
    cooldowns: {},
    abilities: def.abilities,
    perks: hero.perks || [],
    didCharge: false,
    // Behavior travels with the fighter so the targeting and auto-cast
    // logic inside the tick loop has a stable per-side reference.
    behavior: hero.behavior || { stance: "balanced", targeting: "closest", autoCast: false },
    // Runtime trigger lists pulled from equipment. Cheap to read each tick;
    // we resolve them via small helpers below.
    onCritEffects:  equipmentEffects(hero, "onCrit"),
    onKillEffects:  equipmentEffects(hero, "onKill"),
    onLowHPEffects: equipmentEffects(hero, "onLowHP"),
    damageVsEffects: equipmentEffects(hero, "damageVs"),
  };
}

/* Active onLowHP modifier on a hero fighter. Picks the largest matching
   atk/def multiplier across triggered effects (no double-stacking). Returns
   1 for non-heroes or when no thresholds are crossed. */
function activeLowHpMul(fighter, kind) {
  if (fighter.kind !== "hero") return 1;
  const list = fighter.onLowHPEffects;
  if (!list || !list.length) return 1;
  const ratio = fighter.hp / fighter.maxHp;
  let m = 1;
  for (const eff of list) {
    if (ratio < (eff.below ?? 0) && eff.mul && eff.mul[kind]) {
      m *= eff.mul[kind];
    }
  }
  return m;
}

/* Apply an effect-action list (onCrit / onKill) to the source hero.
   Restores HP/MP, or accumulates `bs.heroBonusGold[side]` for post-battle
   payout. Spawns a float so the player sees the trigger fire. */
function applyEffectActions(effects, hero, bs) {
  if (!effects || !effects.length) return;
  for (const eff of effects) {
    const a = eff.action;
    if (!a) continue;
    const v = a.value || 0;
    if (a.type === "mp") {
      hero.mp = Math.min(hero.maxMp, hero.mp + v);
      bs.floats.push({
        id: Math.random().toString(36).slice(2),
        x: hero.x, lane: hero.lane, side: hero.side,
        text: `+${v} MP`, kind: "heal", t: 0,
      });
    } else if (a.type === "heal") {
      hero.hp = Math.min(hero.maxHp, hero.hp + v);
      bs.floats.push({
        id: Math.random().toString(36).slice(2),
        x: hero.x, lane: hero.lane, side: hero.side,
        text: `+${v}`, kind: "heal", t: 0,
      });
    } else if (a.type === "gold") {
      bs.heroBonusGold = bs.heroBonusGold || { L: 0, R: 0 };
      bs.heroBonusGold[hero.side] = (bs.heroBonusGold[hero.side] || 0) + v;
    }
  }
}

function spawnSide(retinue, hero, side, fac) {
  const fighters = [];
  fighters.push(makeHeroFighter(hero, side, fac));
  const lanes = [0, 1, 2];
  // Each stack carries an optional `lane` (0=vanguard, 1=center, 2=reserve)
  // that the player set in the ARMY tab. Stacks without a chosen lane fall
  // back to round-robin so freshly recruited troops still distribute.
  // We track a separate auto-counter so manual placements don't perturb
  // round-robin balance for the unassigned remainder.
  let autoCursor = 0;
  for (const stack of retinue) {
    const lvl = stack.lvl ?? 1;
    const chosenLane = stack.lane;
    for (let i = 0; i < stack.count; i++) {
      const lane = (chosenLane === 0 || chosenLane === 1 || chosenLane === 2)
        ? chosenLane
        : lanes[(autoCursor++) % 3];
      const idx = fighters.filter((f) => f.side === side && f.lane === lane).length;
      if (idx >= C().MAX_PER_LANE) continue;
      fighters.push(makeFighter(unitId(stack), side, lane, idx, fac, lvl));
    }
  }
  return fighters;
}

// Tiny helper to keep the spawn loop readable.
function unitId(stack) { return stack.unit; }

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
      // Equipment payouts (onCrit/onKill type:"gold") accumulate here and are
      // surfaced via summarize() so RESOLVE_BATTLE can credit the attacker.
      heroBonusGold: { L: 0, R: 0 },
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
        // perk_moonweave: hero MP regen ×1.5
        const mpMul = (f.perks || []).includes("perk_moonweave") ? 1.5 : 1.0;
        f.mp = Math.min(f.maxMp, f.mp + CONST.BATTLE.HERO_REGEN_MP * mpMul * dt);
        for (const k of Object.keys(f.cooldowns)) {
          f.cooldowns[k] = Math.max(0, f.cooldowns[k] - dt);
        }
        // Auto-cast: if the player set the hero to fire abilities on its
        // own, scan slots in order and trigger the first ready one. We
        // mutate bs in place via castAbility (returns the same object
        // since we already cloned the fighter array before the tick).
        if (f.behavior?.autoCast && f.alive) {
          for (const a of f.abilities) {
            const cd = f.cooldowns[a.id] || 0;
            const cost = (f.perks?.includes("perk_tactician") ? Math.round(a.cost * 0.8) : a.cost);
            const free = f.perks?.includes("perk_untold") && !f.untoldUsed;
            if (cd > 0) continue;
            if (!free && f.mp < cost) continue;
            Battle.castAbility(bs, f.side, a.id);
            break; // one cast per tick is enough; next tick can fire another
          }
        }
      }
      f.atkCd = Math.max(0, f.atkCd - dt);
    }

    for (const f of bs.fighters) {
      if (!f.alive) continue;

      // heal: support trait — if a same-lane ally is below 85% HP and within
      // a generous heal radius, channel into healing them instead of attacking.
      // Falls through to the normal attack flow when no one needs mending.
      if (f.atkCd <= 0 && (f.traits || []).includes("heal")) {
        const wounded = bs.fighters.filter((o) =>
          o.alive && o.side === f.side && o.uid !== f.uid && o.lane === f.lane && o.hp < o.maxHp * 0.85
        );
        if (wounded.length) {
          const ally = wounded.reduce((a, b) => (a.hp / a.maxHp < b.hp / b.maxHp ? a : b));
          if (Math.abs(ally.x - f.x) <= Math.max(f.range, 3)) {
            const amount = Math.max(2, Math.round(f.atk * 0.8));
            ally.hp = Math.min(ally.maxHp, ally.hp + amount);
            bs.floats.push({
              id: Math.random().toString(36).slice(2),
              x: ally.x, lane: ally.lane, side: ally.side,
              text: `+${amount}`, kind: "heal", t: 0,
            });
            f.atkCd = CONST.BATTLE.ATTACK_COOLDOWN;
            tickEvents.push({ kind: "heal", from: f.uid, to: ally.uid, amount });
            continue;
          }
        }
      }

      const enemies = bs.fighters.filter((o) => o.alive && o.side !== f.side);
      let target = null;
      const inSameLane = enemies.filter((o) => o.lane === f.lane);
      const closest = (pool) => pool.reduce((a, b) =>
        (Math.abs(a.x - f.x) < Math.abs(b.x - f.x) ? a : b));
      // Hero targeting can be reshaped by the player's pre-battle
      // selection. Non-heroes always use the existing closest-in-lane
      // algorithm so per-trooper AI stays cheap.
      const heroPick = f.kind === "hero" && f.behavior?.targeting;
      if (heroPick && heroPick !== "closest" && inSameLane.length) {
        if (heroPick === "wounded") {
          target = inSameLane.reduce((a, b) => (a.hp / a.maxHp < b.hp / b.maxHp ? a : b));
        } else if (heroPick === "threat") {
          target = inSameLane.reduce((a, b) => (a.atk > b.atk ? a : b));
        } else if (heroPick === "support") {
          const supports = inSameLane.filter((o) => (o.traits || []).includes("heal"));
          target = supports.length ? closest(supports) : closest(inSameLane);
        }
      } else if (inSameLane.length) {
        target = closest(inSameLane);
      } else if (enemies.length) {
        target = closest(enemies);
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
        // onLowHP (target): equipment grants def buff while bloodied.
        if (target.kind === "hero") {
          effDef = effDef * activeLowHpMul(target, "def");
        }
        // bulwark: target trait. Effective +50% defense — built like a wall.
        if ((target.traits || []).includes("bulwark")) {
          effDef = effDef * 1.5;
        }
        // pierce: attacker trait. Halves effective defense (post-perk/bulwark)
        // — heavy bolts and bone arrows treat plate as paper.
        if ((f.traits || []).includes("pierce")) {
          effDef = effDef * 0.5;
        }
        let dmg = Math.max(1, Math.round(f.atk * (1 + variance) - effDef * 0.5));
        // shield: target trait, melee-only — round shields shrug 25% off the
        // first strike but offer nothing against arrows or siege.
        if ((target.traits || []).includes("shield") && f.range === 1) {
          dmg = Math.max(1, Math.round(dmg * 0.75));
        }
        // holy: attacker trait. +30% vs Ash faction or anything that draws
        // power from death (undying / drain). Crusader-flavored: useless
        // most of the time, terrifying when it matters.
        if ((f.traits || []).includes("holy")) {
          const t = target.traits || [];
          if (target.fac === "ash" || t.includes("undying") || t.includes("drain")) {
            dmg = Math.round(dmg * 1.3);
          }
        }
        // pike: attacker trait. +50% vs vanguards and charge units — anti-
        // cavalry hedge. Spear formations punish heavy melee, do nothing
        // remarkable against archers or supports.
        if ((f.traits || []).includes("pike")) {
          const t = target.traits || [];
          if (target.role === "vanguard" || t.includes("charge")) {
            dmg = Math.round(dmg * 1.5);
          }
        }
        // siege: attacker trait. +25% vs heavy targets (maxHp >= 50). Lets
        // ballistas/warmachines feel like artillery — wasted on light skirms,
        // murder on knights and treants.
        if ((f.traits || []).includes("siege") && target.maxHp >= 50) {
          dmg = Math.round(dmg * 1.25);
        }
        // rally: a banner-bearer in the same lane lifts every other ally's
        // damage by 10%. The banner itself doesn't get the bonus, and we
        // cap at one stack regardless of how many banners are present.
        const rallying = bs.fighters.some((o) =>
          o.alive && o.side === f.side && o.uid !== f.uid
          && o.lane === f.lane && (o.traits || []).includes("rally")
        );
        if (rallying && !(f.traits || []).includes("rally")) {
          dmg = Math.round(dmg * 1.1);
        }
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
        // perk_marksman: +15% damage from ranged attackers (range > 1)
        if (f.range > 1 && heroHasPerk(bs, f.side, "perk_marksman")) {
          dmg = Math.round(dmg * 1.15);
        }
        // perk_vanguard: +20% damage in the opening seconds — kickoff burst
        if (bs.time < 5 && heroHasPerk(bs, f.side, "perk_vanguard")) {
          dmg = Math.round(dmg * 1.2);
        }
        // perk_executioner: +25% damage to wounded foes (<30% HP)
        if (target.hp / target.maxHp < 0.3 && heroHasPerk(bs, f.side, "perk_executioner")) {
          dmg = Math.round(dmg * 1.25);
        }
        // perk_warlord: ally aura — every troop on the side deals +8% if
        // the side's hero has the capstone. Heroes don't double-dip.
        if (f.kind === "unit" && heroHasPerk(bs, f.side, "perk_warlord")) {
          dmg = Math.round(dmg * 1.08);
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
        // onLowHP (attacker): equipment grants atk buff while bloodied.
        if (f.kind === "hero") {
          const m = activeLowHpMul(f, "atk");
          if (m !== 1) dmg = Math.round(dmg * m);
        }
        // damageVs: equipment-flavored anti-faction / anti-trait riders. The
        // hero's effects scan the target and add a flat percent. Multiple
        // effects stack multiplicatively (a banner that hates Ash *and*
        // anything draining will fire both clauses).
        if (f.kind === "hero" && f.damageVsEffects && f.damageVsEffects.length) {
          const tt = target.traits || [];
          for (const eff of f.damageVsEffects) {
            if (eff.target === target.fac || tt.includes(eff.target)) {
              dmg = Math.round(dmg * (1 + (eff.value || 0)));
            }
          }
        }
        target.hp -= dmg;
        bs.floats.push({
          id: Math.random().toString(36).slice(2),
          x: target.x, lane: target.lane, side: target.side,
          text: `-${dmg}`, kind: isCrit ? "crit" : "hit", t: 0,
        });
        f.atkCd = CONST.BATTLE.ATTACK_COOLDOWN;
        tickEvents.push({ kind: "hit", from: f.uid, to: target.uid, dmg, isCrit });
        // drain: attacker trait. Heal for 30% of post-mitigation damage —
        // intentionally reads `dmg` after shield/bulwark/holy/pike etc. so a
        // Vampire Thrall pierced by a Knight's plate heals less, not the same.
        // perk_bloodtithe: drain heal multiplier ×1.5.
        if ((f.traits || []).includes("drain")) {
          const drainPct = heroHasPerk(bs, f.side, "perk_bloodtithe") ? 0.45 : 0.3;
          const heal = Math.max(1, Math.round(dmg * drainPct));
          f.hp = Math.min(f.maxHp, f.hp + heal);
          bs.floats.push({
            id: Math.random().toString(36).slice(2),
            x: f.x, lane: f.lane, side: f.side,
            text: `+${heal}`, kind: "drain", t: 0,
          });
        }
        // aoe: attacker trait. Splash 35% damage to up to two other enemies
        // in the same lane within 4 of the primary target. Splash hits do
        // NOT propagate (no recursive aoe) and ignore most modifiers — a
        // simple flat splash on top of the main hit.
        // perk_stormcaller: splash radius and damage scaled up.
        if ((f.traits || []).includes("aoe")) {
          const stormcaller = heroHasPerk(bs, f.side, "perk_stormcaller");
          const splashRadius = stormcaller ? 6 : 4;
          const splashPct = stormcaller ? 0.45 : 0.35;
          const splashDmg = Math.max(1, Math.round(dmg * splashPct));
          const splashTargets = bs.fighters
            .filter((o) =>
              o.alive && o.side !== f.side && o.uid !== target.uid
              && o.lane === target.lane && Math.abs(o.x - target.x) < splashRadius
            )
            .slice(0, 2);
          if (splashTargets.length > 0) {
            tickEvents.push({
              kind: "aoe", at: { x: target.x, lane: target.lane, side: target.side },
              from: f.uid, to: target.uid,
            });
          }
          for (const o of splashTargets) {
            o.hp -= splashDmg;
            bs.floats.push({
              id: Math.random().toString(36).slice(2),
              x: o.x, lane: o.lane, side: o.side,
              text: `-${splashDmg}`, kind: "splash", t: 0,
            });
            tickEvents.push({ kind: "hit", from: f.uid, to: o.uid, dmg: splashDmg, isSplash: true });
            if (o.hp <= 0) {
              o.alive = false;
              tickEvents.push({ kind: "die", uid: o.uid });
              if ((o.traits || []).includes("undying") && !o.didRevive) {
                o.didRevive = true;
                o.alive = true;
                o.hp = Math.round(o.maxHp * 0.5);
                tickEvents.push({ kind: "revive", uid: o.uid });
              }
            }
          }
        }
        // perk_decap: crits restore 5 MP to the attacker's side hero
        if (isCrit && heroHasPerk(bs, f.side, "perk_decap")) {
          const sideHero = bs.fighters.find((h) => h.kind === "hero" && h.side === f.side && h.alive);
          if (sideHero) sideHero.mp = Math.min(sideHero.maxMp, sideHero.mp + 5);
        }
        // onCrit: hero-only equipment trigger (mp / heal / gold). Splash and
        // cleave hits don't carry isCrit, so this naturally fires once per
        // critical primary swing.
        if (isCrit && f.kind === "hero" && f.onCritEffects && f.onCritEffects.length) {
          applyEffectActions(f.onCritEffects, f, bs);
        }
        // perk_whirlwind: capstone — hero melee swings cleave to other
        // adjacent foes for half the original damage. Skips the primary
        // target; non-recursive like aoe; counted as `splash` for vfx.
        if (f.kind === "hero" && f.range === 1 && heroHasPerk(bs, f.side, "perk_whirlwind")) {
          const cleaveDmg = Math.max(1, Math.round(dmg * 0.5));
          const cleaveTargets = bs.fighters.filter((o) =>
            o.alive && o.side !== f.side && o.uid !== target.uid
            && o.lane === target.lane && Math.abs(o.x - target.x) < 3
          );
          for (const o of cleaveTargets) {
            o.hp -= cleaveDmg;
            bs.floats.push({
              id: Math.random().toString(36).slice(2),
              x: o.x, lane: o.lane, side: o.side,
              text: `-${cleaveDmg}`, kind: "splash", t: 0,
            });
            tickEvents.push({ kind: "hit", from: f.uid, to: o.uid, dmg: cleaveDmg, isSplash: true });
            if (o.hp <= 0) {
              o.alive = false;
              tickEvents.push({ kind: "die", uid: o.uid });
            }
          }
        }
        // perk_thornarmor: reflect 20% melee damage back to attacker
        if (f.range === 1 && heroHasPerk(bs, target.side, "perk_thornarmor") && f.alive) {
          const reflect = Math.round(dmg * 0.2);
          if (reflect > 0) {
            f.hp -= reflect;
            bs.floats.push({
              id: Math.random().toString(36).slice(2),
              x: f.x, lane: f.lane, side: f.side,
              text: `-${reflect}`, kind: "hit", t: 0,
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
          // onKill: hero-only equipment trigger fires on the swing that fells
          // the foe. Fires before any revive so the player sees the payout
          // even if the body claws back up.
          if (f.kind === "hero" && f.onKillEffects && f.onKillEffects.length) {
            applyEffectActions(f.onKillEffects, f, bs);
          }
          if (target.traits?.includes("undying") && !target.didRevive) {
            target.didRevive = true;
            target.alive = true;
            target.hp = Math.round(target.maxHp * 0.5);
            tickEvents.push({ kind: "revive", uid: target.uid });
          }
          // perk_ancientpact: capstone — hero rises once at half HP. Same
          // single-revive contract as undying so it can't loop forever.
          if (target.kind === "hero" && !target.didRevive
              && (target.perks || []).includes("perk_ancientpact")) {
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
    // perk_untold: capstone — the first ability cast each battle costs 0 MP.
    // Tracked via `untoldUsed` flag on the hero, set after the first cast.
    if (hero.perks.includes("perk_untold") && !hero.untoldUsed) {
      cost = 0;
    }
    if (hero.mp < cost) return bs;
    if ((hero.cooldowns[abilityId] || 0) > 0) return bs;
    hero.mp -= cost;
    if (hero.perks.includes("perk_untold") && !hero.untoldUsed) {
      hero.untoldUsed = true;
    }
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
          bs.floats.push({ id: Math.random().toString(36).slice(2), x: t.x, lane: t.lane, side: t.side, text: `-${dmg}`, kind: "splash", t: 0 });
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
            bs.floats.push({ id: Math.random().toString(36).slice(2), x: e.x, lane: e.lane, side: e.side, text: `-${dmg}`, kind: "splash", t: 0 });
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
      // Equipment payout (onCrit/onKill type:"gold") for each side. RESOLVE_BATTLE
      // adds attackerBonusGold to the attacker's purse on victory or defeat.
      attackerBonusGold: bs.heroBonusGold?.L || 0,
      defenderBonusGold: bs.heroBonusGold?.R || 0,
    };
  },
};
