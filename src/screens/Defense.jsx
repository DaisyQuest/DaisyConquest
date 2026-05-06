/* Defense — three modes share a single screen id "defense":
   1. HUB (no pendingDefense, no training):   tabbed home for the system
      — Overview shows live threats and at-risk holdings, Training launches
      a practice raid, Log filters the campaign log to defense events.
   2. GATE (pendingDefense set, solo):        a brace overlay before the
      minigame so the player isn't dropped into a wave they can't react to.
      In coop, the Handoff screen has already passed control, so we skip the
      brace and go straight to the minigame.
   3. MINIGAME (training OR pendingDefense):  the wave-based defense game
      itself. Click a unit, click a slot, hold the base.

   Routing is internal — the reducer still flips screen:"defense" the same
   way for raids and training. The hub is reachable from the GoldBar nav. */
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../core/store.jsx";
import { Defense } from "../systems/defense.js";
import { FACTIONS, FACTION_LIST } from "../data/factions.js";
import { UNITS } from "../data/units.js";
import { TOWN_TYPES, hexNeighbors } from "../data/map.js";
import { GoldBar } from "../components/GoldBar.jsx";
import { TutorialOverlay } from "../components/TutorialOverlay.jsx";

export function DefenseScreen() {
  const { state } = useStore();
  const training = !!state.screenParams?.training;
  const raidActive = !!state.pendingDefense;
  if (!training && !raidActive) return <DefenseHub />;
  return <DefenseGate training={training} />;
}

/* ── Hub ──────────────────────────────────────────────────────────── */

const TABS = [
  { id: "overview", label: "Overview", icon: "🛡️" },
  { id: "training", label: "Training", icon: "🎯" },
  { id: "log",      label: "Log",      icon: "📜" },
];

function DefenseHub() {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState("overview");
  const humanIds = useMemo(
    () => [state.humanFaction, state.coopFaction].filter(Boolean),
    [state.humanFaction, state.coopFaction],
  );
  const atRisk = useMemo(
    () => computeAtRiskTiles(state.map.tiles, humanIds),
    [state.map.tiles, humanIds],
  );

  const tutorialSteps = [
    {
      selector: "[data-tut='nav-defense']",
      side: "bottom",
      title: "Defense nav badge",
      body: "The red number counts your borders touching enemy land. When it spikes, expect a raid — bulk up the garrison or pull troops back.",
    },
    {
      selector: ".panel-title",
      side: "right",
      title: "Defense hub tabs",
      body: "Overview lists at-risk holdings. Training spawns a no-stakes wave drill. Log replays past sieges so you can review what worked.",
    },
  ];

  return (
    <div className="col" style={{ height: "100%" }}>
      <GoldBar />
      <TutorialOverlay stepId="defense.intro" steps={tutorialSteps} />
      <div className="parchment full" style={{ padding: 16, overflowY: "auto" }}>
        <div className="row between center" style={{ marginBottom: 8 }}>
          <div className="row gap-2 center">
            <div className="h-display" style={{ fontSize: 18 }}>🛡 Defense</div>
            <div style={{ fontSize: 11, color: "var(--ink-soft)" }}>
              Watch borders · drill garrisons · review sieges
            </div>
          </div>
          <button
            className="btn btn-ghost"
            onClick={() => dispatch({ type: "SET_SCREEN", screen: "map" })}
          >
            ← Back to Map
          </button>
        </div>

        <div className="row gap-2 tab-strip" style={{ marginBottom: 8 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`btn ${tab === t.id ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setTab(t.id)}
            >
              <span style={{ fontSize: 13 }}>{t.icon}</span> {t.label}
              {t.id === "overview" && atRisk.length > 0 && (
                <span
                  className="pill"
                  style={{
                    marginLeft: 6,
                    background: "var(--blood)",
                    color: "#fff",
                    fontWeight: 700,
                  }}
                >
                  {atRisk.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === "overview" && <OverviewTab atRisk={atRisk} humanIds={humanIds} />}
        {tab === "training" && <TrainingTab humanIds={humanIds} />}
        {tab === "log" && <LogTab />}
      </div>
    </div>
  );
}

function OverviewTab({ atRisk, humanIds }) {
  const { state, dispatch } = useStore();
  const recentEvents = useMemo(
    () => state.log.filter(isDefenseEvent).slice(-3).reverse(),
    [state.log],
  );

  return (
    <div className="col gap-2">
      <div className="panel" style={{ padding: 10 }}>
        <div className="row between center" style={{ marginBottom: 6 }}>
          <div className="h-display" style={{ fontSize: 14 }}>At-Risk Holdings</div>
          <span className="pill">{atRisk.length}</span>
        </div>
        {atRisk.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            No borders threatened. Every tile you own is either deep in
            friendly territory or well-garrisoned.
          </div>
        ) : (
          <div className="col gap-1">
            {atRisk.map((row) => (
              <button
                key={row.tile.id}
                className="btn btn-ghost"
                onClick={() =>
                  dispatch({
                    type: "SET_SCREEN",
                    screen: "zone",
                    params: { tileId: row.tile.id },
                  })
                }
                style={{ justifyContent: "space-between", width: "100%", padding: "5px 10px", fontSize: 11 }}
              >
                <span className="row gap-2 center">
                  <span style={{ fontSize: 16 }}>{TOWN_TYPES[row.tile.town]?.icon || "📍"}</span>
                  <span>
                    {TOWN_TYPES[row.tile.town]?.name || "Region"}
                    <span style={{ fontSize: 10, color: "var(--ink-soft)", marginLeft: 6 }}>
                      ({row.tile.q},{row.tile.r}) · {FACTIONS[row.tile.owner]?.short}
                    </span>
                  </span>
                </span>
                <span className="row gap-2 center">
                  <span className="pill" title="Hostile neighbors">
                    ⚔ {row.hostiles.length}
                  </span>
                  <span
                    className="pill"
                    style={{
                      background: row.garrison < 2 ? "var(--blood)" : "var(--bg-3)",
                      color: row.garrison < 2 ? "#fff" : "var(--ink)",
                    }}
                    title="Garrison strength"
                  >
                    🛡 {row.garrison}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="panel" style={{ padding: 10 }}>
        <div className="row between center" style={{ marginBottom: 6 }}>
          <div className="h-display" style={{ fontSize: 14 }}>Recent Activity</div>
          <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>
            Held by: {humanIds.map((f) => FACTIONS[f]?.short).filter(Boolean).join(" + ") || "—"}
          </span>
        </div>
        {recentEvents.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
            No raids or sieges logged yet.
          </div>
        ) : (
          <div className="col" style={{ lineHeight: 1.4 }}>
            {recentEvents.map((e, i) => (
              <div key={i} style={{ fontSize: 11 }}>
                <span style={{ color: "var(--ink-soft)" }}>R{e.round}</span> · {e.text}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TrainingTab({ humanIds }) {
  const { state, dispatch } = useStore();
  const ownedTowns = useMemo(
    () =>
      state.map.tiles.filter(
        (t) => humanIds.includes(t.owner) && TOWN_TYPES[t.town]?.recruit,
      ),
    [state.map.tiles, humanIds],
  );

  const launch = (tileId) =>
    dispatch({
      type: "SET_SCREEN",
      screen: "defense",
      params: { tileId, training: true },
    });

  return (
    <div className="panel" style={{ padding: 10 }}>
      <div className="h-display" style={{ fontSize: 14, marginBottom: 4 }}>
        Drill the Garrison
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 8 }}>
        Run a no-stakes wave practice. Outcomes here don&apos;t affect tile
        ownership or your retinue.
      </div>
      {ownedTowns.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
          You don&apos;t yet hold any town that can host a drill. Capture or
          settle a town first.
        </div>
      ) : (
        <div className="col gap-1">
          {ownedTowns.map((t) => (
            <button
              key={t.id}
              className="btn btn-ghost"
              onClick={() => launch(t.id)}
              style={{ justifyContent: "space-between", width: "100%", padding: "5px 10px", fontSize: 11 }}
            >
              <span className="row gap-2 center">
                <span style={{ fontSize: 14 }}>{TOWN_TYPES[t.town]?.icon}</span>
                <span>{TOWN_TYPES[t.town]?.name}</span>
                <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>
                  ({t.q},{t.r})
                </span>
              </span>
              <span className="pill" style={{ fontSize: 10 }}>▶ Drill</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LogTab() {
  const { state } = useStore();
  const events = useMemo(
    () => state.log.filter(isDefenseEvent).slice().reverse(),
    [state.log],
  );
  return (
    <div className="panel" style={{ padding: 12 }}>
      <div className="row between center" style={{ marginBottom: 6 }}>
        <div className="h-display" style={{ fontSize: 14 }}>Defense Log</div>
        {events.length > 0 && (
          <span className="pill" style={{ fontSize: 10 }}>
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {events.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>
          No defense events yet. The log fills as raids resolve.
        </div>
      ) : (
        <div style={{ maxHeight: 240, overflowY: "auto", lineHeight: 1.5 }}>
          {events.map((e, i) => (
            <div key={i} style={{ fontSize: 12 }}>
              <span style={{ color: "var(--ink-soft)" }}>R{e.round}</span> · {e.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Heuristic: keyword scan against the round log. Cheaper than threading a
   typed event channel through every reducer branch. Keep keywords aligned
   with the strings emitted in END_ROUND raid staging and RESOLVE_DEFENSE. */
function isDefenseEvent(e) {
  const t = e?.text || "";
  return /march|wall|overran|defenders|seized|siege|raid/i.test(t);
}

/* At-risk = human-owned, has at least one AI-owned land neighbor.
   Garrison count is reported separately so the UI can highlight low-
   garrison tiles without filtering them out — a thinly-held interior tile
   isn't "at risk", but a thinly-held border tile clearly is. */
export function computeAtRiskTiles(tiles, humanIds) {
  const humanSet = new Set(humanIds.filter(Boolean));
  if (!humanSet.size) return [];
  const out = [];
  for (const t of tiles) {
    if (!humanSet.has(t.owner)) continue;
    const hostiles = hexNeighbors(t, tiles).filter(
      (n) => n.owner && !humanSet.has(n.owner),
    );
    if (!hostiles.length) continue;
    const garrison = (t.garrison || []).reduce((a, s) => a + (s.count || 0), 0);
    out.push({ tile: t, hostiles, garrison });
  }
  // Sort: thinnest garrisons first, then most hostiles.
  out.sort((a, b) => a.garrison - b.garrison || b.hostiles.length - a.hostiles.length);
  return out;
}

/* ── Gate (brace overlay + minigame) ─────────────────────────────── */

function DefenseGate({ training }) {
  const { state } = useStore();
  const isCoop = !!state.coopFaction;
  // Coop already passes control via the Handoff screen — no second brace.
  // Training is opt-in by definition.
  const [braced, setBraced] = useState(isCoop || training);

  if (!braced) {
    return <BraceModal onReady={() => setBraced(true)} />;
  }
  return <DefenseMinigame />;
}

function BraceModal({ onReady }) {
  const { state } = useStore();
  const pd = state.pendingDefense;
  const tile = pd ? state.map.tiles.find((t) => t.id === pd.tileId) : null;
  const attackerFac = pd ? FACTIONS[pd.attackerFaction] : null;
  const defenderFac = tile ? FACTIONS[tile.owner] : null;
  const regionLabel = tile ? (TOWN_TYPES[tile.town]?.name || "your border") : "your border";

  // Any keypress or click acknowledges. Bind on mount so tabbing in works
  // even before the user mouses over the panel.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") return; // don't let Esc fire the raid
      onReady();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onReady]);

  return (
    <div
      onClick={onReady}
      style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(circle at center, rgba(72, 24, 24, 0.8), rgba(20, 8, 8, 0.95))",
        display: "flex", alignItems: "center", justifyContent: "center",
        zIndex: 100, cursor: "pointer",
      }}
    >
      <div className="panel pop-in" style={{ padding: 32, maxWidth: 480, textAlign: "center" }}>
        <div className="h-display" style={{ fontSize: 28, color: "var(--blood)", marginBottom: 8 }}>
          ⚔ RAID INCOMING
        </div>
        <div style={{ fontSize: 14, marginBottom: 4 }}>
          {attackerFac
            ? <><b style={{ color: attackerFac.palette.primary }}>{attackerFac.name}</b> marches on </>
            : "An enemy host marches on "}
          <b>{regionLabel}</b>
          {defenderFac && (
            <span style={{ color: "var(--ink-soft)" }}> ({defenderFac.short})</span>
          )}.
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 16, lineHeight: 1.5 }}>
          Defenders are <b>turrets</b>: they hold their slot and shoot at
          enemies in range. <b>Range</b> matters — archers cover wide arcs,
          melee only swing at foes stepping past their slot. Pick a unit
          below, click a slot to deploy. Right-click a placed unit to recall
          it for free if you need to reposition.
        </div>
        <button className="btn btn-primary" onClick={onReady}>
          Brace for the assault
        </button>
        <div style={{ fontSize: 10, color: "var(--ink-soft)", marginTop: 8 }}>
          Press any key or click anywhere to begin.
        </div>
      </div>
    </div>
  );
}

/* ── Minigame ────────────────────────────────────────────────────── */

function DefenseMinigame() {
  const { state, dispatch } = useStore();
  const training = !!state.screenParams?.training;
  // In real-mode, the tile under attack and the attacker faction live on
  // state.pendingDefense (staged at END_ROUND). In training, fall back to
  // the tile passed via screenParams and a hard-coded enemy faction.
  const tileId = training
    ? state.screenParams.tileId
    : (state.pendingDefense?.tileId ?? state.screenParams.tileId);
  const tile = state.map.tiles.find((t) => t.id === tileId);
  // The defender is the tile owner, NOT activePlayer — in co-op the AI may
  // raid the partner's tile while the other partner happens to be active.
  const defenderFaction = training
    ? state.activePlayer
    : (tile?.owner || state.activePlayer);
  const defenderPlayer = state.players[defenderFaction] || state.players[state.activePlayer];
  const enemyFaction = training
    ? "ash"
    : (state.pendingDefense?.attackerFaction || FACTION_LIST.find((f) => f !== defenderFaction));

  const dsRef = useRef(null);
  if (!dsRef.current) {
    dsRef.current = Defense.init({
      defenderRetinue: defenderPlayer.hero.retinue.map((s) => ({ ...s })),
      attackerFaction: enemyFaction,
      defenderPerks: defenderPlayer.hero.perks || [],
    });
  }
  const [ds, setDs] = useState(dsRef.current);
  const [selected, setSelected] = useState(null);
  const [hoverSlot, setHoverSlot] = useState(null);
  const lastT = useRef(performance.now());

  useEffect(() => {
    if (ds.ended) return;
    let raf;
    const loop = (now) => {
      const dt = Math.min(0.1, (now - lastT.current) / 1000);
      lastT.current = now;
      setDs((prev) =>
        Defense.tick(
          {
            ...prev,
            attackers: prev.attackers.map((a) => ({ ...a })),
            defenders: prev.defenders.map((d) => ({ ...d })),
            waves: prev.waves.map((w) => ({ ...w })),
            availableDefenders: prev.availableDefenders.map((s) => ({ ...s })),
            shots: (prev.shots || []).slice(),
            spawnFlashes: (prev.spawnFlashes || []).slice(),
            floats: prev.floats.slice(),
          },
          dt
        )
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ds.ended]);

  const slots = Defense.SLOT_POSITIONS.map((_, i) => i);
  const placeAt = (slotIdx) => {
    if (!selected) return;
    setDs((prev) =>
      Defense.place(
        {
          ...prev,
          defenders: prev.defenders.slice(),
          availableDefenders: prev.availableDefenders.map((s) => ({ ...s })),
        },
        slotIdx,
        selected
      )
    );
  };
  const refundAt = (slotIdx) => {
    setDs((prev) =>
      Defense.refund(
        {
          ...prev,
          defenders: prev.defenders.slice(),
          availableDefenders: prev.availableDefenders.map((s) => ({ ...s })),
        },
        slotIdx
      )
    );
  };

  // Range circle preview: when the player hovers a slot with a unit
  // selected, show the unit's reach. When hovering a placed defender,
  // show its actual reach. Both use the same Defense.RANGE_SCALE.
  const previewSlot = hoverSlot != null ? hoverSlot : null;
  let previewRange = 0;
  let previewPos = null;
  if (previewSlot != null) {
    const placed = ds.defenders.find((d) => d.slotIdx === previewSlot);
    if (placed) {
      previewRange = placed.range * Defense.RANGE_SCALE;
      previewPos = Defense.SLOT_POSITIONS[previewSlot];
    } else if (selected && UNITS[selected]) {
      previewRange = UNITS[selected].range * Defense.RANGE_SCALE;
      previewPos = Defense.SLOT_POSITIONS[previewSlot];
    }
  }

  const nextWave = ds.waves[ds.waveIdx];
  const upcoming = nextWave ? UNITS[nextWave.unitId] : null;

  const finish = () => {
    if (training) {
      dispatch({ type: "SET_SCREEN", screen: "zone", params: { tileId } });
      return;
    }
    // Real defense raid: resolve the outcome through the reducer so the
    // tile flips on a loss, victory checks fire, and pendingDefense clears.
    dispatch({
      type: "RESOLVE_DEFENSE",
      tileId,
      won: !!ds.won,
      attackerFaction: enemyFaction,
    });
  };

  const pathD = "M " + Defense.PATH.map((p) => `${p.x} ${p.y}`).join(" L ");
  const regionLabel = tile ? (TOWN_TYPES[tile.town]?.name || "Region") : "Region";

  return (
    <div className="parchment full" style={{ display: "flex", flexDirection: "column", padding: 0 }}>
      <div className="row between center" style={{
        padding: "12px 24px",
        borderBottom: "2px solid var(--line)",
        background: "var(--bg-2)",
      }}>
        <button className="btn btn-ghost" onClick={finish}>← Leave</button>
        <div className="h-display" style={{ fontSize: 18 }}>
          🛡 Defend the {regionLabel}{training ? " (Training)" : ""}
        </div>
        <div className="row gap-3 center">
          <span className="pill">Wave {Math.min(ds.waves.length, ds.waveIdx + 1)}/{ds.waves.length}</span>
          {/* Gate HP bar — stones-and-mortar styling so it reads as a
              fortress, not a generic pill. Pulses red when the gate is
              critically wounded so the player feels the danger. */}
          <div
            className={`gate-bar${ds.baseHp < 30 ? " critical" : ""}`}
            title={`Gate ${ds.baseHp} / ${ds.maxBaseHp || 150}`}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <span style={{ fontSize: 16 }}>🏰</span>
            <div style={{
              position: "relative",
              width: 110, height: 14,
              background: "rgba(8,4,2,0.7)",
              border: "2px solid var(--line)",
              borderRadius: 4,
              overflow: "hidden",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 1px 2px rgba(0,0,0,0.4)",
            }}>
              <div style={{
                position: "absolute", inset: 0,
                width: `${Math.max(0, ds.baseHp / (ds.maxBaseHp || 150)) * 100}%`,
                background: ds.baseHp < 30
                  ? "linear-gradient(180deg, #d4503a, #7a1f1f)"
                  : "linear-gradient(180deg, #c8a070, #7a5a32)",
                transition: "width 240ms ease-out, background 240ms ease-out",
              }} />
              {/* Stone seam markings — three vertical hairlines so the
                  bar reads as masonry, not a generic progress bar. */}
              <div style={{
                position: "absolute", inset: 0,
                background: "repeating-linear-gradient(90deg, transparent 0 26px, rgba(0,0,0,0.35) 26px 27px)",
                pointerEvents: "none",
              }} />
            </div>
            <span className="numeric" style={{ fontSize: 12, fontWeight: 800 }}>
              {ds.baseHp}
            </span>
          </div>
        </div>
      </div>

      <div className="defense-field" style={{ flex: 1, position: "relative" }}>
        {/* Painted ground — repeating textures sell the parade-ground look
            and let the path read as a worn track instead of a doodle. */}
        <div className="defense-ground" />
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        >
          {/* Worn path: shadow band + sand fill + center stripe.
              The center stripe animates its dashoffset so the path
              reads as flowing toward the gate. */}
          <path d={pathD} stroke="rgba(42,29,18,0.55)" strokeWidth="8" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <path d={pathD} stroke="#d4b885" strokeWidth="5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
          <path
            className="defense-path-flow"
            d={pathD}
            stroke="#7a5828" strokeWidth="0.8" fill="none"
            strokeDasharray="2 2.5"
            strokeLinejoin="round" strokeLinecap="round"
            opacity="0.7"
          />
          {/* Spawn marker (left edge) — bone arch the wave pours out of. */}
          <g transform={`translate(${Defense.PATH[0].x - 1}, ${Defense.PATH[0].y - 4})`}>
            <rect x="0" y="0" width="2" height="8" fill="#3a2a1a" rx="0.4" />
            <rect x="-1" y="-1" width="4" height="2" fill="#5a3e22" rx="0.4" />
            <rect x="-0.6" y="0.6" width="3.2" height="0.8" fill="rgba(0,0,0,0.5)" />
          </g>
          {/* Gate at the end — the keep the player is defending. Stones,
              gold trim, and a small banner crowning the finish line. */}
          <g transform={`translate(${100 - 1}, ${40 - 6})`}>
            <rect x="-7" y="0" width="9" height="12" fill="#3a2a1a" rx="0.6" />
            <rect x="-6.2" y="0.5" width="7.4" height="11" fill="#7a5e3e" rx="0.4" />
            <rect x="-6.2" y="0.5" width="7.4" height="2" fill="#a07a4a" />
            <rect x="-6.2" y="6"   width="7.4" height="0.6" fill="rgba(0,0,0,0.4)" />
            <rect x="-3.5" y="2"   width="3" height="6" fill="#1a0c08" rx="1" />
            <polygon points="-7,0 -2.5,-3 2,0" fill="#a08050" />
            <rect x="-1" y="-3.5" width="0.4" height="3" fill="#3a2a1a" />
            <polygon points="-0.6,-3.4 1.4,-2.6 -0.6,-1.8" fill="var(--gold)" />
          </g>
          {/* Persistent range rings on every placed defender — keeps it
              easy to see who covers what during a fight. */}
          {ds.defenders.map((d) => {
            const p = Defense.SLOT_POSITIONS[d.slotIdx];
            if (!p) return null;
            const r = d.range * Defense.RANGE_SCALE;
            return (
              <circle
                key={`r_${d.uid}`}
                cx={p.x} cy={p.y} r={r}
                fill={FACTIONS[defenderFaction].palette.primary}
                fillOpacity="0.06"
                stroke={FACTIONS[defenderFaction].palette.primary}
                strokeOpacity="0.35"
                strokeWidth="0.4"
                strokeDasharray="0.8 0.8"
                pointerEvents="none"
              />
            );
          })}
          {/* Hover preview ring — bolder, only while the player is sizing
              up a slot. Drives the "where do I put this archer" feel. */}
          {previewPos && previewRange > 0 && (
            <circle
              cx={previewPos.x} cy={previewPos.y} r={previewRange}
              fill="rgba(255, 220, 100, 0.10)"
              stroke="rgba(255, 200, 60, 0.8)"
              strokeWidth="0.6"
              pointerEvents="none"
            />
          )}

          {/* Wave spawn flashes — a brief expanding ring at the gate every
              time a new attacker walks through. Tells the player a new
              foe just entered before the icon resolves. */}
          {(ds.spawnFlashes || []).map((sf) => {
            const r = 2 + (sf.t / sf.life) * 6;
            const op = 1 - (sf.t / sf.life);
            return (
              <circle
                key={sf.id}
                cx={sf.x} cy={sf.y} r={r}
                fill="none"
                stroke="#c44a4a" strokeWidth="0.7"
                strokeOpacity={op * 0.85}
                pointerEvents="none"
              />
            );
          })}

          {/* Projectiles / swings. Ranged shots draw the leading half of
              their flight as a hot streak and a small head where it just
              landed; melee swings draw a stubby slash arc instead. */}
          {(ds.shots || []).map((s) => {
            const k = Math.min(1, s.t / s.life);
            const headX = s.fromX + (s.toX - s.fromX) * k;
            const headY = s.fromY + (s.toY - s.fromY) * k;
            const tailK = Math.max(0, k - 0.45);
            const tailX = s.fromX + (s.toX - s.fromX) * tailK;
            const tailY = s.fromY + (s.toY - s.fromY) * tailK;
            const op = 1 - k * 0.7;
            const color = s.crit ? "#ffd86a" : (s.ranged ? "#fff5d8" : "#ffe1c0");
            return (
              <g key={s.id} pointerEvents="none">
                <line
                  x1={tailX} y1={tailY} x2={headX} y2={headY}
                  stroke={color}
                  strokeWidth={s.ranged ? (s.crit ? 1.2 : 0.8) : 1.6}
                  strokeOpacity={op}
                  strokeLinecap="round"
                />
                {s.ranged && (
                  <circle
                    cx={headX} cy={headY} r={s.crit ? 1.0 : 0.7}
                    fill={color} fillOpacity={op}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {slots.map((s) => {
          const placed = ds.defenders.find((d) => d.slotIdx === s);
          const slotPos = Defense.SLOT_POSITIONS[s];
          const canPlace = !!selected && !placed;
          return (
            <div
              key={s}
              onClick={() => placeAt(s)}
              onContextMenu={(e) => { e.preventDefault(); if (placed) refundAt(s); }}
              onMouseEnter={() => setHoverSlot(s)}
              onMouseLeave={() => setHoverSlot((h) => (h === s ? null : h))}
              title={placed
                ? `${placed.name} L${placed.lvl ?? 1} — ${placed.hp}/${placed.maxHp} hp · atk ${placed.atk} · range ${placed.range} · right-click to recall`
                : (selected
                    ? `Click to deploy ${UNITS[selected]?.name ?? selected}`
                    : "Empty slot — pick a unit below to deploy")}
              style={{
                position: "absolute",
                left: `${slotPos.x}%`, top: `${slotPos.y}%`,
                transform: "translate(-50%, -50%)",
                width: 44, height: 44,
                background: placed
                  ? FACTIONS[defenderFaction].palette.primary
                  : (canPlace ? "rgba(255,220,100,0.35)" : "rgba(255,255,255,0.2)"),
                border: `2px ${placed ? "solid" : "dashed"} ${
                  placed ? "var(--line)"
                  : (canPlace ? "rgba(255,200,60,0.9)" : "rgba(42,29,18,0.5)")
                }`,
                borderRadius: 8,
                cursor: placed ? "context-menu" : (canPlace ? "pointer" : "default"),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 22,
                zIndex: 3,
                transition: "background 80ms, border-color 80ms",
              }}
            >
              {placed ? placed.icon : (canPlace ? "+" : "")}
              {placed && (placed.lvl ?? 1) > 1 && (
                <span
                  className="numeric"
                  style={{
                    position: "absolute", top: -6, right: -6,
                    fontSize: 10, fontWeight: 800,
                    background: "var(--gold)", color: "var(--ink)",
                    border: "1px solid var(--line)", borderRadius: 8,
                    padding: "0 4px", lineHeight: 1.4,
                  }}
                >L{placed.lvl}</span>
              )}
              {placed && (
                <div style={{
                  position: "absolute", bottom: -6, left: 2, right: 2,
                  height: 3, background: "rgba(0,0,0,0.3)", borderRadius: 2,
                }}>
                  <div style={{
                    width: `${(placed.hp / placed.maxHp) * 100}%`,
                    height: "100%", background: "var(--blood)", borderRadius: 2,
                  }} />
                </div>
              )}
            </div>
          );
        })}

        {ds.attackers.map((a) => {
          const pos = Defense.pathPosAt(a.prog);
          return (
            <div
              key={a.uid}
              style={{
                position: "absolute",
                left: `${pos.x}%`, top: `${pos.y}%`,
                transform: "translate(-50%, -50%)",
                width: 28, height: 28,
                background: FACTIONS[enemyFaction].palette.primary,
                border: "2px solid var(--line)", borderRadius: 6,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14,
                zIndex: 4,
                transition: "left 60ms linear, top 60ms linear",
              }}
            >
              {a.icon}
              <div style={{ position: "absolute", bottom: -5, left: 0, right: 0, height: 2, background: "rgba(0,0,0,0.3)" }}>
                <div style={{ width: `${(a.hp / a.maxHp) * 100}%`, height: "100%", background: "var(--blood)" }} />
              </div>
            </div>
          );
        })}

        {ds.floats.map((f) => (
          <div
            key={f.id}
            className="float-up numeric"
            style={{
              position: "absolute",
              left: `${f.x}%`, top: `${f.y}%`,
              transform: "translate(-50%, -50%)",
              color: f.kind === "ouch" ? "#c84020" : "var(--gold-dk)",
              fontWeight: 800,
              textShadow: "0 1px 0 #fff", zIndex: 6,
            }}
          >{f.text}</div>
        ))}
      </div>

      <div className="col gap-1" style={{
        padding: "10px 24px 12px",
        borderTop: "2px solid var(--line)",
        background: "var(--bg-2)",
      }}>
        <div className="row between center" style={{ fontSize: 11 }}>
          <div className="row gap-3 center">
            <span style={{ color: "var(--ink-soft)" }}>
              Click a unit then click a slot to deploy. Right-click a placed unit to recall.
            </span>
          </div>
          {upcoming && (
            <div className="row gap-2 center" style={{ fontSize: 11 }}>
              <span style={{ color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Next wave:
              </span>
              <span className="pill" title={`${upcoming.name} — atk ${upcoming.atk}, def ${upcoming.def}, hp ${upcoming.hp}, spd ${upcoming.spd}`}>
                {upcoming.icon} {nextWave.count - nextWave.spawned}× {upcoming.name}
              </span>
            </div>
          )}
        </div>
        <div className="row gap-2" style={{ flexWrap: "wrap" }}>
          {ds.availableDefenders.map((s) => {
            const u = UNITS[s.unit];
            if (!u) return null;
            const isSelected = selected === s.unit;
            const lvl = s.lvl ?? 1;
            const m = 1 + Math.max(0, lvl - 1) * 0.10;
            const atk = Math.round(u.atk * m);
            const def = Math.round(u.def * m);
            const hp = Math.round(u.hp * m);
            return (
              <button
                key={s.unit}
                className={`btn ${isSelected ? "btn-primary" : "btn-ghost"}`}
                disabled={s.count <= 0}
                onClick={() => setSelected(isSelected ? null : s.unit)}
                title={`${u.name} L${lvl} — atk ${atk} · def ${def} · hp ${hp} · range ${u.range}`}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "flex-start",
                  gap: 2, padding: "5px 10px", lineHeight: 1.2, minWidth: 110,
                  opacity: s.count <= 0 ? 0.5 : 1,
                }}
              >
                <span className="row gap-1 center" style={{ fontSize: 12, fontWeight: 700 }}>
                  <span style={{ fontSize: 14 }}>{u.icon}</span>
                  {u.name}
                  <span className="pill" style={{ fontSize: 10 }}>×{s.count}</span>
                  {lvl > 1 && (
                    <span className="pill" style={{ fontSize: 9, background: "var(--gold)", color: "var(--ink)" }}>L{lvl}</span>
                  )}
                </span>
                <span style={{
                  fontSize: 10,
                  color: isSelected ? "var(--ink)" : "var(--ink-soft)",
                  fontFamily: "var(--font-mono)",
                }}>
                  ⚔{atk} 🛡{def} ❤{hp} 📏{u.range}
                </span>
              </button>
            );
          })}
          {ds.availableDefenders.every((s) => s.count <= 0) && (
            <span style={{ fontSize: 11, color: "var(--ink-soft)", fontStyle: "italic" }}>
              All defenders deployed. Right-click a slot to recall a unit and reposition.
            </span>
          )}
        </div>
      </div>

      {ds.ended && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 50,
        }}>
          <div className="panel pop-in" style={{ padding: 32, textAlign: "center", maxWidth: 360 }}>
            <div className="h-display" style={{
              fontSize: 32,
              color: ds.won ? "var(--green-dk)" : "var(--blood)",
            }}>{ds.won ? "DEFENDED" : "FALLEN"}</div>
            <div style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 12 }}>
              {ds.won
                ? "The walls hold. The enemy retreats."
                : "The gates broke. The town is lost."}
            </div>
            <button className="btn btn-primary" onClick={finish}>Continue</button>
          </div>
        </div>
      )}
    </div>
  );
}
