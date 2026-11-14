"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Tap-to-open state for a help bubble. Hover and keyboard focus are handled in CSS; this covers touch,
 * where there is no hover. A tap anywhere outside the bubble's wrapper closes it.
 */
export function useTapTip<T extends HTMLElement>() {
  const [open, setOpen] = useState(false);
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return { ref, open, toggle: () => setOpen((o) => !o) };
}
