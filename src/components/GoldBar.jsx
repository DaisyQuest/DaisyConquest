/* GoldBar — top strip: round, gold, income/upkeep, navigation, end-round. */
import { useStore } from "../core/store.jsx";
import { Economy } from "../core/economy.js";
import { FACTIONS } from "../data/factions.js";
import { Crest } from "./Crest.jsx";

const NAV = [
  { id: "map",     label: "Map",     icon: "🗺️" },
  { id: "recruit", label: "Recruit", icon: "⚔️" },
  { id: "upgrade", label: "Hero",    icon: "👑" },
  { id: "shop",    label: "Shop",    icon: "🏪" },
];

export function GoldBar() {
  const { state, dispatch } = useStore();
  const me = state.players[state.activePlayer];
  const income = Economy.computeIncome(state, state.activePlayer);
  const upkeep = Economy.computeUpkeep(state, state.activePlayer);
  const fac = FACTIONS[state.activePlayer];

  return (
    <div className="topbar">
      <div className="row gap-2 center">
        <Crest faction={state.activePlayer} size={36} />
        <div className="col" style={{ lineHeight: 1 }}>
          <span className="crown">Iron Crowns</span>
          <span style={{
            fontSize: 10, color: "var(--ink-soft)",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>{fac.short}</span>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div className="row gap-2">
        {NAV.map((s) => (
          <button
            key={s.id}
            onClick={() => dispatch({ type: "SET_SCREEN", screen: s.id })}
            className={`btn ${state.screen === s.id ? "btn-primary" : "btn-ghost"}`}
            style={{ padding: "6px 12px" }}
          >
            <span style={{ fontSize: 14 }}>{s.icon}</span> {s.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div className="row gap-3 center">
        <div className="col" style={{ lineHeight: 1.1 }}>
          <span style={{ fontSize: 10, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Round</span>
          <span className="numeric h-display" style={{ fontSize: 16 }}>{state.round}</span>
        </div>
        <div style={{ width: 1, height: 30, background: "var(--line)", opacity: 0.4 }} />
        <div className="col" style={{ lineHeight: 1.1 }}>
          <span style={{ fontSize: 10, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.08em" }}>Gold</span>
          <span className="numeric h-display" style={{ fontSize: 16, color: "var(--gold-dk)" }}>{me.gold}</span>
        </div>
        <div className="col" style={{ lineHeight: 1.1, fontSize: 10, color: "var(--ink-soft)" }}>
          <span>+{income}/r</span>
          <span style={{ color: "var(--blood)" }}>−{upkeep}/r</span>
        </div>
        <button className="btn btn-primary" onClick={() => dispatch({ type: "END_ROUND" })}>
          End Round ▶
        </button>
      </div>
    </div>
  );
}
