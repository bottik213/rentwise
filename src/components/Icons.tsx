export type Status = "good" | "warn" | "bad" | "none";

export const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="8" cy="5" r="0.9" fill="currentColor" />
  </svg>
);

export const Arrow = ({ size = 16 }: { size?: number }) => (
  <svg className="arr" width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3 8h9M8.5 4.5L12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Logo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 11.5L12 4l9 7.5V21H3z" style={{ fill: "var(--spruce)" }} />
    <rect x="9.5" y="13" width="5" height="8" style={{ fill: "var(--paper)" }} />
  </svg>
);

/** Shape plus color, so status never relies on color alone. `knock` is the cut-out color (the badge background). */
export function StatusIcon({ st, size = 14, knock }: { st: Status; size?: number; knock?: string }) {
  const k = knock ?? `var(--${st}-bg)`;
  if (st === "good")
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="7" fill="currentColor" />
        <path d="M4.8 8.3l2.1 2.1 4.3-4.6" fill="none" stroke={k} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (st === "warn")
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 1.2l7.2 13.3H.8z" fill="currentColor" />
        <path d="M8 6v4" stroke={k} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="8" cy="12.2" r="1" fill={k} />
      </svg>
    );
  if (st === "bad")
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
        <rect x="3" y="3" width="10" height="10" rx="1.5" transform="rotate(45 8 8)" fill="currentColor" />
        <path d="M6 6l4 4M10 6l-4 4" stroke={k} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.4 2.2" />
    </svg>
  );
}

export function Badge({ st, label, knock }: { st: Status; label: string; knock?: string }) {
  return (
    <span className={`badge ${st}`}>
      <StatusIcon st={st} knock={knock} />
      {label}
    </span>
  );
}
