/* Handoff — full-screen turn-transition for local co-op.
   Shown briefly between players so the partner physically picking up the
   device knows it's their turn now. Click anywhere (or press any key) to
   continue.

   Triggered when a co-op partner ends their turn or hits Swap Control.
   The reducer sets `screenParams.next` to whatever screen the new active
   player should land on (usually "map"). */
import { useEffect } from "react";
import { useStore } from "../core/store.jsx";
import { FACTIONS } from "../data/factions.js";
import { Crest } from "../components/Crest.jsx";

export function Handoff() {
  const { state, dispatch } = useStore();
  const target = state.activePlayer;
  const fac = FACTIONS[target];
  const next = state.screenParams?.next || "map";
  const partnerName = fac?.name || "the next house";

  const continueTurn = () => dispatch({ type: "SET_SCREEN", screen: next });

  // Keyboard: any key continues
  useEffect(() => {
    const onKey = (e) => {
      // Avoid swallowing tweaks (`~`) and dev-tool shortcuts.
      if (e.key === "`" || e.key === "~" || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      continueTurn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!fac) {
    // Fallback — shouldn't normally happen, but don't trap the player.
    return (
      <div className="parchment full" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <button className="btn btn-primary" onClick={continueTurn}>Continue</button>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Pass control to ${partnerName} — click to continue`}
      onClick={continueTurn}
      className="parchment full"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 40,
        background: `radial-gradient(ellipse at center, ${fac.palette.primary}30 0%, var(--bg-0) 80%)`,
      }}
    >
      <div className="col center pop-in" style={{ gap: 24, textAlign: "center", maxWidth: 560 }}>
        <Crest faction={target} size={140} ringed />
        <div>
          <div className="h-display" style={{
            fontSize: 14,
            color: "var(--ink-soft)",
            letterSpacing: "0.18em",
          }}>Pass control to</div>
          <div className="h-display" style={{
            fontSize: 44,
            color: fac.palette.primary,
            textShadow: "0 2px 0 rgba(0,0,0,0.25)",
            marginTop: 4,
          }}>{fac.name}</div>
          <div style={{ fontSize: 13, color: "var(--ink-soft)", fontStyle: "italic", marginTop: 8 }}>
            &ldquo;{fac.motto}&rdquo;
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-faint)", textTransform: "uppercase", letterSpacing: "0.16em" }}>
          Click anywhere or press any key to continue
        </div>
      </div>
    </div>
  );
}
