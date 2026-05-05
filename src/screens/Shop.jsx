/* Shop — quick mercenary/items board. The wares rotate per round and per
   tile, deterministically (so reloading shows the same set). */
import { useMemo } from "react";
import { useStore } from "../core/store.jsx";
import { makeRNG } from "../core/rng.js";
import { ITEMS, RARITY_META } from "../data/items.js";
import { NotYourTownPanel } from "./Recruit.jsx";

export function Shop() {
  const { state, dispatch } = useStore();
  const me = state.activePlayer;
  const myPlayer = state.players[me];
  const tileId = state.screenParams.tileId;
  const tile = tileId ? state.map.tiles.find((t) => t.id === tileId) : null;

  // Daily rotation: 6 items, seeded by round + tile. Hooks must run before
  // any early-return so the order is stable.
  const items = useMemo(() => {
    const tileSeed = tileId ? tileId.split(",").map(Number).reduce((a, b) => a * 31 + b, 0) : 0;
    const rng = makeRNG(state.round * 1000 + tileSeed);
    const all = Object.values(ITEMS);
    const picks = [];
    const used = new Set();
    while (picks.length < 6 && picks.length < all.length) {
      const i = Math.floor(rng() * all.length);
      if (!used.has(i)) {
        used.add(i);
        picks.push(all[i]);
      }
    }
    return picks;
  }, [state.round, tileId]);

  const goBack = () =>
    dispatch({
      type: "SET_SCREEN",
      screen: tileId ? "zone" : "map",
      params: tileId ? { tileId } : {},
    });

  // Tile-ownership guard for co-op: only browse the market in your own town.
  // (Tile-less shop access via topbar nav is already disabled there.)
  if (tile && tile.owner && tile.owner !== me) {
    return (
      <NotYourTownPanel
        tile={tile}
        message="The merchants here trade only with their own lord. Swap control or back out to the map."
        dispatch={dispatch}
      />
    );
  }

  return (
    <div className="parchment full" style={{ overflow: "hidden", padding: 16, display: "flex", flexDirection: "column" }}>
      <div style={{ maxWidth: 1180, width: "100%", margin: "0 auto", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }} className="gap-2">
        <div className="row between center" style={{ marginBottom: 6 }}>
          <button className="btn btn-ghost" onClick={goBack}>← Back</button>
          <div className="h-display" style={{ fontSize: 18 }}>
            🏪 Market <span style={{ fontSize: 11, color: "var(--ink-soft)", fontStyle: "italic", fontWeight: 400 }}>· today&apos;s wares, rotates each round</span>
          </div>
          <div className="numeric h-display" style={{ fontSize: 16, color: "var(--gold-dk)" }}>
            {myPlayer.gold} gold
          </div>
        </div>

        <div
          style={{
            flex: 1, minHeight: 0, overflowY: "auto",
            display: "grid", gap: 8,
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            alignContent: "start",
          }}
        >
          {items.map((item) => {
            // "Owned" now reflects total inventory + equipment + consumable
            // count, since BUY_ITEM always lands in the stash. Display only —
            // the player can still buy duplicates.
            const ownedCount = countOwned(myPlayer.hero, item);
            const affordable = myPlayer.gold >= item.cost;
            const stats = Object.entries(item.stats)
              .map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`)
              .join(" · ");
            const meta = RARITY_META[item.rarity] || RARITY_META.common;
            const accent = meta.color;
            return (
              <div
                key={item.id}
                className="slide-up"
                title={item.desc}
                style={{
                  padding: 10, display: "flex", flexDirection: "column", gap: 6,
                  borderRadius: 8,
                  border: `2px solid ${accent}`,
                  background: `linear-gradient(180deg, ${accent}1f 0%, var(--bg-1) 60%)`,
                }}
              >
                <div className="row gap-2 center">
                  <div style={{
                    width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                    background: "var(--bg-2)", border: `1px solid ${accent}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22,
                  }}>{item.icon}</div>
                  <div className="col flex1" style={{ minWidth: 0, lineHeight: 1.2 }}>
                    <div className="h-ui" style={{ fontSize: 12, fontWeight: 700 }}>{item.name}</div>
                    <div style={{
                      fontSize: 9, color: accent,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      fontWeight: 700,
                    }}>
                      {meta.label} · {item.slot} · T{item.tier}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary"
                    disabled={!affordable}
                    style={{ padding: "4px 10px", fontSize: 11 }}
                    onClick={() => dispatch({ type: "BUY_ITEM", faction: me, itemId: item.id })}
                  >
                    {`${item.cost}g`}
                  </button>
                </div>
                {stats && (
                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>{stats}</div>
                )}
                <div style={{ fontSize: 10, color: "var(--ink-soft)", lineHeight: 1.3 }}>
                  {item.desc}
                </div>
                {ownedCount > 0 && (
                  <div style={{ fontSize: 10, color: "var(--ink-faint)", fontStyle: "italic" }}>
                    Already in inventory ×{ownedCount}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* Count how many of `item` the hero currently has (across stash + slot for
   equipment, or consumable list for consumables). Display only — does not
   gate purchases. */
function countOwned(hero, item) {
  if (!hero) return 0;
  if (item.slot === "consumable") {
    return (hero.consumables || []).filter((c) => c === item.id).length;
  }
  let n = (hero.inventory || []).filter((id) => id === item.id).length;
  if (hero.equipment?.[item.slot] === item.id) n++;
  return n;
}
