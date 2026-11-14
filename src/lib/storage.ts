"use client";
import { useSyncExternalStore } from "react";
import type { z } from "zod";
import { DEFAULT_SCENARIOS } from "./finance/scenarios";
import { StoredStateSchema } from "./validation";

export type AppState = z.infer<typeof StoredStateSchema>;

const KEY = "rentwise:v1";
export const EMPTY_STATE: AppState = {
  v: 1,
  property: null,
  isExample: false,
  plan: null,
  scenarios: DEFAULT_SCENARIOS,
  constraints: { minMonthlyCashFlow: 0 },
  actuals: [],
};

let state: AppState | null = null; // null until read on the client
const listeners = new Set<() => void>();

function read(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = StoredStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_STATE; // corrupt or old data never crashes the app
  } catch {
    return EMPTY_STATE;
  }
}

function getSnapshot(): AppState {
  return (state ??= read());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) { state = read(); fn(); }
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(fn); window.removeEventListener("storage", onStorage); };
}

/** null during server render / hydration → callers show a loading state. */
export const useAppState = (): AppState | null => useSyncExternalStore(subscribe, getSnapshot, () => null);

export function setAppState(fn: (s: AppState) => AppState): void {
  const next = StoredStateSchema.safeParse(fn(getSnapshot()));
  // Never persist a state read() would reject: on reload it would silently wipe the property and actuals.
  if (!next.success) { console.warn("RentWise: rejected invalid state", next.error.issues); return; }
  state = next.data;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: keep working in memory for this session.
  }
  listeners.forEach((l) => l());
}

export function clearAppData(): void {
  try { localStorage.removeItem(KEY); } catch {}
  state = EMPTY_STATE;
  listeners.forEach((l) => l());
}

export function exportAppData(): void {
  const blob = new Blob([JSON.stringify(getSnapshot(), null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "rentwise-data.json" });
  a.click();
  // Revoking in the same tick can cancel the download in Safari/Firefox.
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
