/* Defense — wave-based defense minigame. Click a unit in the tray, then
   click a slot to deploy it along the path. Hold the base HP until the last
   wave is cleared. */
import { useEffect, useRef, useState } from "react";
import { useStore } from "../core/store.jsx";
import { Defense } from "../systems/defense.js";
import { FACTIONS, FACTION_LIST } from "../data/factions.js";
import { UNITS } from "../data/units.js";
import { TOWN_TYPES } from "../data/map.js";

export function DefenseScreen() {
  const { state, dispatch } = useStore();
  const training = state.screenParams.training;
  // In real-mode, the tile under attack and the attacker faction live on
  // state.pendingDefense (staged at END_ROUND). In training, fall back to
  // the tile passed via screenParams and a hard-coded enemy faction.
  const tileId = training
    ? state.screenParams.tileId
    : (state.pendingDefense?.tileId ?? state.screenParams.tileId);
  const tile = state.map.tiles.find((t) => t.id === tileId);
  const me = state.activePlayer;
  const myPlayer = state.players[me];
  const enemyFaction = training
    ? "ash"
    : (state.pendingDefense?.attackerFaction || FACTION_LIST.find((f) => f !== me));

  const dsRef = useRef(null);
  if (!dsRef.current) {
    dsRef.current = Defense.init({
      defenderRetinue: myPlayer.hero.retinue.map((s) => ({ ...s })),
      attackerFaction: enemyFaction,
    });
  }
  const [ds, setDs] = useState(dsRef.current);
  const [selected, setSelected] = useState(null);
  const lastT = useRef(performance.now());

  useEffect(() => {
    if (ds.ended) return;
    let raf;
    const loop = (now) => {
      const dt = Math.min(0.1, (now - lastT.current) / 1000);
      lastT.current = now;
      setDs((prev) =>
        Defense.tick(
          {
            ...prev,
            attackers: prev.attackers.map((a) => ({ ...a })),
            defenders: prev.defenders.map((d) => ({ ...d })),
            waves: prev.waves.map((w) => ({ ...w })),
            availableDefenders: prev.availableDefenders.map((s) => ({ ...s })),
          },
          dt
        )
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds.ended]);

  const slots = Array.from({ length: 5 }, (_, i) => i);
  const placeAt = (slotIdx) => {
    if (!selected) return;
    setDs((prev) =>
      Defense.place(
        {
          ...prev,
          defenders: prev.defenders.slice(),
          availableDefenders: prev.availableDefenders.map((s) => ({ ...s })),
        },
        slotIdx,
        selected
      )
    );
  };

  const finish = () => {
    if (training) {
      dispatch({ type: "SET_SCREEN", screen: "zone", params: { tileId } });
      return;
    }
    // Real defense raid: resolve the outcome through the reducer so the
    // tile flips on a loss, victory checks fire, and pendingDefense clears.
    dispatch({
      type: "RESOLVE_DEFENSE",
      tileId,
      won: !!ds.won,
      attackerFaction: enemyFaction,
    });
  };

  const pathD = "M " + Defense.PATH.map((p) => `${p.x} ${p.y}`).join(" L ");
  const regionLabel = tile ? (TOWN_TYPES[tile.town]?.name || "Region") : "Region";

  return (
    <div className="parchment full" style={{ display: "flex", flexDirection: "column", padding: 0 }}>
      <div className="row between center" style={{
        padding: "12px 24px",
        borderBottom: "2px solid var(--line)",
        background: "var(--bg-2)",
      }}>
        <button className="btn btn-ghost" onClick={finish}>← Leave</button>
        <div className="h-display" style={{ fontSize: 18 }}>
          🛡 Defend the {regionLabel}{training ? " (Training)" : ""}
        </div>
        <div className="row gap-3 center">
          <span className="pill">Wave {Math.min(ds.waves.length, ds.waveIdx + 1)}/{ds.waves.length}</span>
          <span className="pill" style={{
            background: ds.baseHp < 30 ? "var(--blood)" : "var(--bg-3)",
            color: ds.baseHp < 30 ? "#fff" : "var(--ink)",
          }}>🏰 {ds.baseHp}</span>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", background: "linear-gradient(180deg, #b8a070, #8c7050)" }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          <path d={pathD} stroke="rgba(42,29,18,0.4)" strokeWidth="6" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <path d={pathD} stroke="#d4b885" strokeWidth="3" fill="none" strokeDasharray="2 2" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="100" cy="40" r="4" fill="var(--gold)" stroke="var(--line)" strokeWidth="0.5" />
        </svg>

        {slots.map((s) => {
          const placed = ds.defenders.find((d) => d.slotIdx === s);
          const slotX = 12 + s * 18;
          return (
            <div
              key={s}
              onClick={() => placeAt(s)}
              style={{
                position: "absolute",
                left: `${slotX}%`, top: "50%",
                transform: "translate(-50%, -50%)",
                width: 44, height: 44,
                background: placed ? FACTIONS[me].palette.primary : "rgba(255,255,255,0.2)",
                border: `2px dashed ${placed ? "var(--line)" : "rgba(42,29,18,0.5)"}`,
                borderRadius: 8,
                cursor: selected && !placed ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
                zIndex: 3,
              }}
            >
              {placed ? placed.icon : (selected ? "+" : "")}
              {placed && (
                <div style={{
                  position: "absolute", bottom: -6, left: 2, right: 2,
                  height: 3, background: "rgba(0,0,0,0.3)", borderRadius: 2,
                }}>
                  <div style={{
                    width: `${(placed.hp / placed.maxHp) * 100}%`,
                    height: "100%", background: "var(--blood)", borderRadius: 2,
                  }} />
                </div>
              )}
            </div>
          );
        })}

        {ds.attackers.map((a) => {
          const pos = Defense.pathPosAt(a.prog);
          return (
            <div
              key={a.uid}
              style={{
                position: "absolute",
                left: `${pos.x}%`, top: `${pos.y}%`,
                transform: "translate(-50%, -50%)",
                width: 28, height: 28,
                background: FACTIONS[enemyFaction].palette.primary,
                border: "2px solid var(--line)", borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14,
                zIndex: 4,
                transition: "left 60ms linear, top 60ms linear",
              }}
            >
              {a.icon}
              <div style={{ position: "absolute", bottom: -5, left: 0, right: 0, height: 2, background: "rgba(0,0,0,0.3)" }}>
                <div style={{ width: `${(a.hp / a.maxHp) * 100}%`, height: "100%", background: "var(--blood)" }} />
              </div>
            </div>
          );
        })}

        {ds.floats.map((f) => (
          <div
            key={f.id}
            className="float-up numeric"
            style={{
              position: "absolute",
              left: `${f.x}%`, top: `${f.y}%`,
              transform: "translate(-50%, -50%)",
              color: "var(--blood)", fontWeight: 800,
              textShadow: "0 1px 0 #fff", zIndex: 6,
            }}
          >{f.text}</div>
        ))}
      </div>

      <div className="row gap-2 center" style={{
        padding: "12px 24px",
        borderTop: "2px solid var(--line)",
        background: "var(--bg-2)",
      }}>
        <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>Click a unit, then click a slot to deploy.</div>
        <div className="row gap-2 flex1">
          {ds.availableDefenders.map((s) => (
            <button
              key={s.unit}
              className={`btn ${selected === s.unit ? "btn-primary" : "btn-ghost"}`}
              disabled={s.count <= 0}
              onClick={() => setSelected(selected === s.unit ? null : s.unit)}
            >
              {UNITS[s.unit].icon} {UNITS[s.unit].name} <span className="pill">×{s.count}</span>
            </button>
          ))}
        </div>
      </div>

      {ds.ended && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 50,
        }}>
          <div className="panel pop-in" style={{ padding: 32, textAlign: "center", maxWidth: 360 }}>
            <div className="h-display" style={{
              fontSize: 32,
              color: ds.won ? "var(--green-dk)" : "var(--blood)",
            }}>{ds.won ? "DEFENDED" : "FALLEN"}</div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 12 }}>
              {ds.won
                ? "The walls hold. The enemy retreats."
                : "The gates broke. The town is lost."}
            </div>
            <button className="btn btn-primary" onClick={finish}>Continue</button>
          </div>
        </div>
      )}
    </div>
  );
}
