/* UnitCard — three variants:
   - "compact" (default): inline pill with portrait + name + count
   - "full": bordered panel with stats and traits
   - "battle": just a portrait swatch sized for the battle screen */
import { UNITS } from "../data/units.js";
import { FACTIONS } from "../data/factions.js";

export function UnitCard({ unitId, count, variant = "compact", onClick, selected, dim }) {
  const u = UNITS[unitId];
  if (!u) return null;
  const fac = FACTIONS[u.faction];

  if (variant === "battle") {
    return (
      <div title={u.name} style={{
        width: 36, height: 36,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: fac.palette.primary, color: "#fff",
        borderRadius: 8, border: "2px solid #2a1d12",
        fontSize: 18, boxShadow: "0 2px 0 rgba(0,0,0,0.3)",
      }}>{u.icon}</div>
    );
  }

  if (variant === "full") {
    return (
      <div className={`panel ${selected ? "selected" : ""}`} onClick={onClick} style={{
        cursor: onClick ? "pointer" : "default",
        padding: 12, minWidth: 180,
        opacity: dim ? 0.5 : 1,
        outline: selected ? "3px solid var(--gold)" : "none",
      }}>
        <div className="row gap-2 center" style={{ marginBottom: 6 }}>
          <div style={{
            width: 42, height: 42,
            background: fac.palette.primary, borderRadius: 8, border: "2px solid var(--line)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          }}>{u.icon}</div>
          <div className="col flex1">
            <div className="h-display" style={{ fontSize: 13 }}>{u.name}</div>
            <div className="row gap-1" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              <span className="pill">T{u.tier}</span>
              <span className="pill">{u.role}</span>
            </div>
          </div>
        </div>
        <div className="row gap-2" style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>
          <span>❤ {u.hp}</span><span>⚔ {u.atk}</span>
          <span>🛡 {u.def}</span><span>⚡ {u.spd}</span>
          {u.range > 1 && <span>🏹 {u.range}</span>}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6, fontStyle: "italic" }}>{u.desc}</div>
        {u.traits.length > 0 && (
          <div className="row gap-1" style={{ marginTop: 6, flexWrap: "wrap" }}>
            {u.traits.map((t) => <span key={t} className="pill" style={{ fontSize: 10 }}>{t}</span>)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div onClick={onClick} className={selected ? "selected" : ""} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "var(--bg-1)", border: "2px solid var(--line)",
      borderRadius: 6, padding: "4px 8px",
      cursor: onClick ? "pointer" : "default",
      outline: selected ? "2px solid var(--gold)" : "none",
      opacity: dim ? 0.5 : 1,
    }}>
      <div style={{
        width: 24, height: 24,
        background: fac.palette.primary, borderRadius: 4,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14,
      }}>{u.icon}</div>
      <div className="col" style={{ lineHeight: 1.1 }}>
        <span className="h-ui" style={{ fontSize: 11 }}>{u.name}</span>
        {count != null && <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>×{count}</span>}
      </div>
    </div>
  );
}
