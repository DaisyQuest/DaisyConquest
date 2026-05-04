/* Upgrade — hero stats, equipment, perks, retinue, consumables.
   Three tabs (equipment / perks / consumables) on the right side panel. */
import { useState } from "react";
import { useStore } from "../core/store.jsx";
import { HEROES } from "../data/heroes.js";
import { itemsBySlot } from "../data/items.js";
import { perksByBranch } from "../data/perks.js";
import { HeroPanel } from "../components/HeroPanel.jsx";
import { UnitCard } from "../components/UnitCard.jsx";

const PERK_BRANCHES = ["war", "wisdom", "wild"];
const BRANCH_LABELS = { war: "⚔ War", wisdom: "📜 Wisdom", wild: "🌿 Wild" };

export function Upgrade() {
  const { state, dispatch } = useStore();
  const me = state.activePlayer;
  const myPlayer = state.players[me];
  const h = myPlayer.hero;
  const def = HEROES[h.id];
  const [tab, setTab] = useState("equipment");

  return (
    <div className="parchment full" style={{ overflow: "auto", padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }} className="col gap-3">
        <div className="row between center">
          <button className="btn btn-ghost" onClick={() => dispatch({ type: "SET_SCREEN", screen: "map" })}>
            ← World Map
          </button>
          <div className="h-display" style={{ fontSize: 22 }}>👑 Council Chamber</div>
          <div className="numeric h-display" style={{ fontSize: 18, color: "var(--gold-dk)" }}>
            {myPlayer.gold} gold
          </div>
        </div>

        <div className="row gap-3" style={{ alignItems: "flex-start" }}>
          <div style={{ width: 320 }}>
            <HeroPanel player={myPlayer} />
            <div className="panel" style={{ marginTop: 12 }}>
              <div className="panel-title">Retinue</div>
              <div className="col gap-1">
                {h.retinue.length === 0 && (
                  <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>Empty. Hire troops at a town.</div>
                )}
                {h.retinue.map((s, i) => (
                  <div key={i} className="row between center" style={{
                    padding: "4px 6px", background: "var(--bg-1)",
                    borderRadius: 6, border: "1px solid var(--line)",
                  }}>
                    <UnitCard unitId={s.unit} count={s.count} />
                  </div>
                ))}
              </div>
            </div>
            {def.abilities && (
              <div className="panel" style={{ marginTop: 12 }}>
                <div className="panel-title">Abilities</div>
                <div className="col gap-2">
                  {def.abilities.map((a) => (
                    <div key={a.id} className="row gap-2" style={{
                      padding: 8, background: "var(--bg-1)",
                      border: "1px solid var(--line)", borderRadius: 6,
                    }}>
                      <div style={{ fontSize: 24 }}>{a.icon}</div>
                      <div className="col flex1">
                        <div className="h-ui" style={{ fontSize: 12 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{a.effect}</div>
                        <div style={{ fontSize: 10, color: "var(--ink-faint)" }}>{a.cost} MP · {a.cd}s cooldown</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="col flex1 gap-3">
            <div className="row gap-2">
              {["equipment", "perks", "consumables"].map((t) => (
                <button
                  key={t}
                  className={`btn ${tab === t ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setTab(t)}
                >
                  {t === "equipment" ? "🗡️ Equipment" : t === "perks" ? "⭐ Perks" : "🧪 Consumables"}
                </button>
              ))}
            </div>

            {tab === "equipment" && <EquipmentTab hero={h} player={myPlayer} dispatch={dispatch} faction={me} />}
            {tab === "perks" && <PerksTab hero={h} dispatch={dispatch} faction={me} />}
            {tab === "consumables" && <ConsumablesTab hero={h} player={myPlayer} dispatch={dispatch} faction={me} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function EquipmentTab({ hero, player, dispatch, faction }) {
  const slots = ["weapon", "armor", "trinket", "mount"];
  return (
    <div className="col gap-3">
      {slots.map((slot) => {
        const equipped = hero.equipment[slot];
        const items = itemsBySlot(slot);
        return (
          <div key={slot} className="panel">
            <div className="panel-title">{slot.toUpperCase()}</div>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {items.map((item) => {
                const owned = equipped === item.id;
                const affordable = player.gold >= item.cost;
                return (
                  <div
                    key={item.id}
                    className="panel"
                    style={{
                      flex: "1 1 200px", minWidth: 200, padding: 10,
                      background: owned ? "var(--gold)" : "var(--bg-1)",
                      cursor: owned ? "default" : "pointer",
                      opacity: !owned && !affordable ? 0.6 : 1,
                    }}
                    onClick={() => !owned && affordable && dispatch({ type: "BUY_ITEM", faction, itemId: item.id })}
                  >
                    <div className="row gap-2 center">
                      <div style={{ fontSize: 24 }}>{item.icon}</div>
                      <div className="col flex1">
                        <div className="h-ui" style={{ fontSize: 12 }}>{item.name}</div>
                        <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>T{item.tier}</div>
                      </div>
                      {owned ? <span className="pill">EQUIPPED</span> : <span className="pill">{item.cost}g</span>}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 4 }}>
                      {Object.entries(item.stats).map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`).join(" · ") || "—"}
                    </div>
                    <div style={{ fontSize: 10, fontStyle: "italic", color: "var(--ink-faint)", marginTop: 2 }}>
                      {item.desc}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PerksTab({ hero, dispatch, faction }) {
  return (
    <div className="row gap-3" style={{ alignItems: "flex-start" }}>
      {PERK_BRANCHES.map((b) => (
        <div key={b} className="panel flex1">
          <div className="panel-title">{BRANCH_LABELS[b]}</div>
          <div className="col gap-2">
            {[1, 2, 3].map((tier) => (
              <div key={tier} className="col gap-1">
                <div style={{ fontSize: 10, color: "var(--ink-faint)", textTransform: "uppercase" }}>Tier {tier}</div>
                {perksByBranch(b).filter((p) => p.tier === tier).map((p) => {
                  const owned = hero.perks.includes(p.id);
                  const canTake = !owned && hero.lvl >= tier;
                  return (
                    <div
                      key={p.id}
                      onClick={() => canTake && dispatch({ type: "TAKE_PERK", faction, perkId: p.id })}
                      style={{
                        padding: 8, border: "2px solid var(--line)", borderRadius: 6,
                        cursor: canTake ? "pointer" : "default",
                        background: owned ? "var(--gold)" : "var(--bg-1)",
                        opacity: !canTake && !owned ? 0.5 : 1,
                      }}
                    >
                      <div className="row gap-2 center">
                        <div style={{ fontSize: 18 }}>{p.icon}</div>
                        <div className="col flex1">
                          <div className="h-ui" style={{ fontSize: 12 }}>{p.name}</div>
                          <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>{p.desc}</div>
                        </div>
                        {owned && <span className="pill">✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConsumablesTab({ hero, player, dispatch, faction }) {
  const items = itemsBySlot("consumable");
  const counts = {};
  for (const c of hero.consumables) counts[c] = (counts[c] || 0) + 1;
  return (
    <div className="row gap-3" style={{ flexWrap: "wrap" }}>
      {items.map((item) => {
        const owned = counts[item.id] || 0;
        const affordable = player.gold >= item.cost;
        return (
          <div key={item.id} className="panel" style={{ flex: "1 1 240px", minWidth: 240 }}>
            <div className="row gap-2 center">
              <div style={{ fontSize: 32 }}>{item.icon}</div>
              <div className="col flex1">
                <div className="h-ui" style={{ fontSize: 13 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{item.desc}</div>
              </div>
              <span className="pill">×{owned}</span>
            </div>
            <button
              className="btn full"
              disabled={!affordable}
              style={{ width: "100%", marginTop: 8, justifyContent: "center" }}
              onClick={() => dispatch({ type: "BUY_ITEM", faction, itemId: item.id })}
            >
              Buy ({item.cost}g)
            </button>
          </div>
        );
      })}
    </div>
  );
}

