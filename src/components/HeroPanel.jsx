/* HeroPanel — portrait, level, HP/MP/XP bars. `compact` is a small inline form. */
import { HEROES, heroXpForLevel } from "../data/heroes.js";
import { FACTIONS } from "../data/factions.js";

export function HeroPanel({ player, compact = false, onClick }) {
  const h = player.hero;
  const def = HEROES[h.id];
  const fac = FACTIONS[player.faction];
  const xpForNext = heroXpForLevel(h.lvl + 1);
  const xpForCurr = heroXpForLevel(h.lvl);
  const xpProg = Math.max(0, Math.min(1, (h.xp - xpForCurr) / (xpForNext - xpForCurr)));

  if (compact) {
    return (
      <div onClick={onClick} className="row gap-2 center" style={{
        cursor: onClick ? "pointer" : "default",
        padding: "4px 8px",
        background: "var(--bg-2)", border: "2px solid var(--line)", borderRadius: 8,
      }}>
        <div style={{ fontSize: 22 }}>{def.portrait}</div>
        <div className="col">
          <div className="h-ui" style={{ fontSize: 12 }}>{def.name} · L{h.lvl}</div>
          <div className="bar bar-hp" style={{ width: 90 }}>
            <div style={{ width: `${(h.hp / h.maxHp) * 100}%` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
      <div className="row gap-3">
        <div style={{
          width: 72, height: 72,
          background: fac.palette.primary, border: "2px solid var(--line)", borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 42, boxShadow: "var(--shadow-1)",
        }}>{def.portrait}</div>
        <div className="col flex1 gap-1">
          <div className="row between">
            <div className="h-display" style={{ fontSize: 15 }}>{def.name}</div>
            <span className="pill">Lv {h.lvl}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>{fac.name}</div>
          <div className="col gap-1" style={{ marginTop: 4 }}>
            <div className="row between" style={{ fontSize: 11 }}><span>HP</span><span className="numeric">{Math.round(h.hp)}/{h.maxHp}</span></div>
            <div className="bar bar-hp"><div style={{ width: `${(h.hp / h.maxHp) * 100}%` }} /></div>
            <div className="row between" style={{ fontSize: 11 }}><span>MP</span><span className="numeric">{Math.round(h.mp)}/{h.maxMp}</span></div>
            <div className="bar bar-mp"><div style={{ width: `${(h.mp / h.maxMp) * 100}%` }} /></div>
            <div className="row between" style={{ fontSize: 11 }}><span>XP</span><span className="numeric">{h.xp}/{xpForNext}</span></div>
            <div className="bar bar-xp"><div style={{ width: `${xpProg * 100}%` }} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
