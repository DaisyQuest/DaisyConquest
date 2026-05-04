/* RoundSummary — battle aftermath, side-by-side losses + XP earned. */
import { useStore } from "../core/store.jsx";
import { FACTIONS } from "../data/factions.js";
import { UNITS } from "../data/units.js";
import { TERRAINS, TOWN_TYPES } from "../data/map.js";

export function RoundSummaryScreen() {
  const { state, dispatch } = useStore();
  const s = state.pendingSummary;
  if (!s) {
    return (
      <div style={{ padding: 40 }}>
        No summary.
        <button className="btn" onClick={() => dispatch({ type: "DISMISS_SUMMARY" })}>Continue</button>
      </div>
    );
  }
  const won = s.winner === "attacker";
  const tile = state.map.tiles.find((t) => t.id === s.tileId);
  const region = tile ? (TOWN_TYPES[tile.town]?.name || TERRAINS[tile.terrain].name) : "Unknown";

  return (
    <div className="parchment full" style={{
      display: "flex", alignItems: "center", justifyContent: "center", padding: 40,
    }}>
      <div className="panel pop-in" style={{ maxWidth: 720, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 56 }}>{won ? "🏆" : "💀"}</div>
          <div className="h-display" style={{
            fontSize: 32,
            color: won ? "var(--green-dk)" : "var(--blood)",
          }}>{won ? "VICTORY" : "DEFEAT"}</div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            The Battle of {region} · Duration {Math.round(s.duration || 0)}s
          </div>
        </div>

        <div className="row gap-3" style={{ marginBottom: 16 }}>
          <LossesPanel
            label={`${FACTIONS[s.attacker].short} (Attacker)`}
            losses={s.attackerLosses}
          />
          <LossesPanel
            label={`${FACTIONS[s.defender].short} (Defender)`}
            losses={s.defenderLosses}
          />
        </div>

        <div className="panel" style={{ background: "var(--bg-1)" }}>
          <div className="row between center">
            <span className="h-ui">Hero XP Gained</span>
            <span className="numeric h-display" style={{ color: "var(--gold-dk)", fontSize: 18 }}>
              +{Math.round(s.xp)}
            </span>
          </div>
        </div>

        <button
          className="btn btn-primary full"
          style={{ width: "100%", justifyContent: "center", marginTop: 16 }}
          onClick={() => dispatch({ type: "DISMISS_SUMMARY" })}
        >Continue</button>
      </div>
    </div>
  );
}

function LossesPanel({ label, losses }) {
  return (
    <div className="panel flex1" style={{ background: "var(--bg-1)" }}>
      <div className="panel-title">{label}</div>
      <div className="col gap-1">
        {(!losses || losses.length === 0) && (
          <div style={{ fontSize: 12, color: "var(--green-dk)" }}>No losses.</div>
        )}
        {losses?.map((l, i) => (
          <div key={i} className="row between" style={{ fontSize: 12 }}>
            <span>{UNITS[l.unit]?.icon} {UNITS[l.unit]?.name}</span>
            <span className="numeric" style={{ color: "var(--blood)" }}>−{l.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
