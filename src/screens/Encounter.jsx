/* Encounter — random event with weighted outcomes. Comes from two paths:
   - mandatory (pendingEncounter set by MOVE_HERO_TO into a feature tile)
   - optional (LocalZone "Tavern Rumors" — does not claim the tile) */
import { useState } from "react";
import { useStore } from "../core/store.jsx";
import { ENCOUNTERS } from "../data/encounters.js";
import { ITEMS } from "../data/items.js";
import { UNITS } from "../data/units.js";

export function EncounterScreen() {
  const { state, dispatch } = useStore();
  const params = state.screenParams;
  const enc = ENCOUNTERS.find((e) => e.id === (params.encId || state.pendingEncounter?.encId));
  const [chosen, setChosen] = useState(null);
  const [resolved, setResolved] = useState(null);

  if (!enc) return <div style={{ padding: 40 }}>No encounter.</div>;

  const choose = (choice) => {
    setChosen(choice);
    const total = choice.outcome.roll.reduce((s, r) => s + (r.weight || 1), 0);
    let r = Math.random() * total;
    let outcome = choice.outcome.roll[0];
    for (const o of choice.outcome.roll) {
      r -= o.weight || 1;
      if (r <= 0) {
        outcome = o;
        break;
      }
    }
    setResolved(outcome.delta || {});
  };

  const apply = () => {
    const heroPerks = state.players[state.activePlayer]?.hero?.perks || [];
    let delta = resolved;
    if (heroPerks.includes("perk_envoy") && delta) {
      delta = { ...delta };
      if (typeof delta.gold === "number" && delta.gold > 0) {
        delta.gold = Math.round(delta.gold * 1.5);
      }
      if (typeof delta.heroXp === "number" && delta.heroXp > 0) {
        delta.heroXp = Math.round(delta.heroXp * 1.5);
      }
    }
    dispatch({
      type: "RESOLVE_ENCOUNTER",
      delta,
      optional: !!params.optional,
      tileId: params.tileId,
    });
  };

  return (
    <div className="parchment full" style={{
      display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div className="panel pop-in" style={{ maxWidth: 560, width: "100%", padding: 14 }}>
        <div className="row gap-2 center" style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 36 }}>{enc.icon}</div>
          <div className="h-display" style={{ fontSize: 18 }}>{enc.title}</div>
        </div>
        <div style={{
          fontSize: 13, color: "var(--ink)", marginBottom: 10,
          fontStyle: "italic", lineHeight: 1.5,
        }}>{enc.prompt}</div>

        {!chosen && (
          <div className="col gap-1">
            {enc.choices.map((c, i) => (
              <button
                key={i}
                className="btn"
                style={{ justifyContent: "flex-start", padding: "8px 12px" }}
                onClick={() => choose(c)}
              >{c.label}</button>
            ))}
          </div>
        )}

        {chosen && resolved && (
          <div className="col gap-2">
            <div className="panel slide-up" style={{ background: "var(--bg-1)", padding: 10 }}>
              <div style={{ fontSize: 13 }}>{resolved.log}</div>
              <div className="row gap-1" style={{ marginTop: 6, flexWrap: "wrap" }}>
                {resolved.gold ? (
                  <span className="pill" style={{ color: resolved.gold > 0 ? "var(--green-dk)" : "var(--blood)" }}>
                    {resolved.gold > 0 ? "+" : ""}{resolved.gold}g
                  </span>
                ) : null}
                {resolved.heroHp ? (
                  <span className="pill" style={{ color: resolved.heroHp > 0 ? "var(--green-dk)" : "var(--blood)" }}>
                    {resolved.heroHp > 0 ? "+" : ""}{resolved.heroHp} HP
                  </span>
                ) : null}
                {resolved.heroXp ? (
                  <span className="pill" style={{ color: "var(--gold-dk)" }}>
                    {resolved.heroXp > 0 ? "+" : ""}{resolved.heroXp} XP
                  </span>
                ) : null}
                {resolved.items?.map((id, idx) => (
                  <span key={idx} className="pill">+{ITEMS[id]?.icon} {ITEMS[id]?.name}</span>
                ))}
                {resolved.troops?.map((t, idx) => (
                  <span key={idx} className="pill">+{t.count}× {UNITS[t.unit]?.name}</span>
                ))}
              </div>
            </div>
            <button className="btn btn-primary" onClick={apply}>Continue</button>
          </div>
        )}
      </div>
    </div>
  );
}
