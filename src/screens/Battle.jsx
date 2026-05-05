/* Battle — auto-battle with an organic battlefield feel.
   - Units sit in lane bands but jitter within their band so the formation
     reads like a press of soldiers rather than three conga lines.
   - Per-fighter jitter is stamped at spawn (stable thereafter).
   - The RAF loop reads speed/paused via refs so changing them doesn't
     re-subscribe and bind to a stale `bs` (the demo had a bug where 5×
     reverted to 1× after one frame).
   - At high speeds we sub-step in 50ms slices for stable physics.
   - Visual feedback: per-event hit flashes / lunge / death animations are
     keyed off the `events` array bumps from each tick, layered on top of
     state without coupling to the sim. */
import { useEffect, useRef, useState } from "react";
import { useStore } from "../core/store.jsx";
import { CONST } from "../core/constants.js";
import { Battle } from "../systems/battle.js";
import { FACTIONS } from "../data/factions.js";
import { UNITS } from "../data/units.js";
import { TERRAINS, TOWN_TYPES } from "../data/map.js";
import { Crest } from "../components/Crest.jsx";
import { TutorialOverlay } from "../components/TutorialOverlay.jsx";

const LANE_NAMES = ["Vanguard", "Center", "Reserve"];
const SPEED_OPTIONS = [1, 2, 3, 5];

function syntheticBanditDefender() {
  return {
    hero: {
      id: "bandit_chief",
      name: "Brigand Captain",
      lvl: 1, xp: 0,
      maxHp: 70, hp: 70, mp: 0, maxMp: 0,
      equipment: {}, perks: [], consumables: [], retinue: [],
    },
  };
}

export function BattleScreen() {
  const { state, dispatch } = useStore();
  const pb = state.pendingBattle;

  if (!pb) {
    return (
      <div style={{ padding: 40 }}>
        No battle. <button className="btn" onClick={() => dispatch({ type: "SET_SCREEN", screen: "map" })}>Back</button>
      </div>
    );
  }
  return <BattleArena pb={pb} state={state} dispatch={dispatch} />;
}

function BattleArena({ pb, state, dispatch }) {
  const { tileId, attacker, defender } = pb;
  const tile = state.map.tiles.find((t) => t.id === tileId);
  const atkPlayer = state.players[attacker];
  const defPlayer = state.players[defender] || syntheticBanditDefender();

  const setupRef = useRef(null);
  if (!setupRef.current) {
    setupRef.current = Battle.init({
      attackerHero: { ...atkPlayer.hero },
      attackerRetinue: atkPlayer.hero.retinue,
      attackerFac: attacker,
      defenderHero: { ...defPlayer.hero, hp: defPlayer.hero.maxHp, mp: defPlayer.hero.maxMp },
      defenderGarrison: tile.garrison.length
        ? tile.garrison
        : [{ unit: FACTIONS[defender].units[0], count: 1 }],
      defenderFac: defender,
    });
    // Stamp stable jitter so positions don't twitch every tick
    for (const f of setupRef.current.fighters) {
      f.jitterY = (Math.random() * 2 - 1) * 0.26;
      f.jitterX = (Math.random() - 0.5) * 4;
    }
  }

  const [bs, setBs] = useState(setupRef.current);
  const [speed, setSpeed] = useState(CONST.BATTLE.DEFAULT_SPEED);
  const [paused, setPaused] = useState(false);
  const lastT = useRef(performance.now());
  const speedRef = useRef(speed);
  const pausedRef = useRef(paused);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  // Per-uid timestamps for short-lived classes (hit flash, lunge, death).
  // Stored in a ref so changes don't re-render — the BattleFighter reads
  // these via prop and React's reconciler handles the className diff.
  const fxRef = useRef({ hit: {}, lunge: {}, dying: {}, lastEventLen: 0 });
  // Battlefield-wide effects: shake timestamp, AOE burst markers, heal
  // sparkles, death poofs (parallel array so we don't lose them when the
  // dying fighter unmounts), edge flashes for ability casts and hero pain.
  const [vfx, setVfx] = useState({ shakeT: 0, bursts: [], sparkles: [], poofs: [] });
  const heroPortraitRef = useRef(null);
  const battlefieldRef = useRef(null);

  // Whenever bs.events grows, scan the new events and stamp per-uid effect
  // timestamps so the renderer can light the right fighters. Also queue
  // shake / burst / sparkle markers as side-channel state.
  useEffect(() => {
    const events = bs.events || [];
    const start = fxRef.current.lastEventLen;
    if (events.length <= start) return;
    fxRef.current.lastEventLen = events.length;
    const now = performance.now();
    const fxFighters = bs.fighters;
    const findF = (uid) => fxFighters.find((f) => f.uid === uid);
    let shake = 0;
    let edge = null; // 'gold' | 'red'
    let castedSide = null;
    const bursts = [];
    const sparkles = [];
    const poofs = [];
    for (let i = start; i < events.length; i++) {
      const ev = events[i];
      if (ev.kind === "hit") {
        fxRef.current.hit[ev.to] = now;
        const attacker = findF(ev.from);
        if (attacker) fxRef.current.lunge[ev.from] = now;
        const target = findF(ev.to);
        if (target && ev.dmg > target.maxHp * 0.25) shake = Math.max(shake, 1);
        if (target?.kind === "hero" && target.side === "L") {
          // Player hero took meaningful damage — flash portrait + red edge.
          edge = "red";
          if (heroPortraitRef.current) {
            heroPortraitRef.current.classList.remove("hero-portrait-flash");
            // force reflow so we can replay the animation
            // eslint-disable-next-line no-unused-expressions
            heroPortraitRef.current.offsetWidth;
            heroPortraitRef.current.classList.add("hero-portrait-flash");
          }
        }
      } else if (ev.kind === "die") {
        fxRef.current.dying[ev.uid] = now;
        const dead = findF(ev.uid);
        if (dead) {
          // Stamp the poof position now, so it survives the fighter unmount.
          poofs.push({
            id: `p_${i}_${dead.uid}`,
            xPct: ((dead.x + (dead.jitterX || 0)) / CONST.BATTLE.LANE_LENGTH) * 100,
            yPct: (dead.lane + 0.5) * 33.33 + (dead.jitterY || 0) * 12,
            t: now,
          });
        }
      } else if (ev.kind === "ability") {
        shake = Math.max(shake, 1);
        edge = "gold";
        if (ev.side === "L") castedSide = "L";
      } else if (ev.kind === "aoe") {
        if (ev.at) {
          bursts.push({
            id: `b_${i}`,
            xPct: (ev.at.x / CONST.BATTLE.LANE_LENGTH) * 100,
            yPct: (ev.at.lane + 0.5) * 33.33,
            t: now,
          });
        }
      } else if (ev.kind === "heal") {
        const target = findF(ev.to);
        if (target) {
          sparkles.push({
            id: `s_${i}_${target.uid}`,
            xPct: ((target.x + (target.jitterX || 0)) / CONST.BATTLE.LANE_LENGTH) * 100,
            yPct: (target.lane + 0.5) * 33.33 + (target.jitterY || 0) * 12,
            t: now,
          });
        }
      }
    }
    // Trigger the cast flash on the hero portrait when YOU cast.
    if (castedSide === "L" && heroPortraitRef.current) {
      heroPortraitRef.current.classList.remove("hero-cast-flash");
      // eslint-disable-next-line no-unused-expressions
      heroPortraitRef.current.offsetWidth;
      heroPortraitRef.current.classList.add("hero-cast-flash");
    }
    // Apply battlefield edge tint for ability casts (gold) or hero hurt (red).
    if (edge && battlefieldRef.current) {
      const cls = edge === "red" ? "edge-flash-red" : "edge-flash";
      battlefieldRef.current.classList.remove(cls);
      // eslint-disable-next-line no-unused-expressions
      battlefieldRef.current.offsetWidth;
      battlefieldRef.current.classList.add(cls);
      const t = setTimeout(() => battlefieldRef.current?.classList.remove(cls), 380);
      // best-effort cleanup; another tick may add a new flash before this runs
      void t;
    }
    if (shake || bursts.length || sparkles.length || poofs.length) {
      setVfx((prev) => ({
        shakeT: shake ? now : prev.shakeT,
        bursts: [...prev.bursts.filter((b) => now - b.t < 600), ...bursts],
        sparkles: [...prev.sparkles.filter((s) => now - s.t < 600), ...sparkles],
        poofs: [...prev.poofs.filter((p) => now - p.t < 600), ...poofs],
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bs.events?.length]);

  // Trigger CSS shake on the battlefield element when shakeT updates.
  useEffect(() => {
    const el = battlefieldRef.current;
    if (!el || !vfx.shakeT) return;
    el.classList.remove("shaking");
    // eslint-disable-next-line no-unused-expressions
    el.offsetWidth; // reflow
    el.classList.add("shaking");
    const t = setTimeout(() => el.classList.remove("shaking"), 240);
    return () => clearTimeout(t);
  }, [vfx.shakeT]);

  // Auto-pause once when the player's hero dies — gives them a beat to
  // see the loss before the AI mops up. Tracked via ref so it only fires
  // the first time, not on every subsequent re-render where the hero is
  // still dead. End-of-battle resolution is unaffected.
  const heroAutoPausedRef = useRef(false);
  const playerHeroAlive = bs.fighters.some((f) => f.kind === "hero" && f.side === "L" && f.alive);
  useEffect(() => {
    if (!playerHeroAlive && !heroAutoPausedRef.current && !bs.ended) {
      heroAutoPausedRef.current = true;
      setPaused(true);
    }
  }, [playerHeroAlive, bs.ended]);

  // Hotkeys:
  //   Space — pause/play
  //   1/2/3/5 — speed
  //   Q/W/E — cast ability slots (left to right)
  // Stays inert on input fields and when the dev tweaks panel is open
  // (those use `~` already; we don't intercept it).
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.metaKey || e.ctrlKey) return;
      if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); return; }
      if (e.key === "1") { setSpeed(1); return; }
      if (e.key === "2") { setSpeed(2); return; }
      if (e.key === "3") { setSpeed(3); return; }
      if (e.key === "5") { setSpeed(5); return; }
      const slotIdx = { q: 0, w: 1, e: 2 }[e.key.toLowerCase()];
      if (slotIdx !== undefined) {
        const heroNow = bs.fighters.find((f) => f.kind === "hero" && f.side === "L" && f.alive);
        const ab = heroNow?.abilities?.[slotIdx];
        if (!ab) return;
        const cd = heroNow.cooldowns?.[ab.id] || 0;
        if (heroNow.mp >= ab.cost && cd <= 0) {
          setBs((prev) =>
            Battle.castAbility({ ...prev, fighters: prev.fighters.map((f) => ({ ...f })) }, "L", ab.id)
          );
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bs.fighters]);

  useEffect(() => {
    if (bs.ended) {
      const summary = Battle.summarize(bs);
      const t = setTimeout(() => {
        dispatch({ type: "RESOLVE_BATTLE", tileId, attacker, defender, result: summary });
      }, 1200);
      return () => clearTimeout(t);
    }
    let raf;
    lastT.current = performance.now();
    const loop = (now) => {
      const sp = speedRef.current;
      let dt = ((now - lastT.current) / 1000) * sp;
      lastT.current = now;
      dt = Math.min(0.5, dt);
      if (!pausedRef.current && dt > 0) {
        const SLICE = 0.05;
        setBs((prev) => {
          let next = { ...prev, fighters: prev.fighters.map((f) => ({ ...f })) };
          let remaining = dt;
          while (remaining > 0 && !next.ended) {
            const step = Math.min(SLICE, remaining);
            next = Battle.tick(next, step);
            remaining -= step;
          }
          // New fighters spawned by abilities (e.g. thicket) need jitter too
          for (const f of next.fighters) {
            if (f.jitterY === undefined) {
              f.jitterY = (Math.random() * 2 - 1) * 0.26;
              f.jitterX = (Math.random() - 0.5) * 4;
            }
          }
          return next;
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bs.ended]);

  const heroL = bs.fighters.find((f) => f.kind === "hero" && f.side === "L");
  const lanes = [0, 1, 2];
  const LANE_LEN = CONST.BATTLE.LANE_LENGTH;

  const cast = (id) => {
    setBs((prev) =>
      Battle.castAbility({ ...prev, fighters: prev.fighters.map((f) => ({ ...f })) }, "L", id)
    );
  };

  const totalHp = (side) =>
    bs.fighters.filter((f) => f.side === side).reduce((s, f) => s + (f.alive ? f.hp : 0), 0);
  const totalMaxHp = (side) =>
    bs.fighters.filter((f) => f.side === side).reduce((s, f) => s + f.maxHp, 0);
  const lHp = totalHp("L");
  const lMax = totalMaxHp("L");
  const rHp = totalHp("R");
  const rMax = totalMaxHp("R");

  // Live kill counts: enemies my side has felled vs the other way around.
  // Counts only `unit` kind kills so hero deaths read cleanly in the topbar.
  const kills = { L: 0, R: 0 };
  for (const fighter of bs.fighters) {
    if (fighter.kind !== "unit" || fighter.alive) continue;
    if (fighter.side === "L") kills.R += 1; else kills.L += 1;
  }

  // Recent events for the bottom-of-arena ticker. Last 4 hit/heal/die/
  // ability/revive lines, formatted into a one-line phrase each.
  const tickerEvents = (bs.events || []).slice(-12).filter((e) => e.kind !== "hit" || e.dmg >= 8).slice(-4);

  const battleTitle = TOWN_TYPES[tile.town]?.name || TERRAINS[tile.terrain].name;

  const tutorialSteps = [
    {
      selector: "[data-tut='battlefield']",
      side: "top",
      title: "The battlefield",
      body: "Your troops left, enemy right. Three lanes — Vanguard, Center, Reserve. They auto-fight; your job is to time abilities and watch the line.",
    },
    {
      selector: "[data-tut='event-ticker']",
      side: "bottom",
      title: "Event ticker",
      body: "Big hits, crits, deaths, and ability casts get a one-line readout up here so you can scan what's happening without staring at floats.",
    },
    {
      selector: "[data-tut='abilities']",
      side: "top",
      title: "Hero abilities",
      body: "Tap Q, W, or E — or click. The conic sweep is cooldown; the bar at the bottom edge fills as your MP refunds. Outline glows when ready.",
    },
    {
      selector: "[data-tut='speed-controls']",
      side: "top",
      title: "Pause and speed",
      body: "Space pauses. 1/2/3/5 set speed. Default is 1× for readability — crank up when you're confident in the outcome. Hero death auto-pauses once.",
    },
  ];

  return (
    <div className="parchment full" style={{ display: "flex", flexDirection: "column", padding: 0, position: "relative" }}>
      <TutorialOverlay stepId="battle.intro" steps={tutorialSteps} />
      <div className="row between center" style={{
        padding: "6px 16px",
        borderBottom: "3px solid var(--line)",
        background: "var(--bg-2)",
        gap: 12,
      }}>
        <div className="row gap-2 center" style={{ minWidth: 200, flex: "0 1 240px" }}>
          <Crest faction={attacker} size={32} />
          <div className="col flex1" style={{ minWidth: 0, lineHeight: 1.2 }}>
            <div className="row between" style={{ fontSize: 12 }}>
              <span className="h-display">{FACTIONS[attacker].short} · YOU</span>
              <span className="numeric" style={{ color: "var(--gold-dk)" }} title="Kills landed">⚔ {kills.L}</span>
            </div>
            <div className="bar bar-hp" style={{ height: 7 }}>
              <div className="bf-hp-fill" style={{ width: `${(lHp / Math.max(1, lMax)) * 100}%`, background: "var(--gold)" }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>{Math.round(lHp)} / {lMax}</div>
          </div>
        </div>
        <div className="col center" style={{ flex: 1, minWidth: 0 }}>
          <div className="h-display" style={{ fontSize: 16, textAlign: "center" }}>
            ⚔ Battle for {battleTitle}
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>
            t {bs.time.toFixed(1)}s · {speed}× {paused ? "(paused)" : ""}
          </div>
        </div>
        <div className="row gap-2 center" style={{ minWidth: 200, flex: "0 1 240px", flexDirection: "row-reverse" }}>
          <Crest faction={defender} size={32} />
          <div className="col flex1" style={{ textAlign: "right", minWidth: 0, lineHeight: 1.2 }}>
            <div className="row between" style={{ fontSize: 12 }}>
              <span className="numeric" style={{ color: "var(--blood)" }} title="Enemy kills">⚔ {kills.R}</span>
              <span className="h-display">{FACTIONS[defender].short} · ENEMY</span>
            </div>
            <div className="bar bar-hp" style={{ height: 7 }}>
              <div className="bf-hp-fill" style={{ width: `${(rHp / Math.max(1, rMax)) * 100}%`, background: "var(--blood)" }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>{Math.round(rHp)} / {rMax}</div>
          </div>
        </div>
      </div>

      <div
        ref={battlefieldRef}
        data-tut="battlefield"
        className="battlefield battle-intro"
        style={{ flex: 1, position: "relative", overflow: "hidden" }}
      >
        <div className="bf-bg" />
        <div className="bf-haze" />

        {lanes.map((lane) => (
          <div key={"band" + lane} className="bf-band" style={{ top: `${lane * 33.33 + 1.5}%`, height: "30%" }}>
            <div className="bf-band-label">{LANE_NAMES[lane]}</div>
          </div>
        ))}

        <div className="bf-divider" />

        {/* Event ticker — last few interesting things in plain English so
            the player can read what's happening without watching every
            float. Anchored to the top-left corner of the battlefield so
            it can't overlap the centered "Battle for X" title in the bar
            above; keyed off bs.events length so it animates in. */}
        <div
          data-tut="event-ticker"
          style={{
            position: "absolute", top: 8, left: 12,
            display: "flex", flexDirection: "column", gap: 2,
            alignItems: "flex-start", pointerEvents: "none",
            zIndex: 8, maxWidth: "60%",
          }}
        >
          {tickerEvents.map((e, i) => (
            <EventTickerLine key={(bs.events.length - tickerEvents.length + i)} ev={e} bs={bs} />
          ))}
        </div>

        {/* Living + recently-dying fighters. Dying ones are kept for the
            duration of the death animation so the player sees them fall
            instead of vanish. */}
        {bs.fighters.map((f) => {
          const dyingT = fxRef.current.dying[f.uid] || 0;
          const recentDeath = !f.alive && dyingT && performance.now() - dyingT < 600;
          if (!f.alive && !recentDeath) return null;
          return (
            <BattleFighter
              key={f.uid}
              f={f}
              laneLen={LANE_LEN}
              hitT={fxRef.current.hit[f.uid]}
              lungeT={fxRef.current.lunge[f.uid]}
              dyingT={recentDeath ? dyingT : 0}
            />
          );
        })}

        {/* AOE bursts: short-lived ring at primary target position. */}
        {vfx.bursts.map((b) => (
          <div key={b.id} className="aoe-burst" style={{ left: `${b.xPct}%`, top: `${b.yPct}%` }} />
        ))}

        {/* Heal sparkles: green halo on the recipient. */}
        {vfx.sparkles.map((s) => (
          <div key={s.id} className="heal-sparkle" style={{ left: `${s.xPct}%`, top: `${s.yPct}%` }} />
        ))}

        {/* Death poofs: white expanding ring at the spot where a unit fell.
            Persists past the fighter's unmount so the player sees it. */}
        {vfx.poofs.map((p) => (
          <div key={p.id} className="bf-death-poof" style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }} />
        ))}

        {bs.floats.map((fl) => {
          const yPct = (fl.lane + 0.5) * 33.33 + (fl.jitterY || 0) * 12;
          // Classify the float — `kind` is set by battle.js when emitted;
          // legacy floats fall back to text-prefix detection so saves and
          // older code paths still render usefully.
          const kind = fl.kind
            || (fl.text?.startsWith("+") ? "heal" : "hit");
          // Magnitude scales the font size: 0 → 14, 50+ → 30. Clamps gently.
          const num = Math.abs(parseInt(fl.text, 10) || 0);
          const fontSize = Math.min(30, 14 + Math.sqrt(num) * 2.2);
          return (
            <div
              key={fl.id}
              className={`dmg-float ${kind} numeric`}
              style={{
                left: `${(fl.x / LANE_LEN) * 100}%`,
                top: `${yPct}%`,
                fontSize,
              }}
            >{fl.text}</div>
          );
        })}
      </div>

      <div className="row gap-2 center" style={{
        padding: "8px 16px",
        borderTop: "3px solid var(--line)",
        background: "var(--bg-2)",
      }}>
        <div className="row gap-2 center">
          <div
            ref={heroPortraitRef}
            style={{
              width: 48, height: 48, borderRadius: 10, flexShrink: 0,
              background: FACTIONS[attacker].palette.primary,
              border: "3px solid var(--gold)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 26,
            }}
          >{heroL?.icon || "👑"}</div>
          <div className="col" style={{ minWidth: 120, gap: 1 }}>
            <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>HP {Math.round(heroL?.hp || 0)}/{heroL?.maxHp || 0}</div>
            <div className="bar bar-hp" style={{ height: 5 }}>
              <div style={{ width: `${((heroL?.hp || 0) / (heroL?.maxHp || 1)) * 100}%` }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>MP {Math.round(heroL?.mp || 0)}/{heroL?.maxMp || 0}</div>
            <div className="bar bar-mp" style={{ height: 5 }}>
              <div style={{ width: `${((heroL?.mp || 0) / (heroL?.maxMp || 1)) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="row gap-1 flex1" data-tut="abilities" style={{ flexWrap: "wrap" }}>
          {(heroL?.abilities || []).map((a, idx) => {
            const cd = heroL.cooldowns?.[a.id] || 0;
            const cdPct = cd > 0 ? Math.min(1, cd / a.cd) : 0;
            const mpPct = Math.min(1, heroL.mp / Math.max(1, a.cost));
            const ready = heroL.mp >= a.cost && cd <= 0 && heroL.alive;
            // The button has two stacked progress overlays: a dark wedge
            // sweeping clockwise during cooldown (conic-gradient) and a
            // subtle MP-fill at the bottom showing how close the player
            // is to affording it. Both are pure visual — gameplay
            // unchanged.
            const cdMask = cd > 0
              ? `conic-gradient(rgba(0,0,0,0.55) ${cdPct * 360}deg, transparent 0)`
              : null;
            const hotkey = ["Q", "W", "E"][idx] || "";
            return (
              <button
                key={a.id}
                className={`btn ${ready ? "btn-primary" : "btn-ghost"}`}
                disabled={!ready}
                onClick={() => cast(a.id)}
                title={`${a.name} — ${a.effect} (hotkey ${hotkey})`}
                style={{
                  padding: "4px 8px", position: "relative", overflow: "hidden",
                  outline: ready ? "1px solid rgba(255,210,90,0.55)" : "none",
                }}
              >
                {cdMask && (
                  <div style={{
                    position: "absolute", inset: 0,
                    background: cdMask,
                    pointerEvents: "none", opacity: 0.85,
                  }} />
                )}
                {/* MP affordance bar at the bottom edge */}
                {!ready && cd <= 0 && (
                  <div style={{
                    position: "absolute", left: 0, bottom: 0, height: 2,
                    width: `${mpPct * 100}%`,
                    background: "var(--mp)",
                    pointerEvents: "none",
                  }} />
                )}
                <span style={{ fontSize: 16, position: "relative" }}>{a.icon}</span>
                <div className="col" style={{ alignItems: "flex-start", lineHeight: 1.1, position: "relative" }}>
                  <span style={{ fontSize: 11 }}>{a.name}</span>
                  <span style={{ fontSize: 9 }}>
                    {cd > 0 ? `${cd.toFixed(1)}s` : `${a.cost} MP`}
                    {hotkey && <span style={{ marginLeft: 4, opacity: 0.6 }}>· {hotkey}</span>}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="row gap-1" data-tut="speed-controls">
          <button
            className="btn btn-ghost"
            onClick={() => setPaused((p) => !p)}
            title="Pause / play (Space)"
            style={{ padding: "4px 8px" }}
          >{paused ? "▶" : "⏸"}</button>
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              className={`btn ${speed === s ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setSpeed(s)}
              title={`Speed ${s}× (key ${s})`}
              style={{ padding: "4px 8px", fontSize: 11 }}
            >{s}×</button>
          ))}
        </div>
      </div>

      {bs.ended && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 50,
        }}>
          <div className="panel pop-in" style={{ padding: 36, textAlign: "center", background: "var(--bg-1)" }}>
            <div className="h-display" style={{ fontSize: 38 }}>
              {bs.winner === "L" ? "VICTORY" : "DEFEAT"}
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: 6 }}>Resolving the field…</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* Tiny ticker line — phrases the event in plain language so the player
   can scan "Champion crit Skeleton for 28" instead of staring at floats.
   Each line is white-on-dark for readable contrast over the parchment
   battlefield; the event kind is colour-coded via a left accent stripe
   instead of tinting the text itself (which loses contrast at small sizes). */
function EventTickerLine({ ev, bs }) {
  const find = (uid) => bs.fighters.find((f) => f.uid === uid);
  let text = null;
  let accent = "rgba(255,255,255,0.4)"; // accent stripe colour, NOT text colour
  if (ev.kind === "hit") {
    const f = find(ev.from), t = find(ev.to);
    if (!f || !t) return null;
    const verb = ev.isCrit ? "CRIT" : ev.isSplash ? "splashed" : "hit";
    text = `${f.icon} ${f.name} ${verb} ${t.icon} ${t.name} for ${ev.dmg}`;
    accent = ev.isCrit ? "#ffd54a" : "#ffe1e1";
  } else if (ev.kind === "heal") {
    const f = find(ev.from), t = find(ev.to);
    if (!f || !t) return null;
    text = `${f.icon} ${f.name} mended ${t.icon} ${t.name} for ${ev.amount}`;
    accent = "#92e090";
  } else if (ev.kind === "die") {
    const t = find(ev.uid);
    if (!t) return null;
    text = `${t.icon} ${t.name} fell`;
    accent = "#ff7474";
  } else if (ev.kind === "revive") {
    const t = find(ev.uid);
    if (!t) return null;
    text = `${t.icon} ${t.name} rose again`;
    accent = "#d27ad8";
  } else if (ev.kind === "ability") {
    text = `${ev.side === "L" ? "You" : "Enemy"} cast ${ev.abilityId}`;
    accent = "#ffd54a";
  }
  if (!text) return null;
  return (
    <div
      className="slide-up"
      style={{
        background: "rgba(8,4,2,0.85)",
        color: "#fff7e6",
        fontSize: 11, fontWeight: 600,
        padding: "3px 10px 3px 12px",
        borderRadius: 12,
        borderLeft: `3px solid ${accent}`,
        textShadow: "0 1px 0 rgba(0,0,0,0.8)",
        whiteSpace: "nowrap",
        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
      }}
    >{text}</div>
  );
}

function BattleFighter({ f, laneLen, hitT = 0, lungeT = 0, dyingT = 0 }) {
  const fac = FACTIONS[f.fac];
  const isHero = f.kind === "hero";
  const size = isHero ? 52 : 38;
  const yPct = (f.lane + 0.5) * 33.33 + (f.jitterY || 0) * 12;
  const xPct = ((f.x + (f.jitterX || 0)) / laneLen) * 100;
  const hpPct = Math.max(0, f.hp / f.maxHp);

  // We want each effect class on for its CSS animation duration only.
  // The parent's `now` ticks via vfx state changes — we use the timestamp
  // delta to decide whether the class is still "active".
  const now = performance.now();
  const active = (t, dur) => t && now - t < dur;

  // Hero gets a ready-glow when an ability is castable and they're alive
  // — players' eyes need a hint to look at the bottom bar.
  const heroReady =
    isHero
    && f.side === "L"
    && f.alive
    && (f.abilities || []).some((a) => f.mp >= a.cost && (f.cooldowns?.[a.id] || 0) <= 0);
  const lowHp = f.alive && hpPct > 0 && hpPct < 0.25;

  const cls = [
    "bf-fighter",
    `side-${f.side}`,
    f.alive && !lowHp ? "idle" : "",
    active(hitT, 200) ? "hit" : "",
    active(lungeT, 260) ? "lunge" : "",
    dyingT ? "dying" : "",
    lowHp ? "low-hp" : "",
    heroReady ? "hero-ready" : "",
  ].filter(Boolean).join(" ");

  // Tooltip with name + hp + traits + role for fighter inspection on hover.
  const def = !isHero ? UNITS[f.unitId] : null;
  const traits = (def?.traits || []).join(", ");
  const tip = isHero
    ? `${f.name} · L${f.lvl} · HP ${Math.round(f.hp)}/${f.maxHp} · MP ${Math.round(f.mp)}/${f.maxMp}`
    : `${def?.name || f.name} · L${f.lvl} · HP ${Math.round(f.hp)}/${f.maxHp}${traits ? " · " + traits : ""}`;

  return (
    <div
      className={cls}
      title={tip}
      style={{
        position: "absolute",
        left: `${xPct}%`,
        top: `${yPct}%`,
        width: size, height: size,
        background: fac?.palette.primary || "#888",
        borderRadius: isHero ? 12 : 8,
        border: `${isHero ? 3 : 2}px solid ${f.side === "L" ? "var(--gold)" : "#3a1818"}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: isHero ? 26 : 20,
        boxShadow: isHero
          ? "0 4px 14px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(0,0,0,0.3)"
          : "0 2px 6px rgba(0,0,0,0.4)",
        zIndex: isHero ? 5 : 2,
      }}
    >
      {f.icon}
      <div style={{
        position: "absolute", bottom: -7, left: "10%", right: "10%",
        height: 4, background: "rgba(0,0,0,0.45)",
        borderRadius: 2, overflow: "hidden",
      }}>
        <div
          className="bf-hp-fill"
          style={{
            height: "100%", width: `${hpPct * 100}%`,
            background: hpPct > 0.5 ? "#5fb05f" : hpPct > 0.25 ? "#d4a84b" : "#c44a4a",
          }}
        />
      </div>
      {isHero && (
        <div style={{
          position: "absolute", top: -10,
          left: "50%", transform: "translateX(-50%)",
          fontSize: 14,
        }}>{fac?.crest}</div>
      )}
    </div>
  );
}
