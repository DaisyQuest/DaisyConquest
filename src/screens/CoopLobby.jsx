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
      overflow: "auto", padding: 24,
      display: "flex", justifyContent: "center",
    }}>
      <div className="col gap-3" style={{ maxWidth: 760, width: "100%" }}>
        <div className="row between center">
          <button className="btn btn-ghost" onClick={() => dispatch({ type: "SET_SCREEN", screen: "main" })}>
            ← Title
          </button>
          <div className="h-display" style={{ fontSize: 24 }}>🤝 Local Co-op</div>
          <div style={{ width: 80 }} />
        </div>

        <div className="panel">
          <div className="panel-title">Pass-and-play</div>
          <div className="col gap-2" style={{ fontSize: 12, color: "var(--ink-soft)", lineHeight: 1.6 }}>
            <div>
              Two players, one device. Each round, you and your partner take turns
              moving armies, recruiting troops, and managing your heroes. The
              other two houses are AI rivals.
            </div>
            <div>
              Use <span className="pill">↔ Swap Control</span> on the world map
              to hand off control between players.
            </div>
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
          style={{ alignSelf: "center", padding: "12px 32px", fontSize: 16 }}
          disabled={!ready}
          onClick={start}
        >
          ⚔ Begin Co-op Campaign
        </button>

        <div className="panel" style={{ background: "var(--bg-1)" }}>
          <div className="panel-title">Online Multiplayer</div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", fontStyle: "italic" }}>
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
    <div className="panel">
      <div className="panel-title">{title}</div>
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
                padding: 12,
                border: isMe ? "3px solid var(--gold)" : "2px solid var(--line)",
                borderRadius: 12,
                background: "var(--bg-1)",
                minWidth: 120,
                opacity: isDisabled ? 0.4 : 1,
                transform: isMe ? "translateY(-2px)" : "none",
                boxShadow: isMe ? "var(--shadow-2)" : "var(--shadow-1)",
                transition: "all 120ms",
                textAlign: "center",
              }}
            >
              <Crest faction={fid} size={48} ringed={isMe} />
              <div className="h-display" style={{ fontSize: 12, marginTop: 6 }}>{fac.short}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
