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

  const swapControl = () => {
    const next = state.activePlayer === state.humanFaction ? state.coopFaction : state.humanFaction;
    dispatch({ type: "SET_ACTIVE_PLAYER", faction: next });
  };

  return (
    <div className="parchment" style={{ width: "100%", height: "100%", display: "flex", overflow: "hidden" }}>
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
              onClick={onTileClick}
              onHover={setHovered}
            />
          ))}
        </div>
      </div>

      <div style={{
        width: 320, borderLeft: "3px solid var(--line)",
        background: "var(--bg-2)", padding: 16, overflowY: "auto",
      }}>
        <HeroPanel player={myPlayer} />
        {state.coopFaction && (
          <div style={{ marginTop: 12 }}>
            <div className="panel-title">Co-op Ally</div>
            <HeroPanel player={state.players[state.coopFaction]} compact />
            <button
              className="btn btn-ghost full"
              style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
              onClick={swapControl}
            >
              ↔ Swap Control
            </button>
          </div>
        )}

        <div style={{ marginTop: 12 }} className="panel">
          <div className="panel-title">Selected Region</div>
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

        <div style={{ marginTop: 12 }} className="panel">
          <div className="panel-title">Chronicle</div>
          <div className="col gap-1" style={{ fontSize: 11, maxHeight: 160, overflowY: "auto" }}>
            {state.log.slice(-8).reverse().map((l, i) => (
              <div key={i}><b>R{l.round}</b> · {l.text}</div>
            ))}
          </div>
        </div>

        <button
          className="btn btn-ghost"
          style={{ width: "100%", marginTop: 12, justifyContent: "center" }}
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
