/* Victory — game-over screen. Shown when one faction remains, or when the
   human is the last to fall. Mirrors RoundSummary's parchment + pop-in panel
   style: h-display headers, pill stats, no new design tokens. */
import { useStore } from "../core/store.jsx";
import { FACTIONS, FACTION_LIST } from "../data/factions.js";
import { Crest } from "../components/Crest.jsx";

export function VictoryScreen() {
  const { state, dispatch } = useStore();
  const pv = state.pendingVictory;

  const winner = pv?.winner ? FACTIONS[pv.winner] : null;
  const totalRounds = pv?.round ?? state.round;

  const tileCounts = FACTION_LIST.map((fid) => ({
    fid,
    fac: FACTIONS[fid],
    count: state.map.tiles.filter((t) => t.owner === fid).length,
    defeated: state.players[fid]?.defeated,
  })).sort((a, b) => b.count - a.count);

  const newCampaign = () =>
    dispatch({
      type: "NEW_GAME",
      seed: Math.floor(Math.random() * 99999),
      human: state.humanFaction,
      coopWith: state.coopFaction,
    });
  const titleScreen = () => dispatch({ type: "SET_SCREEN", screen: "main" });

  const headline = winner
    ? `VICTORY OF HOUSE ${winner.short.toUpperCase()}`
    : "ALL THRONES LOST";
  const blurb = winner
    ? `${winner.motto}`
    : "The crown lies in the dust. No house remains to lift it.";

  return (
    <div className="parchment full" style={{
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div className="panel pop-in" style={{ maxWidth: 680, width: "100%", padding: 14 }}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 40 }}>{winner ? "👑" : "💀"}</div>
          <div className="h-display" style={{
            fontSize: 24,
            color: winner ? "var(--gold-dk)" : "var(--blood)",
            letterSpacing: "0.06em",
          }}>{headline}</div>
          <div style={{ fontSize: 12, color: "var(--ink-soft)", fontStyle: "italic", marginTop: 2 }}>
            {blurb}
          </div>
        </div>

        {winner && (
          <div className="row gap-2 center" style={{ justifyContent: "center", marginBottom: 8 }}>
            <Crest faction={winner.id} size={56} ringed />
            <div className="col" style={{ textAlign: "left", lineHeight: 1.2 }}>
              <div className="h-display" style={{ fontSize: 15 }}>{winner.name}</div>
              <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                Crowned in Round {totalRounds}
              </div>
            </div>
          </div>
        )}

        <div className="row gap-2 center" style={{ justifyContent: "center", marginBottom: 8 }}>
          <span className="pill">Rounds: {totalRounds}</span>
          <span className="pill">Houses Standing: {tileCounts.filter((t) => !t.defeated).length}</span>
        </div>

        <div className="panel" style={{ background: "var(--bg-1)", marginBottom: 10, padding: 8 }}>
          <div className="panel-title" style={{ marginBottom: 4 }}>Final Holdings</div>
          <div className="col" style={{ lineHeight: 1.4 }}>
            {tileCounts.map((t) => (
              <div key={t.fid} className="row between center" style={{ fontSize: 12 }}>
                <span className="row gap-2 center">
                  <Crest faction={t.fid} size={20} />
                  <span style={{
                    textDecoration: t.defeated ? "line-through" : "none",
                    color: t.defeated ? "var(--ink-soft)" : "var(--ink)",
                  }}>{t.fac.short}</span>
                  {t.defeated && (
                    <span className="pill" style={{ fontSize: 9 }}>fallen</span>
                  )}
                </span>
                <span className="numeric h-display" style={{
                  color: t.count > 0 ? "var(--ink)" : "var(--ink-soft)",
                  fontSize: 14,
                }}>{t.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="row gap-2 center" style={{ justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={newCampaign}>
            ⚔ New Campaign
          </button>
          <button className="btn btn-ghost" onClick={titleScreen}>
            Title Screen
          </button>
        </div>
      </div>
    </div>
  );
}
