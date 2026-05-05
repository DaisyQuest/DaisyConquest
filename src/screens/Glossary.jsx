/* Glossary — the bestiary. Reachable from the title screen.
   Three tabs:
     - Heroes: the four playable lord archetypes plus the bandit captain
       (the only NPC hero that fights against the player).
     - Armies: every troop type, grouped by faction; bandits at the bottom
       under their own neutral-hostile heading.
     - Wilds: the random-encounter NPCs and beasts (witches, wolves, etc.)
       sourced from data/encounters.js.

   Every entry carries a "friendly" or "hostile" pill so the player can see
   at a glance who fights for them and who against — the user's stated
   ask. We default heroes/non-bandit units to friendly because any of them
   can wind up in the player's command depending on faction picks. */
import { useState, useMemo } from "react";
import { useStore } from "../core/store.jsx";
import { HEROES } from "../data/heroes.js";
import { UNITS, TRAIT_INFO } from "../data/units.js";
import { FACTIONS, FACTION_LIST } from "../data/factions.js";

const TABS = [
  { id: "heroes",  label: "Heroes",  icon: "👑" },
  { id: "armies",  label: "Armies",  icon: "⚔" },
  { id: "wilds",   label: "Wilds",   icon: "🐺" },
];

export function GlossaryScreen() {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState("heroes");
  const [filter, setFilter] = useState("");

  const counts = useMemo(() => ({
    heroes: Object.keys(HEROES).length,
    armies: Object.keys(UNITS).length,
    wilds:  WILD_ENTRIES.length,
  }), []);

  return (
    <div
      className="parchment full"
      style={{ overflow: "hidden", padding: 16, display: "flex", flexDirection: "column" }}
    >
      <div style={{
        maxWidth: 1180, width: "100%", margin: "0 auto",
        flex: 1, display: "flex", flexDirection: "column", minHeight: 0,
      }} className="gap-2">

        <div className="row between center">
          <button className="btn btn-ghost" onClick={() => dispatch({ type: "SET_SCREEN", screen: "main" })}>
            ← Title
          </button>
          <div className="h-display" style={{ fontSize: 18 }}>📖 Bestiary</div>
          <input
            className="numeric"
            placeholder="Search…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: "4px 10px", fontSize: 11,
              width: 160,
              background: "var(--bg-1)", border: "2px solid var(--line)",
              borderRadius: 6, color: "var(--ink)",
            }}
          />
        </div>

        <div className="row gap-2 tab-strip">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`btn ${tab === t.id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setTab(t.id)}
            >
              <span style={{ fontSize: 13 }}>{t.icon}</span> {t.label}
              <span className="pill" style={{ fontSize: 10, marginLeft: 6 }}>{counts[t.id]}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
          {tab === "heroes" && <HeroesTab filter={filter} />}
          {tab === "armies" && <ArmiesTab filter={filter} />}
          {tab === "wilds"  && <WildsTab  filter={filter} />}
        </div>

        <div style={{ fontSize: 10, color: "var(--ink-soft)", textAlign: "center", lineHeight: 1.5 }}>
          {state.humanFaction
            ? <>Friendly = {FACTIONS[state.humanFaction]?.name} (your house{state.coopFaction ? " + ally" : ""}). Hostile = brigands and wilds. The other three houses become friendly or rival depending on your faction picks.</>
            : <>Friendly = your future house. Hostile = brigands and wilds. The other houses become friendly or rival once you start a campaign.</>}
        </div>
      </div>
    </div>
  );
}

/* ── Heroes tab ──────────────────────────────────────────────────── */

function HeroesTab({ filter }) {
  const norm = filter.trim().toLowerCase();
  // Order: 4 playable lords, then bandit chief at the bottom under a divider.
  const playable = FACTION_LIST.map((fid) => ({
    id: FACTIONS[fid].heroStarter,
    fac: fid,
  })).filter((x) => x.id);
  const bandits = ["bandit_chief"];
  const matches = (h) => {
    if (!norm) return true;
    return (
      h.name.toLowerCase().includes(norm)
      || (h.desc || "").toLowerCase().includes(norm)
    );
  };

  return (
    <div className="col gap-3">
      <div>
        <SectionHeader label="Lords of the Four Houses" />
        <div
          style={{
            display: "grid", gap: 8,
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          }}
        >
          {playable
            .filter((p) => matches(HEROES[p.id]))
            .map((p) => (
              <HeroCard key={p.id} heroId={p.id} faction={p.fac} affinity="friendly" />
            ))}
        </div>
      </div>

      <div>
        <SectionHeader label="Captains of the Wilds" />
        <div
          style={{
            display: "grid", gap: 8,
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          }}
        >
          {bandits.filter((id) => matches(HEROES[id])).map((id) => (
            <HeroCard key={id} heroId={id} affinity="hostile" />
          ))}
        </div>
      </div>
    </div>
  );
}

function HeroCard({ heroId, faction, affinity }) {
  const h = HEROES[heroId];
  if (!h) return null;
  const fac = faction ? FACTIONS[faction] : null;
  return (
    <div className="panel" style={{ padding: 10 }}>
      <div className="row gap-2 center" style={{ marginBottom: 6 }}>
        <div style={{
          width: 48, height: 48, flexShrink: 0,
          background: fac?.palette?.primary || "var(--bg-1)",
          borderRadius: 10, border: "2px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, boxShadow: "var(--shadow-1)",
        }}>{h.portrait}</div>
        <div className="col flex1" style={{ minWidth: 0, lineHeight: 1.2 }}>
          <div className="row gap-2 center between">
            <div className="h-display" style={{ fontSize: 14 }}>{h.name}</div>
            <AffinityPill kind={affinity} />
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-soft)" }}>
            {fac ? fac.name : "Neutral"}
          </div>
        </div>
      </div>

      <div style={{ fontSize: 11, color: "var(--ink)", marginBottom: 6, fontStyle: "italic", lineHeight: 1.4 }}>
        {h.desc}
      </div>

      <div className="row gap-2" style={{ fontSize: 10, fontFamily: "var(--font-mono)", marginBottom: 6 }}>
        <span>❤ {h.base.hp}</span>
        <span>⚔ {h.base.atk}</span>
        <span>🛡 {h.base.def}</span>
        <span>⚡ {h.base.spd}</span>
        <span>💧 {h.base.mp}</span>
      </div>

      {h.abilities && h.abilities.length > 0 && (
        <div className="col gap-1">
          {h.abilities.map((a) => (
            <div
              key={a.id}
              style={{
                fontSize: 10,
                background: "var(--bg-1)",
                border: "1px solid var(--line)",
                borderRadius: 4,
                padding: "3px 6px",
              }}
            >
              <span style={{ fontSize: 12, marginRight: 4 }}>{a.icon}</span>
              <b>{a.name}</b>
              <span style={{ color: "var(--ink-soft)", marginLeft: 4 }}>
                · {a.cost} MP / {a.cd}s
              </span>
              <div style={{ color: "var(--ink-soft)", marginLeft: 18 }}>{a.effect}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Armies tab ──────────────────────────────────────────────────── */

function ArmiesTab({ filter }) {
  const norm = filter.trim().toLowerCase();
  const groups = [
    ...FACTION_LIST.map((fid) => ({
      id: fid,
      title: FACTIONS[fid].name,
      crest: FACTIONS[fid].crest,
      motto: FACTIONS[fid].motto,
      affinity: "friendly",
      units: Object.values(UNITS).filter((u) => u.faction === fid),
    })),
    {
      id: "bandit",
      title: FACTIONS.bandit.name,
      crest: FACTIONS.bandit.crest,
      motto: FACTIONS.bandit.motto,
      affinity: "hostile",
      units: Object.values(UNITS).filter((u) => u.faction === "bandit"),
    },
  ];

  const matches = (u) =>
    !norm
    || u.name.toLowerCase().includes(norm)
    || u.desc.toLowerCase().includes(norm)
    || (u.traits || []).some((t) => t.toLowerCase().includes(norm));

  return (
    <div className="col gap-3">
      {groups.map((g) => {
        const filtered = g.units.filter(matches);
        if (filtered.length === 0) return null;
        return (
          <div key={g.id}>
            <div className="row between center" style={{ marginBottom: 4 }}>
              <SectionHeader label={`${g.crest} ${g.title}`} />
              <div className="row gap-2 center">
                <span style={{ fontSize: 10, color: "var(--ink-soft)", fontStyle: "italic" }}>
                  &ldquo;{g.motto}&rdquo;
                </span>
                <AffinityPill kind={g.affinity} />
              </div>
            </div>
            <div
              style={{
                display: "grid", gap: 6,
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              }}
            >
              {filtered.map((u) => <UnitGlossaryCard key={u.id} unit={u} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UnitGlossaryCard({ unit }) {
  const fac = FACTIONS[unit.faction];
  return (
    <div className="panel" style={{ padding: 8 }}>
      <div className="row gap-2 center" style={{ marginBottom: 4 }}>
        <div style={{
          width: 32, height: 32, flexShrink: 0,
          background: fac?.palette?.primary || "#888",
          borderRadius: 6, border: "2px solid var(--line)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>{unit.icon}</div>
        <div className="col flex1" style={{ minWidth: 0, lineHeight: 1.2 }}>
          <div className="h-ui" style={{ fontSize: 11, fontWeight: 700 }}>{unit.name}</div>
          <div style={{ fontSize: 9, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            T{unit.tier} · {unit.role}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 10, fontStyle: "italic", color: "var(--ink-soft)", marginBottom: 4, lineHeight: 1.4 }}>
        {unit.desc}
      </div>
      <div className="row gap-2" style={{ fontSize: 10, fontFamily: "var(--font-mono)", marginBottom: 4 }}>
        <span>❤{unit.hp}</span>
        <span>⚔{unit.atk}</span>
        <span>🛡{unit.def}</span>
        <span>⚡{unit.spd}</span>
        {unit.range > 1 && <span>🏹{unit.range}</span>}
      </div>
      {unit.traits.length > 0 && (
        <div className="row gap-1" style={{ flexWrap: "wrap" }}>
          {unit.traits.map((t) => (
            <span
              key={t}
              className="pill"
              style={{ fontSize: 9, cursor: "help" }}
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

/* ── Wilds tab ───────────────────────────────────────────────────── */

/* Distilled NPC entries pulled from the encounter table plus a couple of
   stand-alone wilderness-creature entries the encounter table only hints
   at (the Witch and Wolf Pack) — turning random-event prose into
   "creature card" reference data. */
const WILD_ENTRIES = [
  { id: "bandits", icon: "🏴", name: "Brigands",
    affinity: "hostile",
    desc: "Hungry hosts that roam unwatched roads and unclaimed wilds. Their captain leads from the front.",
    note: "Encountered in burning villages and unowned forts.",
  },
  { id: "wolfpack", icon: "🐺", name: "Wolf Pack",
    affinity: "hostile",
    desc: "Yellow eyes ringing the firelight. A bad night made worse.",
    note: "May yield a Direwolf mount if their alpha can be tamed.",
  },
  { id: "oldwitch", icon: "🔮", name: "Hut-witch",
    affinity: "hostile",
    desc: "Sits in a hut on chicken legs. Trades curios for memories.",
    note: "Can grant amulets, potions, or curses. She decides.",
  },
  { id: "merchant", icon: "🛒", name: "Merchant Caravan",
    affinity: "friendly",
    desc: "Wagons creak past, stacked with goods. Will pay for safe passage — or resist a tax.",
    note: "Can be escorted (gold on arrival), taxed (more gold, sometimes blood), or ignored.",
  },
  { id: "smith", icon: "🔨", name: "Wandering Smith",
    affinity: "friendly",
    desc: "Grimy traveller who refits gear for a price. Will haggle, sometimes graciously.",
    note: "Sells longswords. May walk off if insulted.",
  },
  { id: "deserters", icon: "⚔️", name: "Deserters",
    affinity: "friendly",
    desc: "Battered soldiers from another lord, willing to swear new colours.",
    note: "Can be recruited (40g for two Men-at-Arms) or made an example of.",
  },
  { id: "chapel", icon: "⛪", name: "Ruined Chapel",
    affinity: "hostile",
    desc: "Crows wheel above broken stone. The air feels watched.",
    note: "Pry the chest, pray, or move on. The watcher does not always reward devotion.",
  },
];

function WildsTab({ filter }) {
  const norm = filter.trim().toLowerCase();
  const filtered = WILD_ENTRIES.filter((e) =>
    !norm
    || e.name.toLowerCase().includes(norm)
    || e.desc.toLowerCase().includes(norm)
  );
  return (
    <div className="col gap-2">
      <SectionHeader label="Wilderness & Encounters" />
      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 4, fontStyle: "italic" }}>
        Strangers and creatures the road throws up. None command armies; some travel with them.
      </div>
      <div
        style={{
          display: "grid", gap: 8,
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        }}
      >
        {filtered.map((e) => (
          <div key={e.id} className="panel" style={{ padding: 10 }}>
            <div className="row gap-2 center" style={{ marginBottom: 6 }}>
              <div style={{
                width: 40, height: 40, flexShrink: 0,
                background: "var(--bg-1)",
                borderRadius: 8, border: "2px solid var(--line)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
              }}>{e.icon}</div>
              <div className="col flex1" style={{ minWidth: 0, lineHeight: 1.2 }}>
                <div className="row between center">
                  <div className="h-display" style={{ fontSize: 13 }}>{e.name}</div>
                  <AffinityPill kind={e.affinity} />
                </div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: "var(--ink)", lineHeight: 1.4, marginBottom: 4 }}>
              {e.desc}
            </div>
            <div style={{ fontSize: 10, color: "var(--ink-soft)", fontStyle: "italic", lineHeight: 1.4 }}>
              {e.note}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── shared bits ────────────────────────────────────────────────── */

function SectionHeader({ label }) {
  return (
    <div
      className="h-display"
      style={{
        fontSize: 13,
        color: "var(--ink-soft)",
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        marginBottom: 6,
        marginTop: 2,
      }}
    >
      {label}
    </div>
  );
}

function AffinityPill({ kind }) {
  const friendly = kind === "friendly";
  return (
    <span
      className="pill"
      style={{
        fontSize: 9,
        background: friendly ? "rgba(95,176,95,0.22)" : "rgba(196,74,74,0.22)",
        color: friendly ? "var(--green-dk)" : "var(--blood)",
        border: `1px solid ${friendly ? "rgba(95,176,95,0.55)" : "rgba(196,74,74,0.55)"}`,
        fontWeight: 700,
      }}
    >
      {friendly ? "🤝 Friendly" : "⚔ Hostile"}
    </span>
  );
}

