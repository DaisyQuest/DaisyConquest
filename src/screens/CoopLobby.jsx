/* CoopLobby — local pass-and-play setup for two human players sharing one
   device. Pick two houses; the rest of the kingdoms are AI rivals.

   Networked multiplayer is not implemented; rather than fake an online
   lobby, we surface that honestly and offer a clean hotseat launcher. */
import { useState } from "react";
import { useStore } from "../core/store.jsx";
import { FACTIONS, FACTION_LIST } from "../data/factions.js";
import { Crest } from "../components/Crest.jsx";

export function CoopLobby() {
  const { state, dispatch } = useStore();
  const [host, setHost] = useState(state.humanFaction || "crown");
  const [partner, setPartner] = useState(
    state.coopFaction || FACTION_LIST.find((f) => f !== (state.humanFaction || "crown")) || "thorn"
  );

  const ready = host && partner && host !== partner;

  const start = () =>
    dispatch({
      type: "NEW_GAME",
      seed: Math.floor(Math.random() * 99999),
      human: host,
      coopWith: partner,
    });

  return (
    <div className="parchment full" style={{
      overflow: "auto", padding: 16,
      display: "flex", justifyContent: "center",
    }}>
      <div className="col gap-2" style={{ maxWidth: 760, width: "100%" }}>
        <div className="row between center">
          <button className="btn btn-ghost" onClick={() => dispatch({ type: "SET_SCREEN", screen: "main" })}>
            ← Title
          </button>
          <div className="h-display" style={{ fontSize: 18 }}>🤝 Local Co-op</div>
          <div style={{ width: 60 }} />
        </div>

        <div className="panel" style={{ padding: 10 }}>
          <div className="panel-title" style={{ marginBottom: 4 }}>Pass-and-play</div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.5 }}>
            Two players, one device. Each round, you and your partner take turns
            moving armies, recruiting troops, and managing your heroes. The
            other two houses are AI rivals. Use <span className="pill">↔ Swap Control</span> on
            the world map to hand off between players.
          </div>
        </div>

        <FactionPicker
          title="Player 1"
          chosen={host}
          onPick={setHost}
          disabledIds={[partner]}
        />
        <FactionPicker
          title="Player 2"
          chosen={partner}
          onPick={setPartner}
          disabledIds={[host]}
        />

        <button
          className="btn btn-primary"
          style={{ alignSelf: "center", padding: "10px 24px", fontSize: 14 }}
          disabled={!ready}
          onClick={start}
        >
          ⚔ Begin Co-op Campaign
        </button>

        <div className="panel" style={{ background: "var(--bg-1)", padding: 8 }}>
          <div className="panel-title" style={{ marginBottom: 4 }}>Online Multiplayer</div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)", fontStyle: "italic" }}>
            Networked play across separate devices is not yet supported.
            For now, the campaign runs locally with a shared screen.
          </div>
        </div>
      </div>
    </div>
  );
}

function FactionPicker({ title, chosen, onPick, disabledIds = [] }) {
  return (
    <div className="panel" style={{ padding: 10 }}>
      <div className="panel-title" style={{ marginBottom: 6 }}>{title}</div>
      <div className="row gap-2" style={{ flexWrap: "wrap", justifyContent: "center" }}>
        {FACTION_LIST.map((fid) => {
          const fac = FACTIONS[fid];
          const isMe = chosen === fid;
          const isDisabled = disabledIds.includes(fid);
          const onKey = (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (!isDisabled) onPick(fid);
            }
          };
          return (
            <div
              key={fid}
              role="radio"
              tabIndex={isDisabled ? -1 : 0}
              aria-checked={isMe}
              aria-label={`${title} chooses ${fac.name}`}
              aria-disabled={isDisabled}
              onClick={() => !isDisabled && onPick(fid)}
              onKeyDown={onKey}
              style={{
                cursor: isDisabled ? "not-allowed" : "pointer",
                padding: 8,
                border: isMe ? "3px solid var(--gold)" : "2px solid var(--line)",
                borderRadius: 10,
                background: "var(--bg-1)",
                minWidth: 100,
                opacity: isDisabled ? 0.4 : 1,
                transform: isMe ? "translateY(-2px)" : "none",
                boxShadow: isMe ? "var(--shadow-2)" : "var(--shadow-1)",
                transition: "all 120ms",
                textAlign: "center",
              }}
            >
              <Crest faction={fid} size={40} ringed={isMe} />
              <div className="h-display" style={{ fontSize: 11, marginTop: 4 }}>{fac.short}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
