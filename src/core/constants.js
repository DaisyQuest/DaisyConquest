/* All tuning knobs live here. Never inline a number elsewhere — add it to
   this file (or to a per-entity data file) so balance is editable in one place. */

export const CONST = {
  STARTING_GOLD: 200,
  STARTING_INCOME: 30,
  ROUND_INCOME_BASE: 20,

  BATTLE: {
    LANE_LENGTH: 100,
    TICK_MS: 33,
    DEFAULT_SPEED: 1.0,    // base pace — readable at a glance; scrub up to 5× from the toolbar
    LANE_COUNT: 3,
    MAX_PER_LANE: 8,
    HERO_REGEN_MP: 1.6,
    DAMAGE_VARIANCE: 0.15,
    UNIT_MOVE_SCALE: 22,   // close distance fast
    ATTACK_COOLDOWN: 0.5,  // punchier swings
  },

  MAP: {
    DEFAULT_SEED: 42,
    COLS: 8,
    ROWS: 6,
    HEX_W: 120,
    HEX_H: 138,
  },

  DEFENSE: {
    WAVES: 3,
    WAVE_GAP_MS: 800,
  },

  SAVE_KEY: "ironcrowns.save.v1",
  SAVE_AUTOSAVE_MS: 3000,
};
