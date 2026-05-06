# DaisyConquest

A Feudalism-style semi-autobattler. Four houses fight for one throne across a hex world map, with lane-based auto-battles, hero progression, random encounters, a wave-defense minigame, fog of war, local co-op, and an Electron desktop client with auto-updates.

## Develop (web)

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production bundle to dist/
npm run preview      # serve dist/ locally
npm run lint
npm run test:run     # vitest, deterministic suites
```

## Develop (desktop)

```bash
npm run electron:dev         # vite dev server + electron, hot reload
npm run electron:build:dir   # build dist/ + package an unsigned app to release/win-unpacked/
npm run electron:build       # build installers (NSIS / dmg / AppImage per platform)
npm run electron:publish     # build + publish to GitHub releases (auto-update channel)
```

## Architecture

ES modules with a strict layered dependency graph. Lower layers don't import upward.

```
src/
  data/        Pure data — factions, units, heroes, items, perks, encounters, map gen
  core/        constants, RNG, save, economy, the React store
  systems/     Game logic — battle sim, AI, defense minigame
  components/  Reusable UI atoms (Crest, UnitCard, HeroPanel, HexTile, GoldBar, UpdateBanner)
  screens/     One file per top-level view
  App.jsx      Screen router
  main.jsx     Entry — mounts <StoreProvider><App/></StoreProvider>

electron/
  main.cjs     Main process: BrowserWindow + electron-updater + IPC
  preload.cjs  Sandboxed bridge: exposes window.__daisyConquest to the renderer

tests/         Vitest deterministic suites (reducer, economy, save, rng)
```

## Electron + web sync guarantee

The desktop and web clients are built from the same `src/` tree. **There is no game-logic code in `electron/`.** The only desktop-specific addition is `src/components/UpdateBanner.jsx`, and even that is gated on a runtime feature check (`window.__daisyConquest?.isDesktop`) — when the same component renders in the web client, it returns null.

The packaging pipeline guarantees this structurally:

1. `npm run electron:build` runs `vite build` first, producing `dist/`.
2. `electron-builder` packages that exact `dist/` into the `app.asar`.
3. The Electron renderer loads `dist/index.html` from the asar via `file://`.

The asar's `dist/` is **byte-for-byte identical** to whatever you deploy to the web — the same hashes, same source maps. New features ship to both at once via a single `npm run build`.

## Auto-updates

Auto-update is wired through `electron-updater` against GitHub releases. To enable it for a real distribution:

1. Replace the placeholder `build.publish.owner` and `build.publish.repo` in `package.json` with your GitHub coordinates.
2. Set `GH_TOKEN=<personal-access-token-with-repo-scope>` in your environment.
3. Run `npm run electron:publish`. This builds an installer, uploads it to GitHub releases, and writes a `latest.yml` manifest the updater reads.

On launch, the desktop app silently checks the manifest, downloads any newer version in the background, and shows a `Restart & install` toast (`UpdateBanner`) when ready. The web client never sees this UI.

### Code signing & platform notes

- **Windows**: ships unsigned by default; auto-update **works** but Microsoft SmartScreen will warn first-run users until you sign with an EV cert.
- **macOS**: auto-update **does not work without code signing + notarization**. Gatekeeper rejects unsigned updates even when the original install was unsigned. Treat the `dmg` build as a placeholder until signing is set up.
- **Linux**: AppImage works unsigned; updates apply via electron-updater's filesystem swap.
- **Icons**: shipped with electron-builder defaults. Drop a real `build/icon.png` (512×512) before public release.

## Save format

JSON in localStorage under `daisyconquest.save.v1`. Versioned for migrations.

**Note on desktop saves**: Electron's renderer has its own localStorage scoped to the user-data directory, separate from your browser. Saves don't sync between the desktop client and the web client. Cross-device save sync would require a backend; out of scope.

## Multiplayer

Local pass-and-play co-op — pick two houses on the title screen or via the Co-op Lobby. Each round, players take turns moving armies, recruiting, and managing heroes; the world map's `↔ Swap` button hands off control through a faction-tinted transition screen. The other two factions are AI rivals.

Networked multiplayer is not yet implemented. The CoopLobby screen is honest about this.

## Extending the game

- **Add a unit** — append to `src/data/units.js`. Reference its `id` from a faction's `units` array in `factions.js`.
- **Add a faction** — append to `src/data/factions.js` and add its id to `FACTION_LIST`. Map gen and AI pick it up automatically.
- **Add a perk / item / encounter** — append to the matching file in `src/data/`.
- **Tune balance** — every numeric knob lives in `src/core/constants.js` or per-entity data files. Don't inline constants.
- **Add a screen** — drop a component in `src/screens/`, then register it in `App.jsx`'s router.

## Tweaks

Press `~` (tilde) in-game to toggle the tweaks panel: theme, map seed, screen jump, reset save. The panel is identical across web and desktop.
