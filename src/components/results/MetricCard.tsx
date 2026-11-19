"use client";
import { useEffect, useRef, useState } from "react";
import { Badge, InfoIcon } from "@/components/Icons";
import { useTapTip } from "@/components/useTapTip";
import { useI18n } from "@/i18n/client";
import type { Judged } from "@/lib/verdict";
import { AnimatedNumber } from "./AnimatedNumber";

interface Props {
  id: string;
  title: string;
  /** null shows `offText` instead of a number. */
  value: number | null;
  format: (v: number) => string;
  unit?: string;
  offText?: string;
  negative?: boolean;
  badge?: Judged;
  /** Formats the change chip after an edit, e.g. "+$12.40" or "−0.31 pts". */
  delta?: (d: number) => string;
  /** Whether a higher number is better (green up arrow) or worse. */
  upIsGood?: boolean;
  small?: boolean;
  children: React.ReactNode;
}

/** A number, its status, and an explanation that opens on hover, keyboard focus or tap. Edits flash the card. */
export function MetricCard({ id, title, value, format, unit, offText, negative, badge, delta, upIsGood = true, small, children }: Props) {
  const tip = useTapTip<HTMLDivElement>();
  const { t } = useI18n();
  const prev = useRef(value);
  const [change, setChange] = useState<number | null>(null);

  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (before === null || value === null || before === value) return;
    setChange(value - before);
    const t = setTimeout(() => setChange(null), 1600);
    return () => clearTimeout(t);
  }, [value]);

  const up = (change ?? 0) > 0;
  const good = upIsGood ? up : !up;

  return (
    <div ref={tip.ref} className={`mc tw card-tip ${small ? "sm" : ""} ${change !== null ? "flash" : ""} ${tip.open ? "open" : ""}`}>
      <button type="button" className="hit" aria-label={t.results.explain(title)} aria-describedby={`t-${id}`} aria-expanded={tip.open} onClick={tip.toggle} />
      <div className="t">
        <span>{title}</span>
        <span className="ib" aria-hidden>
          <InfoIcon />
        </span>
      </div>
      <div className={`v num ${negative ? "neg" : ""}`}>
        {value === null ? (
          <span className="off">{offText}</span>
        ) : (
          <>
            <AnimatedNumber value={value} format={format} countUp />
            {unit && <small>{unit}</small>}
          </>
        )}
      </div>
      {(badge || change !== null) && (
        <div className="foot">
          {badge && <Badge st={badge.st} label={badge.label} />}
          {change !== null && delta && (
            <span className={`dl num ${good ? "up" : "down"}`}>
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
                <path d={up ? "M6 2l4 6H2z" : "M6 10L2 4h8z"} fill="currentColor" />
              </svg>
              {delta(change)}
            </span>
          )}
        </div>
      )}
      <div className="pop down" role="tooltip" id={`t-${id}`}>
        {children}
      </div>
    </div>
  );
}
