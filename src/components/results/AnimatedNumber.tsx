"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Tweens to each new value (ease-out cubic). Retargets from wherever it is mid-tween, so fast typing never
 * restarts from the old value. `countUp` starts the first render from 0, once per mount. Reduced motion: jumps.
 * Screen readers get the final value only.
 */
export function AnimatedNumber({
  value,
  format,
  className,
  duration = 450,
  countUp = false,
}: {
  value: number;
  format: (v: number) => string;
  className?: string;
  duration?: number;
  countUp?: boolean;
}) {
  const [shown, setShown] = useState(countUp ? 0 : value);
  const current = useRef(countUp ? 0 : value);
  const first = useRef(countUp);

  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = value;
      setShown(value);
      return;
    }
    const ms = first.current ? 900 : duration;
    first.current = false;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      current.current = from + (value - from) * (1 - Math.pow(1 - k, 3));
      setShown(k < 1 ? current.current : value);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={`num ${className ?? ""}`}>
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
