/* HexTile — single hex on the world map.
   Big size (120×138) and high-contrast borders so the territory grid reads
   instantly.

   Visibility states:
   - !explored        → fogged silhouette (no terrain hint, no town, no owner)
   - explored && !visible → dim terrain, no live garrison/owner overlay
   - visible              → full render

   ownerKind ("mine" | "ally" | "enemy" | "none") drives border/tint so the
   active player can see at-a-glance which territories are theirs vs the
   coop partner's vs an enemy's. Computed in WorldMap and passed through. */
import { TERRAINS, TOWN_TYPES } from "../data/map.js";
import { FACTIONS } from "../data/factions.js";

export function HexTile({
  tile,
  selected,
  hovered,
  isAdjacentToActive,
  visible = true,
  justRevealed = false,
  ownerKind,
  onClick,
  onHover,
}) {
  const terr = TERRAINS[tile.terrain];
  const explored = !!tile.explored;
  const fogged = !explored;
  // Owner/town/garrison only render when currently visible.
  const fac = visible && tile.owner ? FACTIONS[tile.owner] : null;
  const town = explored && tile.town ? TOWN_TYPES[tile.town] : null;
  const garrisonCount = visible
    ? (tile.garrison || []).reduce((s, g) => s + g.count, 0)
    : 0;

  const fillBase = fogged ? "#3a2e22" : terr.color;
  const ownerOverlay = fac ? fac.palette.primary : null;
  // Stronger faction tint on owned-by-me tiles so the player's territory
  // pops; ally a touch quieter; enemies subdued so they read as foreign
  // without disappearing.
  const ownerOpacity =
    ownerKind === "mine"  ? 0.55 :
    ownerKind === "ally"  ? 0.42 :
    ownerKind === "enemy" ? 0.28 : 0.32;
  const gradId = `tg_${tile.id}`;

  const activate = () => !terr.impassable && onClick && onClick(tile);
  const onKey = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activate();
    }
  };
  const ownerWord =
    ownerKind === "mine"  ? "yours" :
    ownerKind === "ally"  ? "ally" :
    ownerKind === "enemy" ? "rival" : "unclaimed";
  const ariaLabel = fogged
    ? "uncharted territory"
    : [
        town?.name || terr.name,
        fac ? `${fac.short} (${ownerWord})` : "unclaimed",
        garrisonCount ? `garrison ${garrisonCount}` : "",
      ].filter(Boolean).join(", ");

  const classes = [
    "hex",
    "hex-big",
    selected ? "selected" : "",
    terr.impassable ? "disabled" : "",
    fogged ? "fogged" : explored && !visible ? "explored" : "",
    justRevealed ? "just-revealed" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      style={{ left: tile.x, top: tile.y }}
      role={terr.impassable ? undefined : "button"}
      tabIndex={terr.impassable ? -1 : 0}
      aria-label={ariaLabel}
      aria-pressed={selected ? true : undefined}
      onClick={activate}
      onKeyDown={onKey}
      onMouseEnter={() => onHover && onHover(tile)}
      onMouseLeave={() => onHover && onHover(null)}
      onFocus={() => onHover && onHover(tile)}
      onBlur={() => onHover && onHover(null)}
    >
      <svg viewBox="0 0 120 138" width="120" height="138">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fillBase} stopOpacity="1" />
            <stop offset="100%" stopColor={fillBase} stopOpacity="0.78" />
          </linearGradient>
        </defs>
        <polygon
          points="60,3 114,34 114,104 60,135 6,104 6,34"
          fill={`url(#${gradId})`}
          stroke="#2a1d12" strokeWidth="3"
          strokeLinejoin="round"
        />
        {ownerOverlay && (
          <polygon
            points="60,3 114,34 114,104 60,135 6,104 6,34"
            fill={ownerOverlay} fillOpacity={ownerOpacity}
            stroke={ownerOverlay} strokeWidth="4" strokeLinejoin="round"
          />
        )}
        {/* Mine: thick gold rim — the headline cue for "this is yours". */}
        {ownerKind === "mine" && !selected && (
          <polygon
            points="60,3 114,34 114,104 60,135 6,104 6,34"
            fill="none" stroke="var(--gold)" strokeWidth="5"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 0 3px rgba(212,175,55,0.55))" }}
          />
        )}
        {/* Ally: dashed gold rim — same family of cue, but distinct from mine. */}
        {ownerKind === "ally" && !selected && (
          <polygon
            points="60,3 114,34 114,104 60,135 6,104 6,34"
            fill="none" stroke="var(--gold)" strokeWidth="3"
            strokeDasharray="8 5" strokeLinejoin="round"
            opacity="0.85"
          />
        )}
        {isAdjacentToActive && !selected && (
          <polygon
            points="60,3 114,34 114,104 60,135 6,104 6,34"
            fill="none" stroke="var(--gold)" strokeWidth="4"
            strokeDasharray="6 4" strokeLinejoin="round"
            opacity="0.7"
          />
        )}
        {hovered && !selected && (
          <polygon
            points="60,3 114,34 114,104 60,135 6,104 6,34"
            fill="rgba(255,255,255,0.18)" stroke="none"
          />
        )}
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        pointerEvents: "none",
      }}>
        <div style={{
          fontSize: 36, lineHeight: 1, marginTop: 8,
          filter: "drop-shadow(0 2px 0 rgba(0,0,0,0.25))",
        }}>{fogged ? "🌫️" : (town?.icon || terr.icon)}</div>
        {town && !fogged && (
          <div className="h-display" style={{
            fontSize: 11, marginTop: 4,
            color: "var(--ink)", textShadow: "0 1px 0 rgba(255,255,255,0.4)",
            letterSpacing: "0.04em",
          }}>{town.name}</div>
        )}
        {garrisonCount > 0 && (
          <div className="numeric" style={{
            position: "absolute", bottom: 12, right: 18,
            background: "var(--ink)", color: "var(--bg-1)",
            fontSize: 13, fontWeight: 800,
            borderRadius: 999, padding: "2px 8px",
            border: "2px solid var(--gold)",
          }}>{garrisonCount}</div>
        )}
        {fac && (
          <div style={{
            position: "absolute", top: 10, left: 14,
            fontSize: 18, filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.4))",
          }}>{fac.crest}</div>
        )}
      </div>
    </div>
  );
}
