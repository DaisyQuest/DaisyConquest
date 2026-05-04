/* LocalZone — town/region detail. Shows facilities and lets you launch
   into recruit / shop / hero / encounter / defense from one place. */
import { useStore } from "../core/store.jsx";
import { TERRAINS, TOWN_TYPES } from "../data/map.js";
import { FACTIONS } from "../data/factions.js";
import { ENCOUNTERS } from "../data/encounters.js";
import { Crest } from "../components/Crest.jsx";
import { UnitCard } from "../components/UnitCard.jsx";

function flavorText(tile) {
  const town = TOWN_TYPES[tile.town];
  if (town?.isCapital) return "The seat of your power. Banners hang from every parapet.";
  switch (tile.town) {
    case "city":   return "Cobbled streets thick with traders, soldiers, and complaint.";
    case "town":   return "A walled town of farmers and journeyman smiths.";
    case "fort":   return "A stone fort built into the hillside, eyes on every road.";
    case "cave":   return "A black throat in the earth. Something breathes inside.";
    case "shrine": return "A weathered idol stares with rain-pitted eyes.";
    case "ruin":   return "Stones black with old fire. Names carved into doorposts.";
    default:       return "Wind-bent grass. Empty road. The land waits.";
  }
}

export function LocalZone() {
  const { state, dispatch } = useStore();
  const tileId = state.screenParams.tileId;
  const tile = state.map.tiles.find((t) => t.id === tileId);
  const me = state.activePlayer;

  if (!tile) return <div style={{ padding: 40 }}>Region not found.</div>;

  const town = TOWN_TYPES[tile.town] || {};
  const terr = TERRAINS[tile.terrain];

  const facilities = [];
  if (town.recruit) {
    facilities.push({
      id: "recruit", icon: "⚔️", name: "Mustering Field",
      desc: "Hire troops to garrison or join your retinue.",
      action: () => dispatch({ type: "SET_SCREEN", screen: "recruit", params: { tileId } }),
    });
  }
  if (town.shop) {
    facilities.push({
      id: "shop", icon: "🏪", name: "Market",
      desc: "Equipment and consumables.",
      action: () => dispatch({ type: "SET_SCREEN", screen: "shop", params: { tileId } }),
    });
  }
  facilities.push({
    id: "hero", icon: "👑", name: "Council Chamber",
    desc: "Manage your hero, perks, and equipment.",
    action: () => dispatch({ type: "SET_SCREEN", screen: "upgrade", params: { tileId } }),
  });
  facilities.push({
    id: "encounter", icon: "🎲", name: "Tavern Rumors",
    desc: "Hear of strange happenings in the land.",
    action: () => {
      const enc = ENCOUNTERS[Math.floor(Math.random() * ENCOUNTERS.length)];
      dispatch({ type: "SET_SCREEN", screen: "encounter", params: { tileId, encId: enc.id, optional: true } });
    },
  });
  if (town.defBonus || tile.owner === me) {
    facilities.push({
      id: "defense", icon: "🛡️", name: "Defense Drills",
      desc: "Practice the defense minigame here.",
      action: () => dispatch({ type: "SET_SCREEN", screen: "defense", params: { tileId, training: true } }),
    });
  }

  return (
    <div className="parchment full" style={{ overflow: "auto", padding: 24 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }} className="col gap-3">
        <div className="row between center">
          <button className="btn btn-ghost" onClick={() => dispatch({ type: "SET_SCREEN", screen: "map" })}>
            ← World Map
          </button>
          <div className="row gap-3 center">
            {tile.owner && <Crest faction={tile.owner} size={32} />}
            <div className="h-display" style={{ fontSize: 24 }}>{town.name || terr.name}</div>
            <span className="pill">{terr.name}</span>
          </div>
          <div style={{ width: 120 }} />
        </div>

        <div className="panel" style={{ background: "var(--bg-1)", padding: 24 }}>
          <div className="row gap-4">
            <div style={{
              width: 200, height: 160, borderRadius: 12,
              background: terr.color, border: "3px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 80, boxShadow: "var(--shadow-2)",
            }}>{town.icon || terr.icon}</div>
            <div className="col gap-2 flex1">
              <div className="h-display" style={{ fontSize: 16, color: "var(--ink-soft)" }}>Region Overview</div>
              <div style={{ fontSize: 14, color: "var(--ink)" }}>{flavorText(tile)}</div>
              <div className="row gap-2" style={{ marginTop: 6, flexWrap: "wrap" }}>
                <span className="pill">+{tile.gold + (town.goldBonus || 0)}g income</span>
                {terr.defBonus > 0 && <span className="pill">+{terr.defBonus} terrain def</span>}
                {town.defBonus && <span className="pill">+{town.defBonus} town def</span>}
                {tile.owner
                  ? <span className="pill">{FACTIONS[tile.owner].short}</span>
                  : <span className="pill">Unclaimed</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="row gap-3" style={{ flexWrap: "wrap" }}>
          {facilities.map((f) => (
            <div
              key={f.id}
              className="panel slide-up"
              style={{ flex: "1 1 240px", cursor: "pointer", minWidth: 240 }}
              onClick={f.action}
            >
              <div className="row gap-3 center">
                <div style={{ fontSize: 38 }}>{f.icon}</div>
                <div className="col">
                  <div className="h-display" style={{ fontSize: 14 }}>{f.name}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{f.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {tile.garrison && tile.garrison.length > 0 && (
          <div className="panel">
            <div className="panel-title">Garrison</div>
            <div className="row gap-2" style={{ flexWrap: "wrap" }}>
              {tile.garrison.map((g, i) => <UnitCard key={i} unitId={g.unit} count={g.count} variant="full" />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
