/* Tweaks — theme picker, map seed, screen jump, save reset.
   Toggled by the floating button or by pressing `~` (tilde). */
import { useEffect, useRef, useState } from "react";
import { useStore } from "../core/store.jsx";
import { SaveSystem } from "../core/save.js";

const THEMES = [
  { id: "parchment", label: "Parchment" },
  { id: "dark",      label: "Dark" },
  { id: "crown",     label: "Crown" },
  { id: "tide",      label: "Tide" },
  { id: "ash",       label: "Ash" },
  { id: "thorn",     label: "Thorn" },
];

const SCREENS = [
  "main", "map", "zone", "recruit", "upgrade", "shop",
  "battle", "defense", "encounter", "summary", "coop",
];

export function TweaksPanel() {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const seedRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "`" || e.key === "~") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const regenWithSeed = (seed) => {
    if (seedRef.current) seedRef.current.value = String(seed);
    dispatch({ type: "REGEN_MAP", seed });
  };

  return (
    <>
      <button
        className="tweaks-toggle"
        title="Tweaks (~)"
        aria-label="Toggle tweaks panel"
        onClick={() => setOpen((o) => !o)}
      >
        ⚙
      </button>

      {open && (
        <div className="tweaks-panel">
          <div className="row between center" style={{ marginBottom: 8 }}>
            <div className="h-display" style={{ fontSize: 13 }}>Tweaks</div>
            <button className="btn btn-ghost" style={{ padding: "2px 8px" }} onClick={() => setOpen(false)}>×</button>
          </div>
          <div className="col gap-2">
            <div>
              <div style={{ fontSize: 10, color: "var(--ink-soft)", textTransform: "uppercase", marginBottom: 4 }}>
                Color theme
              </div>
              <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    className={`btn ${state.theme === t.id ? "btn-primary" : "btn-ghost"}`}
                    style={{ padding: "4px 8px", fontSize: 10 }}
                    onClick={() => dispatch({ type: "SET_THEME", theme: t.id })}
                  >{t.label}</button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "var(--ink-soft)", textTransform: "uppercase", marginBottom: 4 }}>
                Map seed
              </div>
              <div className="row gap-2 center">
                <input
                  ref={seedRef}
                  className="numeric"
                  defaultValue={state.seed}
                  style={{
                    width: 80, padding: "4px 6px",
                    border: "2px solid var(--line)", borderRadius: 4,
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <button
                  className="btn"
                  onClick={() => regenWithSeed(parseInt(seedRef.current.value, 10) || 1)}
                >Regenerate</button>
                <button
                  className="btn btn-ghost"
                  onClick={() => regenWithSeed(Math.floor(Math.random() * 99999))}
                >🎲</button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, color: "var(--ink-soft)", textTransform: "uppercase", marginBottom: 4 }}>
                Jump to screen
              </div>
              <div className="row gap-1" style={{ flexWrap: "wrap" }}>
                {SCREENS.map((s) => (
                  <button
                    key={s}
                    className="btn btn-ghost"
                    style={{ padding: "3px 8px", fontSize: 10 }}
                    onClick={() => dispatch({ type: "SET_SCREEN", screen: s })}
                  >{s}</button>
                ))}
              </div>
            </div>

            <div className="row gap-2">
              <button
                className="btn btn-ghost flex1"
                style={{ justifyContent: "center" }}
                onClick={() => {
                  SaveSystem.clear();
                  window.location.reload();
                }}
              >🗑 Reset Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
