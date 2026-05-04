/* GoldBar — top strip: round, gold, income/upkeep, navigation, end-round. */
import { useStore } from "../core/store.jsx";
import { Economy } from "../core/economy.js";
import { FACTIONS } from "../data/factions.js";
import { Crest } from "./Crest.jsx";

// Recruit and Shop are tile-scoped — they need a tileId in screenParams.
// We only enable them when the player is currently on a screen that already
// has a tile context (zone / recruit / upgrade / shop) so clicking them
// can't drop you on a "Region not found" page.
const NAV = [
  { id: "map",     label: "Map",     icon: "🗺️", needsTile: false },
  { id: "recruit", label: "Recruit", icon: "⚔️", needsTile: true },
  { id: "upgrade", label: "Hero",    icon: "👑", needsTile: false },
  { id: "shop",    label: "Shop",    icon: "🏪", needsTile: true },
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
        {NAV.map((s) => {
          const tileId = state.screenParams?.tileId;
          const disabled = s.needsTile && !tileId;
          return (
            <button
              key={s.id}
              onClick={() =>
                dispatch({
                  type: "SET_SCREEN",
                  screen: s.id,
                  params: tileId ? { tileId } : {},
                })
              }
              disabled={disabled}
              title={disabled ? "Enter a town first" : undefined}
              className={`btn ${state.screen === s.id ? "btn-primary" : "btn-ghost"}`}
              style={{ padding: "6px 12px" }}
            >
              <span style={{ fontSize: 14 }}>{s.icon}</span> {s.label}
            </button>
          );
        })}
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
