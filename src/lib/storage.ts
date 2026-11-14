"use client";
import { useSyncExternalStore } from "react";
import type { z } from "zod";
import { DEFAULT_SCENARIOS } from "./finance/scenarios";
import { StoredStateSchema } from "./validation";

export type AppState = z.infer<typeof StoredStateSchema>;
export type StorageProblem = "read" | "save" | "clear";
export interface StorageStatus {
  problem: StorageProblem | null;
  hasUnsavedChanges: boolean;
}

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
let loadFailed = false; // Never replace saved data that this tab has not been able to read.
const SAVED: StorageStatus = { problem: null, hasUnsavedChanges: false };
let storageStatus = SAVED;
const listeners = new Set<() => void>();

function read(): AppState {
  let raw: string | null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    loadFailed = true;
    storageStatus = { problem: "read", hasUnsavedChanges: false };
    return EMPTY_STATE;
  }
  loadFailed = false;
  storageStatus = SAVED;
  try {
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

function notify(): void {
  listeners.forEach((l) => l());
}

function onStorage(e: StorageEvent): void {
  // Another tab must not replace changes we have not managed to save yet.
  if ((e.key === KEY || e.key === null) && !storageStatus.hasUnsavedChanges) {
    state = read();
    notify();
  }
}

function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (storageStatus.hasUnsavedChanges) {
    e.preventDefault();
    e.returnValue = "";
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
    window.addEventListener("beforeunload", onBeforeUnload);
  }
  return () => {
    listeners.delete(fn);
    if (!listeners.size) {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("beforeunload", onBeforeUnload);
    }
  };
}

/** null during server render / hydration → callers show a loading state. */
export const useAppState = (): AppState | null => useSyncExternalStore(subscribe, getSnapshot, () => null);

export function getStorageStatus(): StorageStatus {
  getSnapshot();
  return storageStatus;
}

export const useStorageStatus = (): StorageStatus | null => useSyncExternalStore(subscribe, getStorageStatus, () => null);

function persist(): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(getSnapshot()));
    storageStatus = SAVED;
    return true;
  } catch {
    storageStatus = { problem: "save", hasUnsavedChanges: true };
    return false;
  }
}

/** Whether the edit was accepted in memory; saving may still require a retry. */
export function setAppState(fn: (s: AppState) => AppState): boolean {
  const current = getSnapshot();
  if (loadFailed) return false;
  const next = StoredStateSchema.safeParse(fn(current));
  // Never persist a state read() would reject: on reload it would silently wipe the property and actuals.
  if (!next.success) { console.warn("RentWise: rejected invalid state", next.error.issues); return false; }
  state = next.data;
  persist();
  notify();
  return true;
}

export function clearAppData(): boolean {
  getSnapshot();
  try {
    localStorage.removeItem(KEY);
  } catch {
    storageStatus = { ...storageStatus, problem: "clear" };
    notify();
    return false;
  }
  state = EMPTY_STATE;
  loadFailed = false;
  storageStatus = SAVED;
  notify();
  return true;
}

/** Retry the failed operation without discarding in-memory edits or overwriting unread data. */
export function retryStorage(): boolean {
  getSnapshot();
  if (storageStatus.problem === "clear") return clearAppData();
  if (loadFailed) {
    state = read();
    notify();
    return storageStatus.problem === null;
  }
  const saved = persist();
  notify();
  return saved;
}

export function exportAppData(): void {
  const blob = new Blob([JSON.stringify(getSnapshot(), null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "rentwise-data.json" });
  a.click();
  // Revoking in the same tick can cancel the download in Safari/Firefox.
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
