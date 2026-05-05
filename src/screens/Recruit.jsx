/* Recruit — hire troops to a tile garrison or to the hero retinue.
   Layout target: every unit row visible without scrolling on a 1280×720
   viewport. We render a compact 2-column grid of 1-line unit rows rather
   than the full UnitCard panels — name + stats + cost + counter all in
   one strip; click the row for a tooltip with the lore. */
import { useState } from "react";
import { useStore } from "../core/store.jsx";
import { Economy } from "../core/economy.js";
import { TRAIT_INFO, unitsByFaction } from "../data/units.js";
import { FACTIONS } from "../data/factions.js";
import { TERRAINS, TOWN_TYPES } from "../data/map.js";
import { TutorialOverlay } from "../components/TutorialOverlay.jsx";

export function Recruit() {
  const { state, dispatch } = useStore();
  const tileId = state.screenParams.tileId;
  const tile = state.map.tiles.find((t) => t.id === tileId);
  const me = state.activePlayer;
  const myPlayer = state.players[me];
  const heroLvl = myPlayer.hero.lvl;
  const [target, setTarget] = useState("garrison");
  const [counts, setCounts] = useState({});

  if (!tile) return <div style={{ padding: 40 }}>Region not found.</div>;

  // Tile-ownership guard for co-op: this town's mustering field belongs to
  // its owner. The active player can't recruit at a partner's (or rival's)
  // town — those would be incoherent unit-roster mixes.
  if (tile.owner && tile.owner !== me) {
    return (
      <NotYourTownPanel
        tile={tile}
        message="This town does not answer to you. Swap control or back out to the map."
        dispatch={dispatch}
      />
    );
  }

  const units = unitsByFaction(me);
  const totalCost = units.reduce(
    (s, u) => s + Economy.troopCost(u.id, counts[u.id] || 0, myPlayer.hero),
    0
  );
  const canAfford = totalCost <= myPlayer.gold;
  const totalUnits = Object.values(counts).reduce((s, c) => s + c, 0);

  const inc = (uid, n) =>
    setCounts((c) => ({ ...c, [uid]: Math.max(0, (c[uid] || 0) + n) }));

  const recruit = () => {
    if (!canAfford || totalUnits === 0) return;
    for (const uid of Object.keys(counts)) {
      if (counts[uid] > 0) {
        dispatch({
          type: "RECRUIT",
          faction: me,
          tileId,
          unit: uid,
          count: counts[uid],
          toRetinue: target === "retinue",
        });
      }
    }
    setCounts({});
  };

  const tutorialSteps = [
    {
      selector: ".panel button.btn-primary, .panel button.btn-ghost",
      side: "bottom",
      title: "Garrison vs Retinue",
      body: "Garrison defends this town. Retinue marches with your hero. Pick a target — the same +/− buttons fill either pool.",
    },
    {
      selector: ".panel:last-of-type button.btn-primary",
      side: "top",
      title: "Confirm the order",
      body: "Activates when the total fits your gold and at least one unit is queued. Same-archetype recruits merge with existing stacks and keep their level.",
    },
  ];

  return (
    <div className="parchment full" style={{ overflow: "hidden", padding: 16, display: "flex", flexDirection: "column" }}>
      <TutorialOverlay stepId="recruit.intro" steps={tutorialSteps} />
      <div style={{ maxWidth: 1180, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }} className="gap-2">
        <div className="row between center" style={{ marginBottom: 8 }}>
          <button
            className="btn btn-ghost"
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "zone", params: { tileId } })}
          >
            ← Back to Region
          </button>
          <div className="h-display" style={{ fontSize: 18 }}>⚔ Mustering Field</div>
          <div className="numeric h-display" style={{ fontSize: 16, color: "var(--gold-dk)" }}>
            {myPlayer.gold} gold
          </div>
        </div>

        <div className="panel" style={{ padding: "8px 12px", marginBottom: 8 }}>
          <div className="row between center">
            <div className="row gap-2">
              <button className={`btn ${target === "garrison" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTarget("garrison")}>
                🏰 Garrison
              </button>
              <button className={`btn ${target === "retinue" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTarget("retinue")}>
                👑 Retinue
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              {target === "garrison"
                ? "Defends this region."
                : "Marches with your hero."}
            </div>
          </div>
        </div>

        <div
          style={{
            flex: 1, minHeight: 0, overflowY: "auto",
            display: "grid", gap: 6,
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            alignContent: "start",
          }}
        >
          {units.map((u) => {
            const locked = u.tier > Math.max(1, Math.ceil(heroLvl / 3));
            return (
              <RecruitRow
                key={u.id}
                unit={u}
                count={counts[u.id] || 0}
                locked={locked}
                onInc={(n) => inc(u.id, n)}
              />
            );
          })}
        </div>

        <div className="panel" style={{ marginTop: 8, padding: "8px 12px", background: "var(--bg-2)" }}>
          <div className="row between center">
            <div className="row gap-3 center">
              <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>Order</div>
              <div className="h-display numeric" style={{
                fontSize: 16,
                color: canAfford ? "var(--ink)" : "var(--blood)",
              }}>
                {totalCost}g · {totalUnits} {totalUnits === 1 ? "unit" : "units"}
              </div>
            </div>
            <button className="btn btn-primary" disabled={!canAfford || totalUnits === 0} onClick={recruit}>
              Confirm Recruitment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* One unit, one row. Portrait + name/T/role + stats + cost + counter, all
   on a single line at typical screen widths. Trait pills tucked under the
   stat strip when the unit has any. Locked rows dim and disable the +. */
function RecruitRow({ unit, count, locked, onInc }) {
  const u = unit;
  const fac = FACTIONS[u.faction];
  const lore = `${u.desc}${u.traits.length ? "\n\nTraits: " + u.traits.map((t) => TRAIT_INFO[t]?.label || t).join(", ") : ""}`;
  return (
    <div
      className="panel"
      title={lore}
      style={{
        padding: "6px 10px",
        opacity: locked ? 0.55 : 1,
        display: "flex", flexDirection: "column", gap: 4,
      }}
    >
      <div className="row gap-2 center">
        <div style={{
          width: 30, height: 30, flexShrink: 0,
          background: fac.palette.primary, color: "#fff",
          borderRadius: 6, border: "2px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16,
        }}>{u.icon}</div>
        <div className="col flex1" style={{ lineHeight: 1.2, minWidth: 0 }}>
          <div className="row gap-1 center" style={{ fontSize: 12 }}>
            <span className="h-ui" style={{ fontWeight: 700 }}>{u.name}</span>
            <span style={{ fontSize: 9, color: "var(--ink-faint)" }}>T{u.tier}·{u.role.slice(0, 4)}</span>
          </div>
          <div className="row gap-2" style={{ fontSize: 10, color: "var(--ink-soft)", fontFamily: "var(--font-mono)" }}>
            <span>❤{u.hp}</span><span>⚔{u.atk}</span><span>🛡{u.def}</span><span>⚡{u.spd}</span>
            {u.range > 1 && <span>🏹{u.range}</span>}
          </div>
        </div>
        <div className="col" style={{ alignItems: "flex-end", lineHeight: 1.1, marginRight: 4 }}>
          <span className="numeric" style={{ fontSize: 12, color: "var(--gold-dk)", fontWeight: 700 }}>{u.cost}g</span>
          <span style={{ fontSize: 9, color: "var(--ink-soft)" }}>{u.upkeep}/r</span>
        </div>
        <div className="row gap-1 center">
          <button
            className="btn"
            style={{ padding: "2px 8px", fontSize: 13 }}
            disabled={locked || !count}
            onClick={() => onInc(-1)}
          >−</button>
          <span className="numeric" style={{ minWidth: 18, textAlign: "center", fontSize: 12 }}>{count}</span>
          <button
            className="btn"
            style={{ padding: "2px 8px", fontSize: 13 }}
            disabled={locked}
            onClick={() => onInc(1)}
          >+</button>
        </div>
      </div>
      {(locked || u.traits.length > 0) && (
        <div className="row gap-1" style={{ flexWrap: "wrap", paddingLeft: 38 }}>
          {locked && (
            <span className="pill" style={{ fontSize: 9, color: "var(--blood-dk)" }}>
              ⛔ Hero L{(u.tier - 1) * 3 + 1}
            </span>
          )}
          {u.traits.map((t) => (
            <span
              key={t}
              className="pill"
              style={{ fontSize: 9 }}
              title={TRAIT_INFO[t] ? `${TRAIT_INFO[t].label}: ${TRAIT_INFO[t].desc}` : t}
            >
              {TRAIT_INFO[t]?.label || t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* Shared "you don't own this town" panel — used by Recruit and Shop in coop
   to refuse mixing one player's faction roster into another's town. */
export function NotYourTownPanel({ tile, message, dispatch }) {
  const fac = tile.owner ? FACTIONS[tile.owner] : null;
  const town = tile.town ? TOWN_TYPES[tile.town] : null;
  const terr = TERRAINS[tile.terrain];
  return (
    <div className="parchment full" style={{
      display: "flex", alignItems: "center", justifyContent: "center", padding: 40,
    }}>
      <div className="panel pop-in" style={{ maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>{town?.icon || terr.icon}</div>
        <div className="h-display" style={{ fontSize: 22, marginBottom: 6 }}>
          {town?.name || terr.name}
        </div>
        {fac && (
          <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 12 }}>
            Held by <span style={{ color: fac.palette.primary, fontWeight: 700 }}>{fac.name}</span>
          </div>
        )}
        <div style={{ fontSize: 13, color: "var(--ink)", marginBottom: 18, lineHeight: 1.5 }}>
          {message}
        </div>
        <div className="row gap-2 center" style={{ justifyContent: "center" }}>
          <button
            className="btn"
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "map" })}
          >
            ← World Map
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => dispatch({ type: "SWAP_CONTROL", next: "map" })}
          >
            ↔ Swap Control
          </button>
        </div>
      </div>
    </div>
  );
}
