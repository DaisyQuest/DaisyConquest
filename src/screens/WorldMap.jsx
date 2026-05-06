/* WorldMap — hex grid of territories.
   Click a tile to select it. Click again on an adjacent enemy/unowned tile
   to attack/move; click an owned town to enter its zone. */
import { useMemo, useRef, useState } from "react";
import { useStore } from "../core/store.jsx";
import { hexNeighbors, TERRAINS, TOWN_TYPES } from "../data/map.js";
import { FACTIONS } from "../data/factions.js";
import { HexTile } from "../components/HexTile.jsx";
import { HeroPanel } from "../components/HeroPanel.jsx";
import { UnitCard } from "../components/UnitCard.jsx";
import { Crest } from "../components/Crest.jsx";
import { TutorialOverlay } from "../components/TutorialOverlay.jsx";

export function WorldMap() {
  const { state, dispatch } = useStore();
  const me = state.activePlayer;
  const myPlayer = state.players[me];
  const tiles = state.map.tiles;
  const [hovered, setHovered] = useState(null);

  const selectedId = myPlayer.selectedTile;
  const selected = tiles.find((t) => t.id === selectedId);
  const ownedTiles = tiles.filter((t) => t.owner === me);
  const adjacencyIds = useMemo(() => {
    const set = new Set();
    for (const o of ownedTiles) {
      for (const n of hexNeighbors(o, tiles)) {
        if (n) set.add(n.id);
      }
    }
    return set;
  }, [ownedTiles, tiles]);

  // Resolve each tile's relationship to the active player so HexTile can
  // pick the right border/glow without re-running comparisons per render.
  // "mine"  = active human (gold solid border, strong tint)
  // "ally"  = the coop partner (gold-dashed border, medium tint)
  // "enemy" = any non-human owner with a known faction
  // "none"  = unclaimed
  const ownerKindByTile = useMemo(() => {
    const map = new Map();
    for (const t of tiles) {
      if (!t.owner) {
        map.set(t.id, "none");
      } else if (t.owner === me) {
        map.set(t.id, "mine");
      } else if (state.coopFaction && t.owner === state.coopFaction
                 && state.players[state.coopFaction]?.isHuman) {
        map.set(t.id, "ally");
      } else {
        map.set(t.id, "enemy");
      }
    }
    return map;
  }, [tiles, me, state.coopFaction, state.players]);

  /* Visible = currently in sight: owned by human(s) + their neighbors.
     Computed per-render (cheap, deterministic from owners + neighbors). */
  const visibleIds = useMemo(() => {
    const humans = [state.humanFaction, state.coopFaction].filter(Boolean);
    const set = new Set();
    for (const t of tiles) {
      if (humans.includes(t.owner)) {
        set.add(t.id);
        for (const n of hexNeighbors(t, tiles)) set.add(n.id);
      }
    }
    return set;
  }, [tiles, state.humanFaction, state.coopFaction]);

  /* Just-revealed diff: tiles that became `explored` since the last render.
     Used to play a one-shot reveal animation in HexTile. */
  const prevExploredRef = useRef(null);
  const justRevealedIds = useMemo(() => {
    const prev = prevExploredRef.current;
    const set = new Set();
    if (prev) {
      for (const t of tiles) {
        if (t.explored && !prev.has(t.id)) set.add(t.id);
      }
    }
    prevExploredRef.current = new Set(tiles.filter((t) => t.explored).map((t) => t.id));
    return set;
  }, [tiles]);

  /* Recent enemy moves: tiles the AI captured during the round that just
     ended. Shown as arrows on the map so the player can see where rivals
     are pushing in and decide whether to intercept. We clamp the arrow
     set to moves that ended on a tile the player can currently see — no
     point hinting at battles in fully-fogged territory. */
  const humanFactionSet = useMemo(
    () => new Set([state.humanFaction, state.coopFaction].filter(Boolean)),
    [state.humanFaction, state.coopFaction],
  );
  const recentMoves = useMemo(() => {
    const lastRound = state.round - 1;
    if (lastRound < 1) return [];
    const byId = new Map(tiles.map((t) => [t.id, t]));
    const out = [];
    for (const dest of tiles) {
      if (dest.lastMoveRound !== lastRound) continue;
      if (!dest.lastMoveBy || humanFactionSet.has(dest.lastMoveBy)) continue;
      const src = byId.get(dest.lastMoveFromId);
      if (!src) continue;
      if (!visibleIds.has(dest.id) && !visibleIds.has(src.id)) continue;
      out.push({ src, dest, faction: dest.lastMoveBy });
    }
    return out;
  }, [tiles, state.round, humanFactionSet, visibleIds]);

  /* Threatened set: enemy tiles that border at least one tile a human
     player owns. These are the rivals' "next-move candidates" — a red
     pulse on the rim is the cue to bulk a garrison or counterattack. */
  const threatenedIds = useMemo(() => {
    const set = new Set();
    for (const t of tiles) {
      if (!t.owner || humanFactionSet.has(t.owner)) continue;
      if (!visibleIds.has(t.id)) continue;
      const neighbors = hexNeighbors(t, tiles);
      if (neighbors.some((n) => n && humanFactionSet.has(n.owner))) {
        set.add(t.id);
      }
    }
    return set;
  }, [tiles, humanFactionSet, visibleIds]);

  const onTileClick = (tile) => {
    if (selectedId === tile.id) {
      const adj = adjacencyIds.has(tile.id) && tile.owner !== me;
      if (adj) {
        dispatch({ type: "MOVE_HERO_TO", tileId: tile.id });
      } else if (tile.owner === me && tile.town) {
        dispatch({ type: "SET_SCREEN", screen: "zone", params: { tileId: tile.id } });
      }
    } else {
      dispatch({ type: "SELECT_TILE", tileId: tile.id });
    }
  };

  const mapW = state.map.cols * 105 + 80;
  const mapH = state.map.rows * 110 + 80;

  const swapControl = () => dispatch({ type: "SWAP_CONTROL", next: "map" });

  // Tutorial steps for the world map. Targets are stable data-tut anchors
  // (set in GoldBar.jsx and HexTile.jsx) so future copy edits can't break
  // the selectors. Each step is self-contained and dismissable.
  const tutorialSteps = [
    {
      selector: "[data-tut='topbar-identity']",
      side: "bottom",
      title: "Your banner",
      body: "Whose turn it is. In coop, this swaps each handoff so the player knows who's commanding the round.",
    },
    {
      selector: "[data-tut='topbar-nav']",
      side: "bottom",
      title: "Navigation",
      body: "Jump to Map, Recruit, Hero, Shop, or Defense. Recruit and Shop need a town context — enter a region first to enable them.",
    },
    {
      selector: ".hex.hex-big:not(.fogged)",
      side: "right",
      title: "The hex map",
      body: "Solid gold rim = yours. Dashed gold = coop ally. Click a hex to inspect it; click an adjacent enemy or unowned hex to attack or claim.",
    },
    {
      selector: "[data-tut='end-turn']",
      side: "bottom",
      title: "End the round",
      body: "When you're done moving and recruiting, end the round. Income, upkeep, AI moves, and any pending defense raids resolve in order.",
    },
  ];

  return (
    <div className="parchment" style={{ width: "100%", height: "100%", display: "flex", overflow: "hidden" }}>
      <TutorialOverlay stepId="map.intro" steps={tutorialSteps} />
      <div style={{ flex: 1, position: "relative", overflow: "auto", padding: 24 }}>
        <div style={{ position: "relative", width: mapW, height: mapH, margin: "auto" }}>
          {tiles.map((t) => (
            <HexTile
              key={t.id}
              tile={t}
              selected={selectedId === t.id}
              hovered={hovered?.id === t.id}
              isAdjacentToActive={adjacencyIds.has(t.id) && t.owner !== me}
              visible={visibleIds.has(t.id)}
              justRevealed={justRevealedIds.has(t.id)}
              ownerKind={ownerKindByTile.get(t.id)}
              threatened={threatenedIds.has(t.id)}
              onClick={onTileClick}
              onHover={setHovered}
            />
          ))}
          {/* Enemy-movement overlay. Drawn above the hex layer so arrows
              read clearly, but pointer-events: none so it doesn't swallow
              clicks. Each arrow is colored by the moving faction. */}
          {recentMoves.length > 0 && (
            <svg
              width={mapW} height={mapH}
              style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}
            >
              <defs>
                {recentMoves.map((m, i) => {
                  const fac = FACTIONS[m.faction];
                  const c = fac?.palette?.primary || "#a02020";
                  return (
                    <marker
                      key={`mk_${i}`}
                      id={`enemy-arrow-${i}`}
                      viewBox="0 0 10 10" refX="8" refY="5"
                      markerWidth="6" markerHeight="6" orient="auto"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
                    </marker>
                  );
                })}
              </defs>
              {recentMoves.map((m, i) => {
                const fac = FACTIONS[m.faction];
                const c = fac?.palette?.primary || "#a02020";
                const x1 = m.src.x + 60;
                const y1 = m.src.y + 69;
                const x2 = m.dest.x + 60;
                const y2 = m.dest.y + 69;
                // Bow the line slightly so two arrows in opposite
                // directions don't perfectly overlap.
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;
                const nx = -(y2 - y1);
                const ny = (x2 - x1);
                const len = Math.hypot(nx, ny) || 1;
                const cx = mx + (nx / len) * 14;
                const cy = my + (ny / len) * 14;
                return (
                  <g key={`mv_${i}`} style={{ animation: "enemy-march 1.6s ease-in-out infinite" }}>
                    <path
                      d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                      stroke={c}
                      strokeWidth="3.5"
                      fill="none"
                      strokeLinecap="round"
                      strokeOpacity="0.85"
                      markerEnd={`url(#enemy-arrow-${i})`}
                      style={{ filter: `drop-shadow(0 0 4px ${c})` }}
                    />
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </div>

      <div style={{
        width: 300, borderLeft: "3px solid var(--line)",
        background: "var(--bg-2)", padding: 10, overflowY: "auto",
        display: "flex", flexDirection: "column", gap: 8,
      }}>
        <HeroPanel player={myPlayer} />
        {state.coopFaction && (
          <div className="col gap-1">
            <div className="panel-title" style={{ marginBottom: 4 }}>Co-op Ally</div>
            <HeroPanel player={state.players[state.coopFaction]} compact />
            <button
              className="btn btn-ghost full"
              style={{ width: "100%", justifyContent: "center", padding: "4px 8px", fontSize: 11 }}
              onClick={swapControl}
            >
              ↔ Swap Control
            </button>
          </div>
        )}

        <div className="panel" style={{ padding: 10 }}>
          <div className="panel-title" style={{ marginBottom: 4 }}>Selected Region</div>
          {!selected && <div style={{ color: "var(--ink-soft)", fontSize: 12 }}>Click a hex to inspect.</div>}
          {selected && (
            <SelectedTilePanel
              tile={selected}
              adjacencyIds={adjacencyIds}
              visible={visibleIds.has(selected.id)}
              explored={selected.explored}
              me={me}
              dispatch={dispatch}
            />
          )}
        </div>

        {(recentMoves.length > 0 || threatenedIds.size > 0) && (
          <div className="panel" style={{ padding: 10 }}>
            <div className="row between center" style={{ marginBottom: 4 }}>
              <div className="panel-title" style={{ margin: 0 }}>Enemy Activity</div>
              <span className="pill" style={{
                fontSize: 9, background: "var(--blood)", color: "#fff",
              }}>R{state.round - 1}</span>
            </div>
            {recentMoves.length === 0 ? (
              <div style={{ fontSize: 11, color: "var(--ink-soft)", fontStyle: "italic" }}>
                No movement seen last round, but {threatenedIds.size} hostile tile{threatenedIds.size === 1 ? "" : "s"} press your border.
              </div>
            ) : (
              <div className="col" style={{ fontSize: 11, lineHeight: 1.4 }}>
                {recentMoves.map((m, i) => {
                  const fac = FACTIONS[m.faction];
                  const destLabel = TOWN_TYPES[m.dest.town]?.name
                    || TERRAINS[m.dest.terrain]?.name || "Region";
                  return (
                    <div key={i}>
                      <span style={{ color: fac?.palette?.primary, fontWeight: 700 }}>
                        {fac?.short || m.faction}
                      </span>
                      {" "}seized <b>{destLabel}</b>
                      <span style={{ color: "var(--ink-soft)" }}> ({m.dest.q},{m.dest.r})</span>
                    </div>
                  );
                })}
                {threatenedIds.size > 0 && (
                  <div style={{
                    marginTop: 4, fontSize: 10, color: "var(--ink-soft)", fontStyle: "italic",
                  }}>
                    {threatenedIds.size} tile{threatenedIds.size === 1 ? "" : "s"} with red rim could strike next.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="panel" style={{ padding: 10 }}>
          <div className="panel-title" style={{ marginBottom: 4 }}>Chronicle</div>
          <div className="col" style={{ fontSize: 11, maxHeight: 130, overflowY: "auto", lineHeight: 1.4 }}>
            {state.log.slice(-8).reverse().map((l, i) => (
              <div key={i}><b>R{l.round}</b> · {l.text}</div>
            ))}
          </div>
        </div>

        <button
          className="btn btn-ghost"
          style={{ width: "100%", justifyContent: "center", padding: "4px 8px", fontSize: 11 }}
          onClick={() => dispatch({ type: "SET_SCREEN", screen: "main" })}
        >
          ← Title Screen
        </button>
      </div>
    </div>
  );
}

function SelectedTilePanel({ tile, adjacencyIds, visible, explored, me, dispatch }) {
  // Fully fogged: never seen. Show silhouette only.
  if (!explored) {
    return (
      <div className="col gap-2" style={{ fontSize: 12 }}>
        <div className="row gap-2 center">
          <div style={{
            width: 42, height: 42, borderRadius: 8,
            background: "var(--ink-faint)", border: "2px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
          }}>🌫️</div>
          <div className="col flex1">
            <div className="h-display" style={{ fontSize: 13 }}>Uncharted</div>
            <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>
              No scout has set foot here.
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", fontStyle: "italic" }}>
          Press the borders of your land to learn what lies beyond.
        </div>
      </div>
    );
  }

  const terr = TERRAINS[tile.terrain];
  const fac = visible && tile.owner ? FACTIONS[tile.owner] : null;
  const town = tile.town ? TOWN_TYPES[tile.town] : null;
  const isMine = visible && tile.owner === me;
  const isAdj = adjacencyIds.has(tile.id);
  const garrison = (visible ? tile.garrison : null) || [];

  return (
    <div className="col gap-2" style={{ fontSize: 12 }}>
      <div className="row gap-2 center">
        <div style={{
          width: 42, height: 42, borderRadius: 8,
          background: terr.color, border: "2px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        }}>{town?.icon || terr.icon}</div>
        <div className="col flex1">
          <div className="h-display" style={{ fontSize: 13 }}>{town ? town.name : terr.name}</div>
          <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>
            {terr.name} · +{tile.gold + (town?.goldBonus || 0)}g/r
          </div>
        </div>
        {fac && <Crest faction={fac.id} size={32} />}
      </div>

      {!visible && (
        <div style={{ fontSize: 11, color: "var(--ink-soft)", fontStyle: "italic" }}>
          Beyond your line of sight — last seen when scouts withdrew.
        </div>
      )}

      {garrison.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, color: "var(--ink-soft)",
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4,
          }}>Garrison</div>
          <div className="row gap-1" style={{ flexWrap: "wrap" }}>
            {garrison.map((g, i) => <UnitCard key={i} unitId={g.unit} count={g.count} />)}
          </div>
        </div>
      )}

      <div className="col gap-2" style={{ marginTop: 4 }}>
        {isMine && town && TOWN_TYPES[tile.town]?.recruit && (
          <button className="btn" onClick={() => dispatch({ type: "SET_SCREEN", screen: "zone", params: { tileId: tile.id } })}>
            🏘️ Enter Region
          </button>
        )}
        {!isMine && isAdj && (
          <button className="btn btn-danger" onClick={() => dispatch({ type: "MOVE_HERO_TO", tileId: tile.id })}>
            {tile.owner
              ? "⚔ Attack"
              : town && TOWN_TYPES[tile.town]?.encounter
                ? "🔍 Investigate"
                : "🚩 Claim"}
          </button>
        )}
        {!isMine && !isAdj && (
          <div style={{ fontSize: 11, color: "var(--ink-soft)", fontStyle: "italic" }}>
            Out of reach — must be adjacent to your land.
          </div>
        )}
      </div>
    </div>
  );
}
