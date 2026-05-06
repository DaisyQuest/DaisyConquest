/* UpdateBanner — desktop-only auto-update toast.
 *
 * Listens to update lifecycle events emitted by the Electron preload
 * (`window.__daisyConquest`). When running in the web client this global is
 * undefined; the component renders null and there is no fork in game logic.
 *
 * Visible states:
 *   - downloading → "Updating to vX.Y.Z… 42%"
 *   - downloaded  → "DaisyConquest vX.Y.Z is ready" + Restart button
 * Other states (checking / current / error) stay silent so we don't spam
 * the player with updater chrome they don't care about.
 */
import { useEffect, useState } from "react";

export function UpdateBanner() {
  const api = typeof window !== "undefined" ? window.__daisyConquest : null;
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!api?.onUpdateStatus) return undefined;
    return api.onUpdateStatus(setStatus);
  }, [api]);

  if (!api?.isDesktop || !status) return null;
  const { state, version, percent } = status;
  if (state !== "downloading" && state !== "downloaded") return null;

  return (
    <div role="status" aria-live="polite" className="update-banner">
      {state === "downloading" && (
        <>
          <span className="dot" />
          <span>
            Updating{version ? ` to v${version}` : ""}…{" "}
            <span className="numeric">{Math.round(percent ?? 0)}%</span>
          </span>
        </>
      )}
      {state === "downloaded" && (
        <>
          <span className="dot" style={{ background: "var(--green)" }} />
          <span>
            DaisyConquest{version ? ` v${version}` : ""} is ready.
          </span>
          <button
            className="btn btn-primary"
            style={{ padding: "4px 12px", fontSize: 12 }}
            onClick={() => api.installNow?.()}
          >
            Restart &amp; install
          </button>
        </>
      )}
    </div>
  );
}
