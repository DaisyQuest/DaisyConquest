/* CoopLobby — multiplayer co-op landing/lobby (mocked players, real start). */
import { useState } from "react";
import { useStore } from "../core/store.jsx";
import { FACTIONS, FACTION_LIST } from "../data/factions.js";
import { Crest } from "../components/Crest.jsx";

const LORD_NAMES = ["Aldric", "Branwen", "Ceren", "Dorne"];

export function CoopLobby() {
  const { dispatch } = useStore();
  const [name] = useState("Lord " + LORD_NAMES[Math.floor(Math.random() * LORD_NAMES.length)]);
  const [code, setCode] = useState("");

  const playersInLobby = [
    { name, faction: "crown", host: true, ready: true },
    { name: "Lady Mira", faction: "thorn", host: false, ready: true },
    { name: "Yarn the Bold", faction: "tide", host: false, ready: false },
    { name: "—", faction: null, host: false, ready: false },
  ];

  const start = (coopFac) =>
    dispatch({
      type: "NEW_GAME",
      seed: Math.floor(Math.random() * 99999),
      human: "crown",
      coopWith: coopFac,
    });

  return (
    <div className="parchment full" style={{
      overflow: "auto", padding: 24,
      display: "flex", justifyContent: "center",
    }}>
      <div className="col gap-3" style={{ maxWidth: 760, width: "100%" }}>
        <div className="row between center">
          <button className="btn btn-ghost" onClick={() => dispatch({ type: "SET_SCREEN", screen: "main" })}>
            ← Title
          </button>
          <div className="h-display" style={{ fontSize: 24 }}>🤝 Co-op Campaign</div>
          <div style={{ width: 80 }} />
        </div>

        <div className="panel">
          <div className="panel-title">Quick Match</div>
          <div className="col gap-2">
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
              Two houses share one map. Take turns commanding. Each player has their
              own treasury, retinue, and territory.
            </div>
            <div className="row gap-2 center">
              <span style={{ fontSize: 12 }}>Your name:</span>
              <span className="pill">{name}</span>
              <span style={{ flex: 1 }} />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Lobby code"
                style={{
                  padding: "6px 10px", borderRadius: 6,
                  border: "2px solid var(--line)",
                  fontFamily: "var(--font-mono)",
                  background: "var(--bg-1)",
                }}
              />
              <button className="btn">Join</button>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Lobby · IRON-CROWN-7421</div>
          <div className="col gap-2">
            {playersInLobby.map((p, i) => (
              <div
                key={i}
                className="row between center"
                style={{
                  padding: "8px 12px", background: "var(--bg-1)",
                  border: "1px solid var(--line)", borderRadius: 6,
                }}
              >
                <div className="row gap-3 center">
                  {p.faction
                    ? <Crest faction={p.faction} size={32} />
                    : <div style={{ width: 32, height: 32, border: "2px dashed var(--line)", borderRadius: 6 }} />}
                  <div className="col">
                    <div className="h-ui" style={{ fontSize: 13 }}>{p.name}</div>
                    {p.faction && (
                      <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>{FACTIONS[p.faction].name}</div>
                    )}
                  </div>
                </div>
                <div className="row gap-2 center">
                  {p.host && <span className="pill">HOST</span>}
                  <span className="pill" style={{
                    background: p.ready ? "var(--green-dk)" : "var(--bg-3)",
                    color: p.ready ? "#fff" : "var(--ink)",
                  }}>
                    {p.faction ? (p.ready ? "READY" : "PICKING") : "OPEN"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Choose Your Co-op Ally</div>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            {FACTION_LIST.filter((f) => f !== "crown").map((f) => (
              <button key={f} className="btn btn-primary" onClick={() => start(f)}>
                {FACTIONS[f].crest} Begin with {FACTIONS[f].short}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
