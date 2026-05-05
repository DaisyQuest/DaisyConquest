/* Recruit — hire troops to a tile garrison or to the hero retinue. */
import { useState } from "react";
import { useStore } from "../core/store.jsx";
import { Economy } from "../core/economy.js";
import { unitsByFaction } from "../data/units.js";
import { UnitCard } from "../components/UnitCard.jsx";
import { FACTIONS } from "../data/factions.js";
import { TERRAINS, TOWN_TYPES } from "../data/map.js";

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

  return (
    <div className="parchment full" style={{ overflow: "auto", padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }} className="col gap-3">
        <div className="row between center">
          <button
            className="btn btn-ghost"
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "zone", params: { tileId } })}
          >
            ← Back to Region
          </button>
          <div className="h-display" style={{ fontSize: 22 }}>⚔ Mustering Field</div>
          <div className="numeric h-display" style={{ fontSize: 18, color: "var(--gold-dk)" }}>
            {myPlayer.gold} gold
          </div>
        </div>

        <div className="panel">
          <div className="row between center">
            <div className="row gap-2">
              <button className={`btn ${target === "garrison" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTarget("garrison")}>
                🏰 Add to Garrison
              </button>
              <button className={`btn ${target === "retinue" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTarget("retinue")}>
                👑 Add to Retinue
              </button>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              {target === "garrison"
                ? "Garrison units defend this region."
                : "Retinue marches with your hero."}
            </div>
          </div>
        </div>

        <div className="row gap-3" style={{ flexWrap: "wrap" }}>
          {units.map((u) => {
            const locked = u.tier > Math.max(1, Math.ceil(heroLvl / 3));
            return (
              <div
                key={u.id}
                className="panel"
                style={{ flex: "1 1 280px", minWidth: 260, opacity: locked ? 0.5 : 1 }}
              >
                <UnitCard unitId={u.id} variant="full" />
                <div className="row between center" style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 13 }}>
                    <span className="numeric h-display" style={{ color: "var(--gold-dk)" }}>{u.cost}g</span>
                    <span style={{ color: "var(--ink-soft)", fontSize: 11 }}> /unit · {u.upkeep}/r</span>
                  </div>
                  <div className="row gap-1 center">
                    <button className="btn" disabled={locked || !counts[u.id]} onClick={() => inc(u.id, -1)}>−</button>
                    <span className="numeric" style={{ minWidth: 24, textAlign: "center" }}>{counts[u.id] || 0}</span>
                    <button className="btn" disabled={locked} onClick={() => inc(u.id, 1)}>+</button>
                  </div>
                </div>
                {locked && (
                  <div style={{ fontSize: 11, color: "var(--blood-dk)", marginTop: 6 }}>
                    Requires hero L{(u.tier - 1) * 3 + 1}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="panel" style={{ position: "sticky", bottom: 0, background: "var(--bg-2)" }}>
          <div className="row between center">
            <div className="col">
              <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>Order Total</div>
              <div className="h-display numeric" style={{
                fontSize: 20,
                color: canAfford ? "var(--ink)" : "var(--blood)",
              }}>
                {totalCost}g · {totalUnits} units
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
