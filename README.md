# Iron Crowns

A Feudalism-style semi-autobattler. Four houses fight for one throne across a hex world map, with lane-based auto-battles, hero progression, random encounters, and a wave-defense minigame.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
npm run preview
```

## Architecture

ES modules with a strict layered dependency graph. Lower layers don't import upward.

```
src/
  data/        Pure data — factions, units, heroes, items, perks, encounters, map gen
  core/        constants, RNG, save, economy, the React store
  systems/     Game logic — battle sim, AI, defense minigame
  components/  Reusable UI atoms (Crest, UnitCard, HeroPanel, HexTile, GoldBar)
  screens/     One file per top-level view
  App.jsx      Screen router
  main.jsx     Entry — mounts <StoreProvider><App/></StoreProvider>
```

## Extending the game

- **Add a unit** — append to `src/data/units.js`. Reference its `id` from a faction's `units` array in `factions.js`.
- **Add a faction** — append to `src/data/factions.js` and add its id to `FACTION_LIST`. Map gen and AI pick it up automatically.
- **Add a perk / item / encounter** — append to the matching file in `src/data/`.
- **Tune balance** — every numeric knob lives in `src/core/constants.js` or per-entity data files. Don't inline constants.
- **Add a screen** — drop a component in `src/screens/`, then register it in `App.jsx`'s router.

## Save format

JSON in localStorage under `ironcrowns.save.v1`. Versioned for migrations.

## Tweaks

Press `~` (tilde) in-game to toggle the tweaks panel: theme, map seed, screen jump, reset save.
