/* Iron Crowns — Electron main process.
 *
 * The desktop client is a thin shell around the Vite-built web bundle.
 * No game logic lives here, by design — see README "Electron + web sync
 * guarantee". This file only:
 *   - opens a BrowserWindow and points it at dist/ (or the dev server)
 *   - wires electron-updater to GitHub releases
 *   - forwards update events to the renderer over IPC
 *
 * Anything more is feature creep that breaks the sync invariant.
 */
const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("node:path");

const isDev = !app.isPackaged;
const DEV_URL = "http://localhost:5173";

// Single-instance lock — second launches focus the existing window instead
// of opening a duplicate.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 720,
    backgroundColor: "#1a1410",
    title: "Iron Crowns",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  // External links (e.g. the README hyperlink in CoopLobby's "online play
  // not yet supported" note, if any) open in the OS browser, not inside
  // the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

/* ----- Auto-updater -----------------------------------------------------
 * Reads its publish config from package.json's `build.publish`. The user
 * must replace the placeholder GitHub owner/repo before shipping.
 *
 * Disabled in dev (no asar to swap, no published manifest to read).
 */
function setupAutoUpdater(win) {
  if (isDev) return;

  // Required late so we don't pay the require cost in dev.
  // eslint-disable-next-line global-require
  const { autoUpdater } = require("electron-updater");

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (payload) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("update-status", payload);
    }
  };

  autoUpdater.on("checking-for-update", () => send({ state: "checking" }));
  autoUpdater.on("update-available", (info) =>
    send({ state: "available", version: info?.version })
  );
  autoUpdater.on("update-not-available", () => send({ state: "current" }));
  autoUpdater.on("download-progress", (p) =>
    send({ state: "downloading", percent: p?.percent ?? 0, version: undefined })
  );
  autoUpdater.on("update-downloaded", (info) =>
    send({ state: "downloaded", version: info?.version })
  );
  autoUpdater.on("error", (err) =>
    send({ state: "error", message: err?.message || String(err) })
  );

  ipcMain.handle("update-install-now", () => {
    autoUpdater.quitAndInstall(false, true);
    return true;
  });

  // Best-effort check on launch. Failures are non-fatal — the app still
  // runs fine offline.
  autoUpdater.checkForUpdatesAndNotify().catch((err) => {
    // eslint-disable-next-line no-console
    console.warn("[updater] initial check failed:", err?.message || err);
  });
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater(mainWindow);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
