/* MainMenu — title screen. Pick your house, optionally a co-op ally,
   begin a fresh campaign or continue from save. Also surfaces the
   tutorial preference: suppress all guided overlays, or reset progress
   so they show again on the next visit. */
import { useEffect, useState } from "react";
import { useStore } from "../core/store.jsx";
import { FACTIONS, FACTION_LIST } from "../data/factions.js";
import { Crest } from "../components/Crest.jsx";
import { TutorialOverlay } from "../components/TutorialOverlay.jsx";
import {
  isSuppressed, setSuppressed, resetTutorials, subscribe,
} from "../core/tutorial.js";

export function MainMenu() {
  const { state, dispatch } = useStore();
  const [chosen, setChosen] = useState(state.humanFaction || "crown");
  const [coop, setCoop] = useState(state.coopFaction || null);
  const [suppress, setSuppress] = useState(isSuppressed());

  // Keep the toggle in sync if state changes externally (e.g. user clicks
  // "Don't show again" inside an overlay then bounces back to the menu).
  useEffect(() => subscribe(() => setSuppress(isSuppressed())), []);

  const startNew = () =>
    dispatch({
      type: "NEW_GAME",
      seed: Math.floor(Math.random() * 99999),
      human: chosen,
      coopWith: coop,
    });
  const continueGame = () => dispatch({ type: "SET_SCREEN", screen: "map" });

  const tutorialSteps = [
    {
      selector: "[data-tut='house-picker']",
      side: "bottom",
      title: "Choose your house",
      body: "Each kingdom has its own roster, hero, and motto. The pick locks in for the whole campaign — you'll command this faction's troops on every turn.",
    },
    {
      selector: "[data-tut='campaign-actions']",
      side: "top",
      title: "Begin or continue",
      body: "Begin Campaign starts a fresh seed. Continue resumes your last save. The Multiplayer Lobby spins up a local pass-and-play coop game.",
    },
    {
      selector: "[data-tut='tutorial-prefs']",
      side: "top",
      title: "Tutorial preferences",
      body: "Tick Suppress to hide all guided arrows, or hit Reset to replay them next time you visit each screen. Every overlay also has a Hide-all button.",
    },
  ];

  return (
    <div className="parchment full" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <TutorialOverlay stepId="main.intro" steps={tutorialSteps} />
      <div className="col gap-3" style={{ maxWidth: 720, width: "100%", textAlign: "center" }}>
        <div className="h-display" style={{ fontSize: 44, letterSpacing: "0.08em", color: "var(--ink)" }}>Iron Crowns</div>
        <div style={{ fontSize: 14, color: "var(--ink-soft)", marginTop: -6, fontStyle: "italic" }}>
          Four houses. One throne. Take what is yours.
        </div>

        <div className="panel slide-up" data-tut="house-picker" style={{ marginTop: 8, padding: 12 }}>
          <div className="panel-title" style={{ marginBottom: 8 }}>Choose Your House</div>
          <div className="row gap-2" style={{ justifyContent: "center", flexWrap: "wrap" }}>
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
                    cursor: "pointer", padding: 10,
                    border: isMe ? "3px solid var(--gold)" : "2px solid var(--line)",
                    borderRadius: 10, background: "var(--bg-1)", minWidth: 120,
                    transform: isMe ? "translateY(-2px)" : "none",
                    boxShadow: isMe ? "var(--shadow-2)" : "var(--shadow-1)",
                    transition: "all 120ms",
                  }}
                >
                  <Crest faction={fid} size={44} ringed={isMe} />
                  <div className="h-display" style={{ fontSize: 12, marginTop: 6 }}>{fac.short}</div>
                  <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 2, fontStyle: "italic" }}>{fac.motto}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel" style={{ padding: 10 }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>Co-op Ally (optional)</div>
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
            <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>
              Both houses share the map. You&apos;ll command them in turn.
            </div>
          )}
        </div>

        <div className="row gap-2 center" data-tut="campaign-actions" style={{ justifyContent: "center", marginTop: 4, flexWrap: "wrap" }}>
          <button className="btn btn-primary" data-tut="begin-campaign" style={{ fontSize: 14, padding: "10px 24px" }} onClick={startNew}>
            ⚔ Begin Campaign
          </button>
          <button className="btn" onClick={continueGame}>Continue</button>
          <button className="btn btn-ghost" onClick={() => dispatch({ type: "SET_SCREEN", screen: "coop" })}>
            🤝 Multiplayer Lobby
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "glossary" })}
            title="Browse heroes, armies, and wilderness encounters"
          >
            📖 Bestiary
          </button>
        </div>

        <div
          className="panel"
          data-tut="tutorial-prefs"
          style={{
            padding: "5px 10px", marginTop: 2,
            display: "flex", alignItems: "center",
            justifyContent: "space-between", gap: 8,
            fontSize: 11,
          }}
        >
          <label
            className="row gap-2 center"
            style={{ cursor: "pointer", userSelect: "none" }}
            title="Hide all guided arrows. You can re-enable from this screen anytime."
          >
            <input
              type="checkbox"
              checked={suppress}
              onChange={(e) => {
                setSuppress(e.target.checked);
                setSuppressed(e.target.checked);
              }}
              style={{ accentColor: "var(--gold-dk)" }}
            />
            <span style={{ color: "var(--ink)" }}>Suppress tutorials</span>
          </label>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 10, padding: "2px 8px" }}
            onClick={() => {
              resetTutorials();
              setSuppress(false);
            }}
            title="Forget which tutorials you've seen — they'll appear again."
          >
            ↺ Reset
          </button>
        </div>
      </div>
    </div>
  );
}
