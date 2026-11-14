"use client";
import { useEffect, useRef, useState } from "react";

const DURATION = 200; // UI feedback budget; a strong ease-out still makes the change visible

/**
 * Tweens to each new value (ease-out quint). Retargets from wherever it is mid-tween, so fast typing never
 * restarts from the old value. Reduced motion: jumps. Screen readers get the final value only.
 */
export function AnimatedNumber({ value, format, className }: { value: number; format: (v: number) => string; className?: string }) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      current.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / DURATION);
      current.current = from + (value - from) * (1 - Math.pow(1 - k, 5));
      setShown(current.current);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <span className={`num ${className ?? ""}`}>
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  );
}
