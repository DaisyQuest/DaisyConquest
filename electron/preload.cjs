/* Preload — exposes a tiny, audited API on `window.__ironCrowns` so the
 * renderer can listen for auto-update events and trigger a restart.
 *
 * Web client never sees this object. Renderer-side code that wants to react
 * to update status checks `window.__ironCrowns?.isDesktop` first — see
 * src/components/UpdateBanner.jsx.
 *
 * We run with contextIsolation + sandbox: this preload is the *only*
 * surface where Node APIs reach the renderer.
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("__ironCrowns", {
  isDesktop: true,

  // Subscribe to update lifecycle events. Returns an unsubscribe fn.
  onUpdateStatus: (cb) => {
    if (typeof cb !== "function") return () => {};
    const handler = (_event, payload) => {
      try { cb(payload); } catch { /* swallow renderer errors */ }
    };
    ipcRenderer.on("update-status", handler);
    return () => ipcRenderer.off("update-status", handler);
  },

  // Restart and apply the downloaded update. No-op until update-downloaded
  // has fired.
  installNow: () => ipcRenderer.invoke("update-install-now"),
});
