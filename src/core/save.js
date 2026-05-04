/* localStorage-backed save, versioned for future migrations.
   The save key intentionally matches the demo's key so older saves still load. */

import { CONST } from "./constants.js";

const VERSION = 1;

export const SaveSystem = {
  save(state) {
    try {
      const blob = JSON.stringify({ v: VERSION, t: Date.now(), state });
      localStorage.setItem(CONST.SAVE_KEY, blob);
      return true;
    } catch (e) {
      console.warn("save failed", e);
      return false;
    }
  },
  load() {
    try {
      const raw = localStorage.getItem(CONST.SAVE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || obj.v !== VERSION) return null;
      return obj.state;
    } catch {
      return null;
    }
  },
  clear() {
    localStorage.removeItem(CONST.SAVE_KEY);
  },
};
