/* GoldBar — top strip: round, gold, income/upkeep, navigation, end-round.
   In co-op the bar is tinted by the active player's faction palette and
   surfaces a Swap Control button so handoff is reachable from any screen
   that has the topbar. */
import { useMemo } from "react";
import { useStore } from "../core/store.jsx";
import { Economy } from "../core/economy.js";
import { FACTIONS } from "../data/factions.js";
import { Crest } from "./Crest.jsx";
import { computeAtRiskTiles } from "../screens/Defense.jsx";

// Recruit and Shop are tile-scoped — they need a tileId in screenParams.
// We only enable them when the player is currently on a screen that already
// has a tile context (zone / recruit / upgrade / shop) so clicking them
// can't drop you on a "Region not found" page.
const NAV = [
  { id: "map",     label: "Map",     icon: "🗺️", needsTile: false },
  { id: "recruit", label: "Recruit", icon: "⚔️", needsTile: true },
  { id: "upgrade", label: "Hero",    icon: "👑", needsTile: false },
  { id: "shop",    label: "Shop",    icon: "🏪", needsTile: true },
  { id: "defense", label: "Defense", icon: "🛡️", needsTile: false },
];

export function GoldBar() {
  const { state, dispatch } = useStore();
  const me = state.players[state.activePlayer];
  const income = Economy.computeIncome(state, state.activePlayer);
  const upkeep = Economy.computeUpkeep(state, state.activePlayer);
  const fac = FACTIONS[state.activePlayer];
  const inCoop = !!state.coopFaction;
  // At-risk count drives the Defense nav badge. Recompute only when the
  // tile array or the human-controlled set changes — battles, raids, claims
  // and AI expansions all replace state.map.tiles, so this stays fresh.
  const humanIds = useMemo(
    () => [state.humanFaction, state.coopFaction].filter(Boolean),
    [state.humanFaction, state.coopFaction],
  );
  const atRiskCount = useMemo(
    () => computeAtRiskTiles(state.map.tiles, humanIds).length,
    [state.map.tiles, humanIds],
  );
  // Active-player accent: thin top stripe + crest border in faction color.
  // Subtle enough not to clash with the parchment palette, strong enough
  // that you can tell at a glance whose turn it is.
  const accent = fac?.palette?.primary || "var(--gold)";

  return (
    <div
      className="topbar"
      data-tut="topbar"
      style={{ boxShadow: `inset 0 4px 0 ${accent}, var(--shadow-1)` }}
    >
      <div className="row gap-2 center" data-tut="topbar-identity">
        <Crest faction={state.activePlayer} size={30} />
        <div className="col" style={{ lineHeight: 1 }}>
          <span className="crown" style={{ fontSize: 14 }}>Iron Crowns</span>
          <span style={{
            fontSize: 9, color: accent,
            letterSpacing: "0.08em", textTransform: "uppercase",
            fontWeight: 700,
          }}>
            {inCoop ? `${fac.short}'s turn` : fac.short}
          </span>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div className="row gap-1" data-tut="topbar-nav">
        {NAV.map((s) => {
          const tileId = state.screenParams?.tileId;
          const disabled = s.needsTile && !tileId;
          // Defense gets a special params shape: don't pass tileId because
          // the hub is global, and a stale tileId would re-trigger training
          // mode if the user happened to be on a tile-scoped screen.
          const params = s.id === "defense"
            ? {}
            : (tileId ? { tileId } : {});
          const showBadge = s.id === "defense" && atRiskCount > 0;
          const titleText = disabled
            ? "Enter a town first"
            : showBadge
              ? `${atRiskCount} holding${atRiskCount === 1 ? "" : "s"} threatened`
              : undefined;
          return (
            <button
              key={s.id}
              data-tut={`nav-${s.id}`}
              onClick={() =>
                dispatch({ type: "SET_SCREEN", screen: s.id, params })
              }
              disabled={disabled}
              title={titleText}
              className={`btn ${state.screen === s.id ? "btn-primary" : "btn-ghost"}`}
              style={{ padding: "5px 10px", position: "relative", fontSize: 12 }}
            >
              <span style={{ fontSize: 13 }}>{s.icon}</span> {s.label}
              {showBadge && (
                <span
                  className="numeric"
                  style={{
                    position: "absolute",
                    top: -4, right: -4,
                    minWidth: 16, height: 16,
                    padding: "0 4px",
                    background: "var(--blood)", color: "#fff",
                    borderRadius: 8,
                    fontSize: 10, fontWeight: 700, lineHeight: "16px",
                    boxShadow: "0 1px 0 rgba(0,0,0,0.3)",
                  }}
                >
                  {atRiskCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      <div className="row gap-2 center">
        <div
          className="row gap-2 center"
          title={`Round ${state.round} · ${me.gold}g · +${income}/r · −${upkeep}/r`}
          style={{ fontFamily: "var(--font-mono)" }}
        >
          <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>R{state.round}</span>
          <span className="h-display" style={{ fontSize: 15, color: "var(--gold-dk)" }}>{me.gold}g</span>
          <span className="col" style={{ lineHeight: 1, fontSize: 9 }}>
            <span style={{ color: "var(--ink-soft)" }}>+{income}</span>
            <span style={{ color: "var(--blood)" }}>−{upkeep}</span>
          </span>
        </div>
        {inCoop && (
          <>
            <PartnerStatus state={state} />
            <button
              className="btn btn-ghost"
              onClick={() => dispatch({ type: "SWAP_CONTROL", next: "map" })}
              title="Hand off control to your co-op partner"
              style={{ padding: "5px 10px", fontSize: 12 }}
            >
              ↔ Swap
            </button>
          </>
        )}
        <button
          className="btn btn-primary"
          data-tut="end-turn"
          onClick={() => dispatch({ type: "END_TURN" })}
          title={
            inCoop
              ? "Pass turn to your partner — round advances after both end."
              : "Advance to the next round"
          }
        >
          {endTurnLabel(state)} ▶
        </button>
      </div>
    </div>
  );
}

/* In single-player or after the partner has ended, this button advances
   the world. Otherwise it hands off — and the label reflects that. */
function endTurnLabel(state) {
  if (!state.coopFaction) return "End Round";
  const partnerId =
    state.activePlayer === state.humanFaction
      ? state.coopFaction
      : state.humanFaction;
  const partnerEnded = !!state.players[partnerId]?.endedTurn;
  return partnerEnded ? "End Round" : "End My Turn";
}

function PartnerStatus({ state }) {
  const partnerId =
    state.activePlayer === state.humanFaction
      ? state.coopFaction
      : state.humanFaction;
  const partner = state.players[partnerId];
  if (!partner) return null;
  const ended = !!partner.endedTurn;
  const partnerFac = FACTIONS[partnerId];
  return (
    <div
      className="row gap-1 center"
      style={{
        fontSize: 10,
        color: "var(--ink-soft)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
      title={
        ended
          ? `${partnerFac?.short} has ended their turn — End Round will advance the world.`
          : `${partnerFac?.short} is still playing.`
      }
    >
      <span style={{ fontSize: 12 }}>{partnerFac?.crest}</span>
      <span style={{ color: ended ? "var(--green-dk)" : "var(--ink-faint)" }}>
        {ended ? "✓ ready" : "playing…"}
      </span>
    </div>
  );
}
