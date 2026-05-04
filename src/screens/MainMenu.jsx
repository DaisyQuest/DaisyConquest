/* MainMenu — title screen. Pick your house, optionally a co-op ally,
   begin a fresh campaign or continue from save. */
import { useState } from "react";
import { useStore } from "../core/store.jsx";
import { FACTIONS, FACTION_LIST } from "../data/factions.js";
import { Crest } from "../components/Crest.jsx";

export function MainMenu() {
  const { state, dispatch } = useStore();
  const [chosen, setChosen] = useState(state.humanFaction || "crown");
  const [coop, setCoop] = useState(state.coopFaction || null);

  const startNew = () =>
    dispatch({
      type: "NEW_GAME",
      seed: Math.floor(Math.random() * 99999),
      human: chosen,
      coopWith: coop,
    });
  const continueGame = () => dispatch({ type: "SET_SCREEN", screen: "map" });

  return (
    <div className="parchment full" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div className="col gap-4" style={{ maxWidth: 720, width: "100%", textAlign: "center" }}>
        <div className="h-display" style={{ fontSize: 56, letterSpacing: "0.08em", color: "var(--ink)" }}>Iron Crowns</div>
        <div style={{ fontSize: 16, color: "var(--ink-soft)", marginTop: -8, fontStyle: "italic" }}>
          Four houses. One throne. Take what is yours.
        </div>

        <div className="panel slide-up" style={{ marginTop: 20 }}>
          <div className="panel-title">Choose Your House</div>
          <div className="row gap-3" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            {FACTION_LIST.map((fid) => {
              const fac = FACTIONS[fid];
              const isMe = chosen === fid;
              const onKey = (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setChosen(fid);
                }
              };
              return (
                <div
                  key={fid}
                  role="radio"
                  tabIndex={0}
                  aria-checked={isMe}
                  aria-label={`Choose ${fac.name}`}
                  onClick={() => setChosen(fid)}
                  onKeyDown={onKey}
                  style={{
                    cursor: "pointer", padding: 14,
                    border: isMe ? "3px solid var(--gold)" : "2px solid var(--line)",
                    borderRadius: 12, background: "var(--bg-1)", minWidth: 140,
                    transform: isMe ? "translateY(-3px)" : "none",
                    boxShadow: isMe ? "var(--shadow-2)" : "var(--shadow-1)",
                    transition: "all 120ms",
                  }}
                >
                  <Crest faction={fid} size={56} ringed={isMe} />
                  <div className="h-display" style={{ fontSize: 13, marginTop: 8 }}>{fac.short}</div>
                  <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 2, fontStyle: "italic" }}>{fac.motto}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Co-op Ally (optional)</div>
          <div className="row gap-2 center" style={{ justifyContent: "center", flexWrap: "wrap" }}>
            <button className={`btn ${coop === null ? "btn-primary" : "btn-ghost"}`} onClick={() => setCoop(null)}>Solo</button>
            {FACTION_LIST.filter((f) => f !== chosen).map((fid) => (
              <button
                key={fid}
                className={`btn ${coop === fid ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setCoop(fid)}
              >
                {FACTIONS[fid].crest} {FACTIONS[fid].short}
              </button>
            ))}
          </div>
          {coop && (
            <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 8 }}>
              Both houses share the map. You&apos;ll command them in turn.
            </div>
          )}
        </div>

        <div className="row gap-3 center" style={{ justifyContent: "center", marginTop: 8 }}>
          <button className="btn btn-primary" style={{ fontSize: 16, padding: "12px 32px" }} onClick={startNew}>
            ⚔ Begin Campaign
          </button>
          <button className="btn" onClick={continueGame}>Continue</button>
          <button className="btn btn-ghost" onClick={() => dispatch({ type: "SET_SCREEN", screen: "coop" })}>
            🤝 Multiplayer Lobby
          </button>
        </div>
      </div>
    </div>
  );
}
