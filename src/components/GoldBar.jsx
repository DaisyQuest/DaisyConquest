/* GoldBar — top strip: round, gold, income/upkeep, navigation, end-round.
   In co-op the bar is tinted by the active player's faction palette and
   surfaces a Swap Control button so handoff is reachable from any screen
   that has the topbar. */
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
  const inCoop = !!state.coopFaction;
  // Active-player accent: thin top stripe + crest border in faction color.
  // Subtle enough not to clash with the parchment palette, strong enough
  // that you can tell at a glance whose turn it is.
  const accent = fac?.palette?.primary || "var(--gold)";

  return (
    <div
      className="topbar"
      style={{ boxShadow: `inset 0 4px 0 ${accent}, var(--shadow-1)` }}
    >
      <div className="row gap-2 center">
        <Crest faction={state.activePlayer} size={36} />
        <div className="col" style={{ lineHeight: 1 }}>
          <span className="crown">Iron Crowns</span>
          <span style={{
            fontSize: 10, color: accent,
            letterSpacing: "0.08em", textTransform: "uppercase",
            fontWeight: 700,
          }}>
            {inCoop ? `${fac.short}'s turn` : fac.short}
          </span>
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
        {inCoop && (
          <button
            className="btn btn-ghost"
            onClick={() => dispatch({ type: "SWAP_CONTROL", next: "map" })}
            title="Hand off control to your co-op partner"
          >
            ↔ Swap
          </button>
        )}
        <button className="btn btn-primary" onClick={() => dispatch({ type: "END_ROUND" })}>
          End Round ▶
        </button>
      </div>
    </div>
  );
}
