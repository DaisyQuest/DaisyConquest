/* Tutorial state — localStorage-backed user preference for the in-game
   tutorial overlays.
   Shape: { suppressed: bool, seen: { [stepId]: true } }
   Per-screen overlays read this to decide whether to mount, and write
   `seen` when the player advances past a step. The MainMenu offers a
   "Suppress Tutorials" toggle (sets suppressed: true) and a Reset button
   (clears `seen` so the next visit shows everything again). */

const KEY = "daisyconquest.tutorial.v1";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { suppressed: false, seen: {} };
    const parsed = JSON.parse(raw);
    return {
      suppressed: !!parsed.suppressed,
      seen: parsed.seen && typeof parsed.seen === "object" ? parsed.seen : {},
    };
  } catch {
    return { suppressed: false, seen: {} };
  }
}

function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // localStorage may be disabled (private mode) — degrade silently.
  }
}

/* Subscriber callbacks — the MainMenu toggle and the per-screen overlays
   need to react when state changes mid-session (e.g. user flipping the
   suppress toggle while a tutorial is on screen). Plain pub/sub; no
   external dependency on a state library. */
const subs = new Set();

export function getTutorialState() {
  return load();
}

export function isSuppressed() {
  return load().suppressed;
}

export function hasSeen(stepId) {
  return !!load().seen[stepId];
}

export function shouldShow(stepId) {
  const s = load();
  return !s.suppressed && !s.seen[stepId];
}

export function markSeen(stepId) {
  const s = load();
  if (s.seen[stepId]) return;
  s.seen[stepId] = true;
  save(s);
  notify();
}

export function setSuppressed(value) {
  const s = load();
  s.suppressed = !!value;
  save(s);
  notify();
}

export function resetTutorials() {
  save({ suppressed: false, seen: {} });
  notify();
}

export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

function notify() {
  for (const fn of subs) fn();
}
