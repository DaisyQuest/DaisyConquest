/* Crest — heraldic faction badge. */
import { FACTIONS } from "../data/factions.js";

export function Crest({ faction, size = 40, interactive = false, ringed = false }) {
  const fac = FACTIONS[faction];
  if (!fac) {
    return (
      <div style={{
        width: size, height: size,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: "#888", border: "2px solid #333",
        borderRadius: "50%", fontSize: size * 0.5,
      }}>?</div>
    );
  }
  const { primary, secondary } = fac.palette;
  const gradId = `g_${faction}`;
  return (
    <div className={`crest ${interactive ? "crest-interactive" : ""}`} style={{
      width: size, height: size, position: "relative",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg viewBox="0 0 60 70" width={size} height={size} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={secondary} />
            <stop offset="100%" stopColor={primary} />
          </linearGradient>
        </defs>
        <path
          d="M30 2 L56 10 L56 38 Q56 56 30 68 Q4 56 4 38 L4 10 Z"
          fill={`url(#${gradId})`}
          stroke="#2a1d12" strokeWidth="2.5" strokeLinejoin="round"
        />
        <path
          d="M30 2 L56 10 L56 38 Q56 56 30 68 Q4 56 4 38 L4 10 Z"
          fill="none"
          stroke={ringed ? "var(--gold)" : "transparent"}
          strokeWidth="2" strokeOpacity="0.7"
          transform="scale(0.85) translate(5.3, 6.2)"
        />
      </svg>
      <span style={{
        position: "relative",
        fontSize: size * 0.42,
        filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.3))",
      }}>{fac.crest}</span>
    </div>
  );
}
