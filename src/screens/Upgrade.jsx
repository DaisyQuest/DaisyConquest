/* Upgrade — hero stats, equipment, perks, retinue, consumables.
   Three tabs (equipment / perks / consumables) on the right side panel. */
import { useState } from "react";
import { useStore } from "../core/store.jsx";
import { HEROES } from "../data/heroes.js";
import { ITEMS, itemsBySlot, RARITY_META, RARITY_ORDER } from "../data/items.js";
import { perksByBranch } from "../data/perks.js";
import {
  UNITS,
  PROMOTIONS,
  STACK_LEVEL_CAP,
  xpForStackLevel,
  promotionCost,
} from "../data/units.js";
import { FACTIONS } from "../data/factions.js";
import { HeroPanel } from "../components/HeroPanel.jsx";
import { UnitCard } from "../components/UnitCard.jsx";
import { TutorialOverlay } from "../components/TutorialOverlay.jsx";

const PERK_BRANCHES = ["war", "wisdom", "wild"];
const BRANCH_LABELS = { war: "⚔ War", wisdom: "📜 Wisdom", wild: "🌿 Wild" };

export function Upgrade() {
  const { state, dispatch } = useStore();
  const me = state.activePlayer;
  const myPlayer = state.players[me];
  const h = myPlayer.hero;
  const def = HEROES[h.id];
  const [tab, setTab] = useState("equipment");

  const tutorialSteps = [
    {
      selector: "[data-tut='upgrade-tabs']",
      side: "bottom",
      title: "Council Chamber tabs",
      body: "Equipment manages your hero's gear, inventory stash, and the rarity-tiered marketplace. Perks pick a talent each tier (3 branches × 4 tiers; T4 capstones unlock at hero L4). Consumables stockpile potions.",
    },
    {
      selector: "[data-tut='tab-army']",
      side: "bottom",
      title: "Army formation",
      body: "Open Army to assign each retinue stack to a lane (Vanguard / Center / Reserve) before battle. Auto-balanced if you don't pick.",
    },
  ];

  return (
    <div className="parchment full" style={{ overflow: "hidden", padding: 16, display: "flex", flexDirection: "column" }}>
      <TutorialOverlay stepId="upgrade.intro" steps={tutorialSteps} />
      <div style={{ maxWidth: 1240, width: "100%", margin: "0 auto", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }} className="gap-2">
        <div className="row between center" style={{ marginBottom: 4 }}>
          <button className="btn btn-ghost" onClick={() => dispatch({ type: "SET_SCREEN", screen: "map" })}>
            ← World Map
          </button>
          <div className="h-display" style={{ fontSize: 18 }}>👑 Council Chamber</div>
          <div className="numeric h-display" style={{ fontSize: 16, color: "var(--gold-dk)" }}>
            {myPlayer.gold} gold
          </div>
        </div>

        <div className="row gap-2" style={{ alignItems: "flex-start", flex: 1, minHeight: 0 }}>
          <div className="col gap-2" style={{ width: 300, height: "100%", overflowY: "auto" }}>
            <HeroPanel player={myPlayer} />
            <div className="panel">
              <div className="panel-title">Retinue</div>
              <div className="col gap-1">
                {h.retinue.length === 0 && (
                  <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>Empty. Hire troops at a town.</div>
                )}
                {h.retinue.map((s, i) => (
                  <RetinueRow
                    key={`${s.unit}-${i}`}
                    stack={s}
                    stackIndex={i}
                    playerGold={myPlayer.gold}
                    faction={me}
                    dispatch={dispatch}
                  />
                ))}
              </div>
            </div>
            {def.abilities && (
              <div className="panel">
                <div className="panel-title">Abilities</div>
                <div className="col gap-1">
                  {def.abilities.map((a) => (
                    <div key={a.id} className="row gap-2" style={{
                      padding: "4px 8px", background: "var(--bg-1)",
                      border: "1px solid var(--line)", borderRadius: 6,
                    }}>
                      <div style={{ fontSize: 18 }}>{a.icon}</div>
                      <div className="col flex1" style={{ lineHeight: 1.2, minWidth: 0 }}>
                        <div className="h-ui" style={{ fontSize: 11, fontWeight: 700 }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>{a.effect}</div>
                        <div style={{ fontSize: 9, color: "var(--ink-faint)" }}>{a.cost} MP · {a.cd}s</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="col flex1 gap-2" style={{ height: "100%", minWidth: 0 }}>
            <div className="row gap-2 tab-strip" data-tut="upgrade-tabs">
              {["equipment", "perks", "army", "consumables"].map((t) => (
                <button
                  key={t}
                  data-tut={`tab-${t}`}
                  className={`btn ${tab === t ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setTab(t)}
                >
                  {t === "equipment" ? "🗡️ Equipment"
                    : t === "perks" ? "⭐ Perks"
                    : t === "army" ? "⚔ Army"
                    : "🧪 Consumables"}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              {tab === "equipment" && <EquipmentTab hero={h} player={myPlayer} dispatch={dispatch} faction={me} />}
              {tab === "perks" && <PerksTab hero={h} dispatch={dispatch} faction={me} />}
              {tab === "army" && <ArmyTab hero={h} dispatch={dispatch} faction={me} />}
              {tab === "consumables" && <ConsumablesTab hero={h} player={myPlayer} dispatch={dispatch} faction={me} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Slot list — must mirror src/data/items.js slot vocab. */
const EQUIP_SLOTS = [
  { id: "weapon",  label: "Weapon",  icon: "🗡️" },
  { id: "armor",   label: "Armor",   icon: "🛡️" },
  { id: "trinket", label: "Trinket", icon: "📿" },
  { id: "mount",   label: "Mount",   icon: "🐎" },
];

/* Pretty-print an item's stat block. */
function statsLine(item) {
  return Object.entries(item.stats || {})
    .map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`)
    .join(" · ");
}

/* Pretty-print equipment effects in plain English. */
function effectLines(item) {
  const out = [];
  for (const eff of item.effects || []) {
    if (eff.kind === "passiveStat") {
      const parts = Object.entries(eff.mul || {}).map(([k, v]) =>
        `${k.toUpperCase()} ×${v.toFixed(2)}`);
      out.push(`Passive: ${parts.join(", ")}`);
    } else if (eff.kind === "onCrit") {
      out.push(`On crit: +${eff.action.value} ${eff.action.type}`);
    } else if (eff.kind === "onKill") {
      out.push(`On kill: +${eff.action.value} ${eff.action.type}`);
    } else if (eff.kind === "onLowHP") {
      const parts = Object.entries(eff.mul || {}).map(([k, v]) =>
        `${k.toUpperCase()} ×${v.toFixed(2)}`);
      out.push(`Below ${Math.round(eff.below * 100)}% HP: ${parts.join(", ")}`);
    } else if (eff.kind === "perRound") {
      out.push(`+${eff.action.value} ${eff.action.type}/round`);
    } else if (eff.kind === "grantTrait") {
      out.push(`Grants trait: ${eff.trait}`);
    } else if (eff.kind === "damageVs") {
      out.push(`+${Math.round(eff.value * 100)}% damage vs ${eff.target}`);
    }
  }
  return out;
}

/* A rarity-colored item card. `mode` controls the action button.
   - "equip"     — currently in inventory; primary action equips it
   - "equipped"  — currently in a slot; primary action unequips
   - "buy"       — marketplace; primary action purchases */
function ItemCard({ item, mode, disabled, onPrimary, onSecondary, secondaryLabel }) {
  const meta = RARITY_META[item.rarity] || RARITY_META.common;
  const stats = statsLine(item);
  const effects = effectLines(item);
  const accent = meta.color;
  return (
    <div
      title={item.desc}
      style={{
        padding: "8px 10px",
        borderRadius: 8,
        border: `2px solid ${accent}`,
        background: `linear-gradient(180deg, ${accent}14 0%, var(--bg-1) 60%)`,
        display: "flex", flexDirection: "column", gap: 4,
        opacity: disabled ? 0.5 : 1,
        position: "relative",
      }}
    >
      <div className="row gap-2 center">
        <div style={{
          width: 36, height: 36, flexShrink: 0,
          borderRadius: 6,
          background: "var(--bg-2)",
          border: `1px solid ${accent}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20,
        }}>{item.icon}</div>
        <div className="col flex1" style={{ minWidth: 0, lineHeight: 1.2 }}>
          <div className="h-ui" style={{ fontSize: 12, fontWeight: 700 }}>
            {item.name}
          </div>
          <div style={{
            fontSize: 9, color: accent,
            textTransform: "uppercase", letterSpacing: "0.06em",
            fontWeight: 700,
          }}>
            {meta.label} · {item.slot}
          </div>
        </div>
      </div>
      {stats && (
        <div style={{
          fontSize: 10, color: "var(--ink-soft)",
          fontFamily: "var(--font-mono)",
        }}>{stats}</div>
      )}
      {effects.map((line, i) => (
        <div key={i} style={{
          fontSize: 10, color: accent, fontStyle: "italic", lineHeight: 1.3,
        }}>
          ✦ {line}
        </div>
      ))}
      <div style={{ fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.3 }}>
        {item.desc}
      </div>
      <div className="row gap-1" style={{ marginTop: 4 }}>
        <button
          className={mode === "equipped" ? "btn btn-ghost" : "btn btn-primary"}
          disabled={disabled}
          onClick={onPrimary}
          style={{ flex: 1, padding: "4px 8px", fontSize: 11 }}
        >
          {mode === "equip"    ? "Equip"
           : mode === "equipped" ? "Unequip"
           : `Buy · ${item.cost}g`}
        </button>
        {onSecondary && (
          <button
            className="btn btn-ghost"
            onClick={onSecondary}
            style={{ padding: "4px 8px", fontSize: 11 }}
          >
            {secondaryLabel || "Sell"}
          </button>
        )}
      </div>
    </div>
  );
}

/* Inventory tab: equipped slot row at the top, the player's stash in the
   middle, the marketplace below. The marketplace lists every non-consumable
   item — purchases drop into the stash, then the player equips/swaps from
   there in two distinct steps. */
function EquipmentTab({ hero, player, dispatch, faction }) {
  const inventory = hero.inventory || [];
  const inventorySorted = [...inventory].sort((a, b) => {
    const ra = RARITY_ORDER.indexOf(ITEMS[a]?.rarity || "common");
    const rb = RARITY_ORDER.indexOf(ITEMS[b]?.rarity || "common");
    if (ra !== rb) return rb - ra;
    return (ITEMS[a]?.tier || 0) - (ITEMS[b]?.tier || 0);
  });

  // Inventory items grouped by their item id so duplicates collapse.
  const inventoryGroups = {};
  for (const id of inventorySorted) {
    if (!inventoryGroups[id]) inventoryGroups[id] = { id, count: 0 };
    inventoryGroups[id].count++;
  }
  const inventoryList = Object.values(inventoryGroups);

  // Marketplace: all non-consumable items, sorted by slot then rarity.
  const marketplace = ["weapon", "armor", "trinket", "mount"].flatMap((slot) =>
    itemsBySlot(slot).sort((a, b) =>
      RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)
    )
  );

  return (
    <div className="col gap-2">
      {/* Equipped row */}
      <div className="panel" style={{ padding: 10 }}>
        <div className="panel-title" style={{ marginBottom: 6 }}>EQUIPPED</div>
        <div
          style={{
            display: "grid", gap: 6,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          {EQUIP_SLOTS.map((s) => {
            const id = hero.equipment?.[s.id];
            const item = id ? ITEMS[id] : null;
            const meta = item ? (RARITY_META[item.rarity] || RARITY_META.common) : null;
            const accent = meta?.color || "var(--line)";
            return (
              <div
                key={s.id}
                style={{
                  padding: 8, borderRadius: 8,
                  border: `2px solid ${accent}`,
                  background: item
                    ? `linear-gradient(180deg, ${accent}1f 0%, var(--bg-1) 60%)`
                    : "var(--bg-1)",
                  minHeight: 78,
                  display: "flex", flexDirection: "column", gap: 4,
                }}
              >
                <div className="row between center" style={{ fontSize: 9, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  <span><span style={{ fontSize: 13, marginRight: 4 }}>{s.icon}</span>{s.label}</span>
                  {item && meta && (
                    <span style={{ color: accent, fontWeight: 700 }}>{meta.label}</span>
                  )}
                </div>
                {item ? (
                  <>
                    <div className="row gap-2 center">
                      <div style={{ fontSize: 22 }}>{item.icon}</div>
                      <div className="col flex1" style={{ minWidth: 0, lineHeight: 1.2 }}>
                        <div className="h-ui" style={{ fontSize: 11, fontWeight: 700 }}>
                          {item.name}
                        </div>
                        <div style={{
                          fontSize: 10, color: "var(--ink-soft)",
                          fontFamily: "var(--font-mono)",
                        }}>{statsLine(item) || "—"}</div>
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: "3px 8px", fontSize: 10, justifyContent: "center" }}
                      onClick={() => dispatch({ type: "UNEQUIP_TO_INVENTORY", faction, slot: s.id })}
                    >
                      Unequip
                    </button>
                  </>
                ) : (
                  <div style={{ fontSize: 11, color: "var(--ink-faint)", fontStyle: "italic" }}>
                    Empty slot — equip something from your stash.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Inventory */}
      <div className="panel" style={{ padding: 10 }}>
        <div className="row between center" style={{ marginBottom: 6 }}>
          <div className="panel-title" style={{ margin: 0 }}>INVENTORY</div>
          <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>
            {inventory.length} / ∞ · sells refund 50%
          </span>
        </div>
        {inventoryList.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--ink-faint)", fontStyle: "italic" }}>
            Your stash is empty. Visit the market or claim relics from encounters.
          </div>
        ) : (
          <div style={{
            display: "grid", gap: 6,
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          }}>
            {inventoryList.map(({ id, count }) => {
              const item = ITEMS[id];
              if (!item) return null;
              return (
                <div key={id} style={{ position: "relative" }}>
                  {count > 1 && (
                    <span className="pill" style={{
                      position: "absolute", top: 6, right: 6, zIndex: 1,
                      fontSize: 10, fontWeight: 700,
                    }}>×{count}</span>
                  )}
                  <ItemCard
                    item={item}
                    mode="equip"
                    onPrimary={() => dispatch({ type: "EQUIP_FROM_INVENTORY", faction, itemId: id })}
                    onSecondary={() => dispatch({ type: "SELL_ITEM", faction, itemId: id })}
                    secondaryLabel={`Sell ${Math.floor((item.cost || 0) * 0.5)}g`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Marketplace */}
      <div className="panel" style={{ padding: 10 }}>
        <div className="row between center" style={{ marginBottom: 6 }}>
          <div className="panel-title" style={{ margin: 0 }}>MARKETPLACE</div>
          <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>
            Purchases land in your inventory.
          </span>
        </div>
        <div style={{
          display: "grid", gap: 6,
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        }}>
          {marketplace.map((item) => {
            const affordable = player.gold >= item.cost;
            return (
              <ItemCard
                key={item.id}
                item={item}
                mode="buy"
                disabled={!affordable}
                onPrimary={() =>
                  affordable && dispatch({ type: "BUY_ITEM", faction, itemId: item.id })
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PerksTab({ hero, dispatch, faction }) {
  return (
    <div
      style={{
        display: "grid", gap: 6,
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        alignItems: "flex-start",
      }}
    >
      {PERK_BRANCHES.map((b) => (
        <div key={b} className="panel" style={{ padding: 10 }}>
          <div className="panel-title" style={{ marginBottom: 6 }}>{BRANCH_LABELS[b]}</div>
          <div className="col gap-2">
            {[1, 2, 3, 4].map((tier) => {
              const isCapstone = tier === 4;
              const tierPerks = perksByBranch(b).filter((p) => p.tier === tier);
              if (tierPerks.length === 0) return null;
              return (
                <div key={tier} className="col gap-1">
                  <div style={{
                    fontSize: 9,
                    color: isCapstone ? "var(--gold-dk)" : "var(--ink-faint)",
                    textTransform: "uppercase", letterSpacing: "0.06em",
                    fontWeight: isCapstone ? 800 : 600,
                  }}>
                    {isCapstone ? "★ Capstone — L4 required" : `Tier ${tier}`}
                  </div>
                  {tierPerks.map((p) => {
                    const owned = hero.perks.includes(p.id);
                    const canTake = !owned && hero.lvl >= tier;
                    return (
                      <div
                        key={p.id}
                        title={p.desc}
                        onClick={() => canTake && dispatch({ type: "TAKE_PERK", faction, perkId: p.id })}
                        style={{
                          padding: "4px 6px",
                          border: isCapstone
                            ? `2px solid ${owned ? "var(--gold-dk)" : "var(--gold)"}`
                            : "1px solid var(--line)",
                          borderRadius: 6,
                          cursor: canTake ? "pointer" : "default",
                          background: owned
                            ? "var(--gold)"
                            : isCapstone
                              ? "linear-gradient(180deg, rgba(255,210,90,0.10) 0%, var(--bg-1) 100%)"
                              : "var(--bg-1)",
                          opacity: !canTake && !owned ? 0.5 : 1,
                        }}
                      >
                        <div className="row gap-2 center">
                          <div style={{ fontSize: isCapstone ? 16 : 14 }}>{p.icon}</div>
                          <div className="col flex1" style={{ minWidth: 0, lineHeight: 1.2 }}>
                            <div className="h-ui" style={{ fontSize: 11, fontWeight: 700 }}>{p.name}</div>
                            <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>{p.desc}</div>
                          </div>
                          {owned && <span className="pill" style={{ fontSize: 9 }}>✓</span>}
                          {!owned && hero.lvl < tier && (
                            <span className="pill" style={{ fontSize: 9 }}>L{tier}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
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
    <div
      style={{
        display: "grid", gap: 6,
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
      }}
    >
      {items.map((item) => {
        const owned = counts[item.id] || 0;
        const affordable = player.gold >= item.cost;
        return (
          <div
            key={item.id}
            className="panel"
            title={item.desc}
            style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}
          >
            <div className="row gap-2 center">
              <div style={{ fontSize: 22 }}>{item.icon}</div>
              <div className="col flex1" style={{ minWidth: 0, lineHeight: 1.2 }}>
                <div className="h-ui" style={{ fontSize: 12, fontWeight: 700 }}>{item.name}</div>
                <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>{item.desc}</div>
              </div>
              <span className="pill" style={{ fontSize: 10 }}>×{owned}</span>
            </div>
            <button
              className="btn"
              disabled={!affordable}
              style={{ width: "100%", padding: "3px 8px", fontSize: 11, justifyContent: "center" }}
              onClick={() => dispatch({ type: "BUY_ITEM", faction, itemId: item.id })}
            >
              Buy · {item.cost}g
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ARMY — pre-battle formation editor. Each retinue stack is assigned to
   one of the three battle lanes (Vanguard / Center / Reserve), or left on
   "Auto" to round-robin like before. Battle.spawnSide reads stack.lane.
   The visualization at the top mirrors what each lane will look like at
   battle start so the player can plan composition before they hit Attack. */
const LANE_DEFS = [
  { id: 0, label: "Vanguard", icon: "⚔", desc: "Front line — first contact, soaks damage." },
  { id: 1, label: "Center",   icon: "🛡", desc: "Middle line — anchors the formation." },
  { id: 2, label: "Reserve",  icon: "🏹", desc: "Back line — ranged and supports thrive here." },
];

function ArmyTab({ hero, dispatch, faction }) {
  const retinue = hero.retinue || [];

  // Resolve each individual soldier's lane the same way spawnSide will,
  // so the preview is identical to what battle starts with.
  const previewByLane = { 0: [], 1: [], 2: [] };
  let autoCursor = 0;
  for (let i = 0; i < retinue.length; i++) {
    const s = retinue[i];
    for (let n = 0; n < s.count; n++) {
      const chosen = s.lane;
      const lane = (chosen === 0 || chosen === 1 || chosen === 2)
        ? chosen
        : (autoCursor++ % 3);
      previewByLane[lane].push(s);
    }
  }

  if (retinue.length === 0) {
    return (
      <div className="panel" style={{ padding: 12 }}>
        <div className="h-display" style={{ fontSize: 14, marginBottom: 4 }}>Army Formation</div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
          You command no troops yet. Hire some at a town&apos;s mustering field
          and they&apos;ll appear here for lane assignment.
        </div>
      </div>
    );
  }

  return (
    <div className="col gap-2" data-tut="army-tab">
      <HeroTacticsPanel hero={hero} dispatch={dispatch} faction={faction} />
      <div className="panel" data-tut="lane-preview" style={{ padding: 10 }}>
        <div className="row between center" style={{ marginBottom: 6 }}>
          <div className="h-display" style={{ fontSize: 14 }}>Lane Preview</div>
          <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>
            How your line forms at battle start
          </span>
        </div>
        <div className="row gap-2">
          {LANE_DEFS.map((L) => {
            const items = previewByLane[L.id];
            return (
              <div
                key={L.id}
                className="col gap-1"
                style={{
                  flex: 1, padding: 8,
                  background: "var(--bg-1)",
                  border: "1px solid var(--line)", borderRadius: 6,
                  minHeight: 70,
                }}
              >
                <div className="row between center" style={{ fontSize: 10, color: "var(--ink-soft)" }}>
                  <span><span style={{ fontSize: 12 }}>{L.icon}</span> {L.label}</span>
                  <span className="numeric">{items.length}</span>
                </div>
                <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                  {items.map((s, idx) => (
                    <span key={idx} title={s.unit} style={{ fontSize: 16 }}>
                      {UNITS[s.unit]?.icon || "•"}
                    </span>
                  ))}
                  {items.length === 0 && (
                    <span style={{ fontSize: 10, color: "var(--ink-faint)", fontStyle: "italic" }}>
                      empty
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel" style={{ padding: 10 }}>
        <div className="row between center" style={{ marginBottom: 6 }}>
          <div className="h-display" style={{ fontSize: 14 }}>Assign Stacks</div>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 10, padding: "3px 8px" }}
            onClick={() => {
              // Reset every stack back to Auto in one click.
              for (let i = 0; i < retinue.length; i++) {
                dispatch({ type: "SET_STACK_LANE", faction, stackIndex: i, lane: null });
              }
            }}
          >↺ All Auto</button>
        </div>
        <div className="col gap-1">
          {retinue.map((s, i) => (
            <ArmyRow
              key={`${s.unit}-${i}`}
              stack={s}
              onSet={(lane) =>
                dispatch({ type: "SET_STACK_LANE", faction, stackIndex: i, lane })
              }
            />
          ))}
        </div>
      </div>

      <div style={{ fontSize: 10, color: "var(--ink-soft)", padding: "0 4px", lineHeight: 1.5 }}>
        Tip: ranged → <b>Reserve</b> · vanguards → <b>Vanguard</b> ·
        healers → wherever takes losses. <b>Auto</b> round-robins the rest.
      </div>
    </div>
  );
}

/* Hero Tactics — three pre-battle behavior knobs. The player decides:
     stance     — atk/def trade-off baked into the hero's spawn stats
     targeting  — which enemy the hero locks onto when picking a target
     autoCast   — whether the hero fires abilities on its own
   Defaults preserve the prior auto-pilot feel. Persists on hero.behavior
   so it survives saves and is shared across all battles in a run. */
const STANCE_OPTIONS = [
  { id: "aggressive", icon: "⚔",  label: "Aggressive", desc: "+20% ATK / −15% DEF — break the line." },
  { id: "balanced",   icon: "⚖",  label: "Balanced",   desc: "No modifiers — flexible default." },
  { id: "defensive",  icon: "🛡", label: "Defensive",  desc: "−10% ATK / +25% DEF — anchor the formation." },
];
const TARGETING_OPTIONS = [
  { id: "closest", icon: "📍", label: "Closest",   desc: "Engage whichever foe is nearest in lane." },
  { id: "wounded", icon: "🩸", label: "Wounded",   desc: "Lock onto the lowest-HP foe — execute the stragglers." },
  { id: "threat",  icon: "💥", label: "Threat",    desc: "Hunt the highest-attack foe in the lane." },
  { id: "support", icon: "⚕",  label: "Supports",  desc: "Pick off healers first; closest if none in lane." },
];
const AUTOCAST_OPTIONS = [
  { id: false, icon: "✋", label: "Manual", desc: "You fire abilities. Q/W/E hotkeys, click to cast." },
  { id: true,  icon: "🔄", label: "Auto",   desc: "Hero fires the first ready ability on its own each tick." },
];

function HeroTacticsPanel({ hero, dispatch, faction }) {
  const b = hero.behavior || { stance: "balanced", targeting: "closest", autoCast: false };
  const set = (key, value) =>
    dispatch({ type: "SET_HERO_BEHAVIOR", faction, key, value });
  return (
    <div className="panel" data-tut="hero-tactics" style={{ padding: 10 }}>
      <div className="row between center" style={{ marginBottom: 6 }}>
        <div className="h-display" style={{ fontSize: 14 }}>Hero Tactics</div>
        <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>
          How {hero.name || "your hero"} fights when you don&apos;t intervene
        </span>
      </div>
      <div
        style={{
          display: "grid", gap: 6,
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <BehaviorPicker
          label="Stance"
          current={b.stance}
          options={STANCE_OPTIONS}
          onPick={(v) => set("stance", v)}
        />
        <BehaviorPicker
          label="Targeting"
          current={b.targeting}
          options={TARGETING_OPTIONS}
          onPick={(v) => set("targeting", v)}
        />
        <BehaviorPicker
          label="Abilities"
          current={b.autoCast}
          options={AUTOCAST_OPTIONS}
          onPick={(v) => set("autoCast", v)}
        />
      </div>
    </div>
  );
}

function BehaviorPicker({ label, current, options, onPick }) {
  const active = options.find((o) => o.id === current) || options[0];
  return (
    <div
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        borderRadius: 6,
        padding: 6,
        display: "flex", flexDirection: "column", gap: 4,
      }}
    >
      <div className="row between center">
        <div style={{
          fontSize: 9, color: "var(--ink-faint)",
          textTransform: "uppercase", letterSpacing: "0.08em",
          fontWeight: 700,
        }}>{label}</div>
        <div style={{ fontSize: 10, color: "var(--ink-soft)", fontStyle: "italic" }}>
          {active.label}
        </div>
      </div>
      <div className="row gap-1" style={{ flexWrap: "wrap" }}>
        {options.map((o) => {
          const isOn = o.id === current;
          return (
            <button
              key={String(o.id)}
              title={o.desc}
              onClick={() => onPick(o.id)}
              style={{
                flex: "1 0 auto",
                padding: "4px 8px",
                fontSize: 11,
                background: isOn ? "var(--gold)" : "var(--bg-2)",
                color: isOn ? "var(--ink)" : "var(--ink-soft)",
                border: `1px solid ${isOn ? "var(--gold-dk)" : "var(--line)"}`,
                borderRadius: 4,
                cursor: "pointer",
                fontWeight: isOn ? 800 : 600,
              }}
            >
              <span style={{ fontSize: 13, marginRight: 4 }}>{o.icon}</span>{o.label}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.4 }}>
        {active.desc}
      </div>
    </div>
  );
}

/* One retinue stack with a 4-segment lane picker (Auto / V / C / R).
   The chosen segment is highlighted. Click cycles it; Auto puts the stack
   back into the round-robin pool. */
function ArmyRow({ stack, onSet }) {
  const u = UNITS[stack.unit];
  const fac = u ? FACTIONS[u.faction] : null;
  const current = stack.lane;
  const segments = [
    { key: "auto", lane: null, label: "Auto" },
    { key: "v",    lane: 0,    label: "V" },
    { key: "c",    lane: 1,    label: "C" },
    { key: "r",    lane: 2,    label: "R" },
  ];
  return (
    <div
      className="row gap-2 center"
      style={{
        padding: "5px 8px",
        background: "var(--bg-1)",
        border: "1px solid var(--line)",
        borderRadius: 6,
      }}
    >
      <div style={{
        width: 26, height: 26, flexShrink: 0,
        background: fac?.palette?.primary || "#888",
        borderRadius: 5, border: "2px solid var(--line)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14,
      }}>{u?.icon}</div>
      <div className="col flex1" style={{ minWidth: 0, lineHeight: 1.2 }}>
        <div className="h-ui" style={{ fontSize: 11, fontWeight: 700 }}>
          {u?.name || stack.unit} <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>×{stack.count}</span>
        </div>
        <div style={{ fontSize: 9, color: "var(--ink-soft)" }}>
          T{u?.tier} · {u?.role} · range {u?.range}
        </div>
      </div>
      <div
        className="row"
        style={{ borderRadius: 6, overflow: "hidden", border: "1px solid var(--line)" }}
      >
        {segments.map((seg) => {
          const isActive = seg.lane === undefined
            ? current === undefined
            : seg.lane === null
              ? current === undefined
              : current === seg.lane;
          return (
            <button
              key={seg.key}
              onClick={() => onSet(seg.lane)}
              title={
                seg.lane === null ? "Auto round-robin" : LANE_DEFS[seg.lane].label
              }
              style={{
                background: isActive ? "var(--gold)" : "var(--bg-2)",
                color: isActive ? "var(--ink)" : "var(--ink-soft)",
                fontWeight: isActive ? 800 : 600,
                fontSize: 10,
                padding: "4px 8px",
                border: "none",
                borderLeft: seg.key === "auto" ? "none" : "1px solid var(--line)",
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.04em",
              }}
            >
              {seg.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Retinue row: archetype line, level chip, XP bar to next level (or
   "READY TO PROMOTE" when capped), and an inline branch chooser when the
   stack can promote. We keep this in the side panel — no new screen. */
function RetinueRow({ stack, stackIndex, playerGold, faction, dispatch }) {
  const u = UNITS[stack.unit];
  const lvl = stack.lvl ?? 1;
  const xp = stack.xp ?? 0;
  const atCap = lvl >= STACK_LEVEL_CAP;
  const branches = PROMOTIONS[stack.unit] || [];
  const canPromote = atCap && branches.length > 0;
  const cost = promotionCost(stack.count);
  const [open, setOpen] = useState(false);

  const xpToNext = atCap ? 1 : xpForStackLevel(lvl + 1);
  const xpProg = atCap ? 1 : Math.min(1, xp / xpToNext);

  return (
    <div style={{
      padding: "6px 8px", background: "var(--bg-1)",
      borderRadius: 6, border: "1px solid var(--line)",
    }}>
      <div className="row between center">
        <UnitCard unitId={stack.unit} count={stack.count} level={lvl} />
        {canPromote && !open && (
          <button
            className="btn btn-primary"
            style={{ padding: "3px 10px", fontSize: 11 }}
            onClick={() => setOpen(true)}
          >
            Promote…
          </button>
        )}
      </div>

      <div className="col gap-1" style={{ marginTop: 6 }}>
        <div className="row between" style={{ fontSize: 10, color: "var(--ink-soft)" }}>
          <span>{u?.name || stack.unit} · L{lvl}{atCap ? " (max)" : ""}</span>
          <span className="numeric">
            {atCap ? "READY" : `${xp}/${xpToNext} XP`}
          </span>
        </div>
        <div className="bar bar-xp" style={{ height: 5 }}>
          <div style={{ width: `${xpProg * 100}%` }} />
        </div>
      </div>

      {open && canPromote && (
        <div className="col gap-1" style={{ marginTop: 8, padding: 8, background: "var(--bg-2)", borderRadius: 6, border: "1px solid var(--line)" }}>
          <div style={{ fontSize: 10, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Promote to · cost {cost}g
          </div>
          <div className="row gap-2" style={{ flexWrap: "wrap" }}>
            {branches.map((toUnit) => {
              const target = UNITS[toUnit];
              const affordable = playerGold >= cost;
              return (
                <button
                  key={toUnit}
                  className="btn"
                  disabled={!affordable}
                  style={{ padding: "6px 10px", fontSize: 11 }}
                  onClick={() => {
                    dispatch({ type: "PROMOTE_STACK", faction, stackIndex, toUnit });
                    setOpen(false);
                  }}
                >
                  {target?.icon} {target?.name}
                </button>
              );
            })}
            <button
              className="btn btn-ghost"
              style={{ padding: "6px 10px", fontSize: 11 }}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
          {playerGold < cost && (
            <div style={{ fontSize: 10, color: "var(--blood-dk)" }}>
              Need {cost - playerGold} more gold.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
