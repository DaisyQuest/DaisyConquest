/* Battle — auto-battle with an organic battlefield feel.
   - Units sit in lane bands but jitter within their band so the formation
     reads like a press of soldiers rather than three conga lines.
   - Per-fighter jitter is stamped at spawn (stable thereafter).
   - The RAF loop reads speed/paused via refs so changing them doesn't
     re-subscribe and bind to a stale `bs` (the demo had a bug where 5×
     reverted to 1× after one frame).
   - At high speeds we sub-step in 50ms slices for stable physics. */
import { useEffect, useRef, useState } from "react";
import { useStore } from "../core/store.jsx";
import { CONST } from "../core/constants.js";
import { Battle } from "../systems/battle.js";
import { FACTIONS } from "../data/factions.js";
import { TERRAINS, TOWN_TYPES } from "../data/map.js";
import { Crest } from "../components/Crest.jsx";

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

  const battleTitle = TOWN_TYPES[tile.town]?.name || TERRAINS[tile.terrain].name;

  return (
    <div className="parchment full" style={{ display: "flex", flexDirection: "column", padding: 0, position: "relative" }}>
      <div className="row between center" style={{
        padding: "10px 24px",
        borderBottom: "3px solid var(--line)",
        background: "var(--bg-2)",
        gap: 16,
      }}>
        <div className="row gap-3 center" style={{ minWidth: 240 }}>
          <Crest faction={attacker} size={42} />
          <div className="col flex1">
            <div className="h-display" style={{ fontSize: 14 }}>{FACTIONS[attacker].short}</div>
            <div className="bar bar-hp" style={{ height: 10 }}>
              <div style={{ width: `${(lHp / Math.max(1, lMax)) * 100}%`, background: "var(--gold)" }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>{Math.round(lHp)} / {lMax} strength</div>
          </div>
        </div>
        <div className="h-display" style={{ fontSize: 20, textAlign: "center", flex: 1 }}>
          ⚔ Battle for {battleTitle}
        </div>
        <div className="row gap-3 center" style={{ minWidth: 240, flexDirection: "row-reverse" }}>
          <Crest faction={defender} size={42} />
          <div className="col flex1" style={{ textAlign: "right" }}>
            <div className="h-display" style={{ fontSize: 14 }}>{FACTIONS[defender].short}</div>
            <div className="bar bar-hp" style={{ height: 10 }}>
              <div style={{ width: `${(rHp / Math.max(1, rMax)) * 100}%`, background: "var(--blood)" }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>{Math.round(rHp)} / {rMax} strength</div>
          </div>
        </div>
      </div>

      <div className="battlefield" style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div className="bf-bg" />
        <div className="bf-haze" />

        {lanes.map((lane) => (
          <div key={"band" + lane} className="bf-band" style={{ top: `${lane * 33.33 + 1.5}%`, height: "30%" }}>
            <div className="bf-band-label">{LANE_NAMES[lane]}</div>
          </div>
        ))}

        <div className="bf-divider" />

        {bs.fighters.filter((f) => f.alive).map((f) => (
          <BattleFighter key={f.uid} f={f} laneLen={LANE_LEN} />
        ))}

        {bs.floats.map((fl) => {
          const yPct = (fl.lane + 0.5) * 33.33 + (fl.jitterY || 0) * 12;
          return (
            <div
              key={fl.id}
              className="float-up numeric"
              style={{
                position: "absolute",
                left: `${(fl.x / LANE_LEN) * 100}%`,
                top: `${yPct}%`,
                transform: "translate(-50%, -50%)",
                fontWeight: 800,
                fontSize: 20,
                color: fl.side === "L" ? "#ffe9b3" : "#ffb3b3",
                textShadow: "0 0 4px rgba(0,0,0,0.6), 0 2px 0 rgba(0,0,0,0.5)",
                pointerEvents: "none",
              }}
            >{fl.text}</div>
          );
        })}
      </div>

      <div className="row gap-3 center" style={{
        padding: "12px 24px",
        borderTop: "3px solid var(--line)",
        background: "var(--bg-2)",
      }}>
        <div className="row gap-2 center">
          <div style={{
            width: 60, height: 60, borderRadius: 12,
            background: FACTIONS[attacker].palette.primary,
            border: "3px solid var(--gold)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 34,
          }}>{heroL?.icon || "👑"}</div>
          <div className="col" style={{ minWidth: 150 }}>
            <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>HP {Math.round(heroL?.hp || 0)}/{heroL?.maxHp || 0}</div>
            <div className="bar bar-hp">
              <div style={{ width: `${((heroL?.hp || 0) / (heroL?.maxHp || 1)) * 100}%` }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 2 }}>MP {Math.round(heroL?.mp || 0)}/{heroL?.maxMp || 0}</div>
            <div className="bar bar-mp">
              <div style={{ width: `${((heroL?.mp || 0) / (heroL?.maxMp || 1)) * 100}%` }} />
            </div>
          </div>
        </div>
        <div className="row gap-2 flex1" style={{ flexWrap: "wrap" }}>
          {(heroL?.abilities || []).map((a) => {
            const cd = heroL.cooldowns?.[a.id] || 0;
            const ready = heroL.mp >= a.cost && cd <= 0 && heroL.alive;
            return (
              <button
                key={a.id}
                className={`btn ${ready ? "btn-primary" : "btn-ghost"}`}
                disabled={!ready}
                onClick={() => cast(a.id)}
              >
                <span style={{ fontSize: 20 }}>{a.icon}</span>
                <div className="col" style={{ alignItems: "flex-start", lineHeight: 1.1 }}>
                  <span style={{ fontSize: 13 }}>{a.name}</span>
                  <span style={{ fontSize: 10 }}>{cd > 0 ? `${cd.toFixed(1)}s` : `${a.cost} MP`}</span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="row gap-1">
          <button className="btn btn-ghost" onClick={() => setPaused((p) => !p)}>{paused ? "▶" : "⏸"}</button>
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              className={`btn ${speed === s ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setSpeed(s)}
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

function BattleFighter({ f, laneLen }) {
  const fac = FACTIONS[f.fac];
  const isHero = f.kind === "hero";
  const size = isHero ? 52 : 38;
  const yPct = (f.lane + 0.5) * 33.33 + (f.jitterY || 0) * 12;
  const xPct = ((f.x + (f.jitterX || 0)) / laneLen) * 100;
  const hpPct = f.hp / f.maxHp;
  return (
    <div style={{
      position: "absolute",
      left: `${xPct}%`,
      top: `${yPct}%`,
      transform: "translate(-50%, -50%)",
      width: size, height: size,
      background: fac?.palette.primary || "#888",
      borderRadius: isHero ? 12 : 8,
      border: `${isHero ? 3 : 2}px solid ${f.side === "L" ? "var(--gold)" : "#3a1818"}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: isHero ? 26 : 20,
      boxShadow: isHero
        ? "0 4px 14px rgba(0,0,0,0.5), inset 0 -2px 4px rgba(0,0,0,0.3)"
        : "0 2px 6px rgba(0,0,0,0.4)",
      transition: "left 90ms linear, top 220ms ease",
      zIndex: isHero ? 5 : 2,
    }}>
      {f.icon}
      <div style={{
        position: "absolute", bottom: -7, left: "10%", right: "10%",
        height: 4, background: "rgba(0,0,0,0.45)",
        borderRadius: 2, overflow: "hidden",
      }}>
        <div style={{
          height: "100%", width: `${hpPct * 100}%`,
          background: hpPct > 0.5 ? "#5fb05f" : hpPct > 0.25 ? "#d4a84b" : "#c44a4a",
        }} />
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
