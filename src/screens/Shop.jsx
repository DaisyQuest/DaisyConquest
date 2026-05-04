/* Shop — quick mercenary/items board. The wares rotate per round and per
   tile, deterministically (so reloading shows the same set). */
import { useMemo } from "react";
import { useStore } from "../core/store.jsx";
import { makeRNG } from "../core/rng.js";
import { ITEMS } from "../data/items.js";

export function Shop() {
  const { state, dispatch } = useStore();
  const me = state.activePlayer;
  const myPlayer = state.players[me];
  const tileId = state.screenParams.tileId;

  // Daily rotation: 6 items, seeded by round + tile
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

  return (
    <div className="parchment full" style={{ overflow: "auto", padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }} className="col gap-3">
        <div className="row between center">
          <button className="btn btn-ghost" onClick={goBack}>← Back</button>
          <div className="h-display" style={{ fontSize: 22 }}>🏪 Market</div>
          <div className="numeric h-display" style={{ fontSize: 18, color: "var(--gold-dk)" }}>
            {myPlayer.gold} gold
          </div>
        </div>

        <div className="panel">
          <div style={{ fontSize: 12, color: "var(--ink-soft)", fontStyle: "italic" }}>
            &ldquo;Today&apos;s wares — rotates each round.&rdquo;
          </div>
        </div>

        <div className="row gap-3" style={{ flexWrap: "wrap" }}>
          {items.map((item) => {
            const owned = item.slot !== "consumable" && myPlayer.hero.equipment[item.slot] === item.id;
            const affordable = myPlayer.gold >= item.cost;
            return (
              <div key={item.id} className="panel slide-up" style={{ flex: "1 1 280px", minWidth: 280 }}>
                <div className="row gap-3 center">
                  <div style={{
                    width: 60, height: 60, borderRadius: 8,
                    background: "var(--bg-1)", border: "2px solid var(--line)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 32,
                  }}>{item.icon}</div>
                  <div className="col flex1">
                    <div className="h-display" style={{ fontSize: 14 }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: "var(--ink-soft)", textTransform: "uppercase" }}>
                      {item.slot} · T{item.tier}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>
                      {Object.entries(item.stats).map(([k, v]) => `${v > 0 ? "+" : ""}${v} ${k}`).join(" · ") || ""}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--ink-faint)", marginTop: 6 }}>
                  &quot;{item.desc}&quot;
                </div>
                <button
                  className="btn btn-primary full"
                  disabled={!affordable || owned}
                  style={{ width: "100%", marginTop: 10, justifyContent: "center" }}
                  onClick={() => dispatch({ type: "BUY_ITEM", faction: me, itemId: item.id })}
                >
                  {owned ? "Owned" : `Buy · ${item.cost}g`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
