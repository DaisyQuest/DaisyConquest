/* TutorialOverlay — anchored arrow + tooltip pointing at a real DOM
   element. Pure presentation; tutorial state lives in core/tutorial.js.

   API:
     <TutorialOverlay
       stepId="map.intro"            // unique id used for "seen" persistence
       steps={[
         { selector: ".gold-bar",     side: "bottom", title, body },
         { selector: ".hex.selected", side: "right",  title, body, arrow: "auto" },
       ]}
     />

   Each step targets a CSS selector. We read its bounding box on mount and
   on window resize, then render a big chunky SVG arrow pointing at it
   plus a parchment-styled tooltip alongside. Player presses "Next" /
   "Skip all" to advance — markSeen fires when they finish or skip.

   If the selector resolves to nothing (screen state hasn't laid that
   element out yet), we silently skip that step. Robust to lazy mounts. */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  shouldShow, markSeen, setSuppressed, subscribe,
} from "../core/tutorial.js";

const TICK_MS = 240; // recompute target rect periodically (handles layout shifts)

export function TutorialOverlay({ stepId, steps }) {
  // Each step in the array carries its own seen-state too, so we don't show
  // step 2 if step 1 was already cleared on a prior visit. We track the
  // current visible step index locally.
  const [active, setActive] = useState(() => shouldShow(stepId));
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState(null);
  const tickRef = useRef(0);

  // External state changes (suppression toggle from MainMenu, reset, etc.)
  // re-evaluate visibility.
  useEffect(() => {
    const unsub = subscribe(() => setActive(shouldShow(stepId)));
    return unsub;
  }, [stepId]);

  const current = steps[idx];

  // Re-measure target every TICK_MS — layout can shift as panels load,
  // animations finish, and the user resizes. Cheap.
  useEffect(() => {
    if (!active || !current) return;
    const measure = () => {
      const el = document.querySelector(current.selector);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    measure();
    tickRef.current = setInterval(measure, TICK_MS);
    window.addEventListener("resize", measure);
    return () => {
      clearInterval(tickRef.current);
      window.removeEventListener("resize", measure);
    };
  }, [active, idx, current]);

  if (!active || !current) return null;

  const next = () => {
    if (idx + 1 < steps.length) {
      setIdx(idx + 1);
    } else {
      markSeen(stepId);
      setActive(false);
    }
  };
  const skipAll = () => {
    markSeen(stepId);
    setActive(false);
  };
  const suppressForever = () => {
    setSuppressed(true);
    markSeen(stepId);
    setActive(false);
  };

  // If we couldn't find the target this beat, render a centered fallback
  // tooltip — better than nothing, and still skippable.
  if (!rect) {
    return (
      <FallbackTip
        step={current}
        idx={idx}
        total={steps.length}
        onNext={next}
        onSkip={skipAll}
        onSuppress={suppressForever}
      />
    );
  }

  // Place the tooltip on the side opposite the arrow's incoming direction.
  // We pick a default side if the step doesn't specify one.
  const side = current.side || "right";
  const placement = computePlacement(rect, side);

  return (
    <div
      className="tut-overlay"
      style={{
        position: "fixed", inset: 0,
        zIndex: 200, pointerEvents: "none",
      }}
    >
      {/* Soft vignette so the highlighted region pops. Lighter than before
          so the parchment-themed game underneath stays legible. Pointer
          events stay off so the game keeps accepting clicks. */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at " +
            `${rect.x + rect.w / 2}px ${rect.y + rect.h / 2}px, ` +
            "rgba(0,0,0,0) 0px, rgba(0,0,0,0.32) 380px)",
        }}
      />
      {/* Highlight ring around the target. */}
      <div
        className="tut-ring"
        style={{
          position: "absolute",
          left: rect.x - 6, top: rect.y - 6,
          width: rect.w + 12, height: rect.h + 12,
          borderRadius: 14,
        }}
      />
      <Arrow side={side} rect={rect} />
      <div
        className="tut-card pop-in"
        style={{
          position: "absolute",
          left: placement.tipX, top: placement.tipY,
          pointerEvents: "auto",
        }}
      >
        <div className="tut-card-step">
          Step {idx + 1} of {steps.length}
        </div>
        <div className="tut-progress">
          {steps.map((_, i) => (
            <span key={i} className={i < idx ? "done" : i === idx ? "cur" : ""} />
          ))}
        </div>
        <div className="tut-card-title">{current.title}</div>
        <div className="tut-card-body">{current.body}</div>
        <div className="row gap-2 between center" style={{ marginTop: 8 }}>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 10, padding: "3px 6px" }}
            onClick={suppressForever}
            title="Don't show any tutorials again — you can reset on the title screen."
          >Hide all</button>
          <div className="row gap-2 center">
            <button
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: "3px 10px" }}
              onClick={skipAll}
            >Skip</button>
            <button
              className="btn btn-primary"
              style={{ fontSize: 12, padding: "5px 12px" }}
              onClick={next}
            >{idx + 1 < steps.length ? "Next" : "Got it"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Compute where the tooltip card sits relative to the highlighted rect.
   Keeps the card on-screen by clamping into a small margin from the
   viewport edge. */
function computePlacement(rect, side) {
  const margin = 24;
  const cardW = 320, cardH = 160;
  let tipX, tipY;
  switch (side) {
    case "right":
      tipX = rect.x + rect.w + 56;
      tipY = rect.y + rect.h / 2 - cardH / 2;
      break;
    case "left":
      tipX = rect.x - cardW - 56;
      tipY = rect.y + rect.h / 2 - cardH / 2;
      break;
    case "top":
      tipX = rect.x + rect.w / 2 - cardW / 2;
      tipY = rect.y - cardH - 56;
      break;
    case "bottom":
    default:
      tipX = rect.x + rect.w / 2 - cardW / 2;
      tipY = rect.y + rect.h + 56;
      break;
  }
  // Clamp to viewport.
  tipX = Math.max(margin, Math.min(window.innerWidth - cardW - margin, tipX));
  tipY = Math.max(margin, Math.min(window.innerHeight - cardH - margin, tipY));
  return { tipX, tipY };
}

/* SVG arrow — chunky, pulsing, oriented per `side`. The arrow's tail
   sits near the tooltip side, the head points into the target rect. */
function Arrow({ side, rect }) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const R = 90;
  let from, to;
  switch (side) {
    case "right":
      to   = { x: rect.x + rect.w + 6, y: cy };
      from = { x: to.x + R, y: cy };
      break;
    case "left":
      to   = { x: rect.x - 6, y: cy };
      from = { x: to.x - R, y: cy };
      break;
    case "top":
      to   = { x: cx, y: rect.y - 6 };
      from = { x: cx, y: to.y - R };
      break;
    case "bottom":
    default:
      to   = { x: cx, y: rect.y + rect.h + 6 };
      from = { x: cx, y: to.y + R };
      break;
  }
  return (
    <svg
      width={window.innerWidth} height={window.innerHeight}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      <defs>
        <marker
          id="tut-arrowhead" viewBox="0 0 10 10"
          refX="9" refY="5" markerWidth="9" markerHeight="9"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--gold)" stroke="var(--ink)" strokeWidth="0.6" />
        </marker>
      </defs>
      <line
        className="tut-arrow"
        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
        stroke="var(--gold)" strokeWidth="6" strokeLinecap="round"
        markerEnd="url(#tut-arrowhead)"
      />
    </svg>
  );
}

function FallbackTip({ step, idx, total, onNext, onSkip, onSuppress }) {
  return (
    <div className="tut-overlay" style={{ position: "fixed", inset: 0, zIndex: 200, pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.32)" }} />
      <div
        className="tut-card pop-in"
        style={{
          position: "absolute",
          left: "50%", top: "50%",
          transform: "translate(-50%, -50%)",
          pointerEvents: "auto",
        }}
      >
        <div className="tut-card-step">Step {idx + 1} of {total}</div>
        <div className="tut-progress">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className={i < idx ? "done" : i === idx ? "cur" : ""} />
          ))}
        </div>
        <div className="tut-card-title">{step.title}</div>
        <div className="tut-card-body">{step.body}</div>
        <div className="row gap-2 between center" style={{ marginTop: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 6px" }} onClick={onSuppress}>
            Hide all
          </button>
          <div className="row gap-2 center">
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }} onClick={onSkip}>Skip</button>
            <button className="btn btn-primary" style={{ fontSize: 12, padding: "5px 12px" }} onClick={onNext}>
              {idx + 1 < total ? "Next" : "Got it"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Filter out steps whose targets aren't in the DOM right now. The overlay
   above already handles missing targets gracefully, but this lets a screen
   author tutorial steps that only fire when the relevant feature is
   actually present (e.g. retinue promotion when there's a retinue stack). */
export function useStepsAvailable(steps) {
  return useMemo(() => steps.filter(Boolean), [steps]);
}
