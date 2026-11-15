"use client";
import { useSyncExternalStore } from "react";
import type { z } from "zod";
import { DEFAULT_SCENARIOS } from "./finance/scenarios";
import type { ActualMonth, PropertyInputs } from "./finance/types";
import { EMPTY_LEDGER, type Ledger } from "./ledger/types";
import { DealV3Schema, StoredStateSchema, StoredStateV1Schema, StoredStateV2Schema } from "./validation";

export type Stored = z.infer<typeof StoredStateSchema>;
export type Deal = z.infer<typeof DealV3Schema>;
type StoredV2 = z.infer<typeof StoredStateV2Schema>;
type Plan = Deal["plan"];

/**
 * What pages work with: the open deal's fields at the top level (as in Phase 1), plus every deal.
 * setAppState writes property / isExample / plan / actuals back into the open deal.
 */
export interface AppState {
  property: PropertyInputs | null;
  isExample: boolean;
  plan: Plan;
  actuals: ActualMonth[];
  scenarios: Stored["scenarios"];
  constraints: Stored["constraints"];
  deals: Deal[];
  activeId: string | null;
  branding?: Stored["branding"];
  /** The open deal's ledger (Phase 3). A new property starts with EMPTY_LEDGER. */
  ledger: Ledger;
}
export type StorageProblem = "read" | "save" | "clear";
export interface StorageStatus {
  problem: StorageProblem | null;
  hasUnsavedChanges: boolean;
}

const KEY = "rentwise:v3";
/** Older data. Read once and migrated; never written or deleted except by "Clear my data", so a rollback still finds it. */
const V2_KEY = "rentwise:v2";
const V1_KEY = "rentwise:v1";

export const EMPTY_STORED: Stored = { v: 3, deals: [], activeId: null, scenarios: DEFAULT_SCENARIOS, constraints: { minMonthlyCashFlow: 0 } };

export const newId = (): string => globalThis.crypto.randomUUID();

export function toView(st: Stored): AppState {
  const d = st.deals.find((x) => x.id === st.activeId) ?? null;
  return {
    property: d?.inputs ?? null,
    isExample: d?.isExample ?? false,
    plan: d?.plan ?? null,
    actuals: d?.actuals ?? [],
    scenarios: st.scenarios,
    constraints: st.constraints,
    deals: st.deals,
    activeId: d ? d.id : null,
    branding: st.branding,
    ledger: d?.ledger ?? EMPTY_LEDGER,
  };
}

/** Folds the open deal's fields back into its deal; a property with no open deal becomes a new deal. */
function fromView(v: AppState): Stored {
  const now = new Date().toISOString();
  let deals = v.deals;
  let activeId = v.activeId;
  if (!v.property) activeId = null; // "no open property": every saved deal is kept
  else if (activeId && deals.some((d) => d.id === activeId)) {
    deals = deals.map((d) =>
      d.id !== activeId || (d.inputs === v.property && d.plan === v.plan && d.actuals === v.actuals && d.isExample === v.isExample && d.ledger === v.ledger)
        ? d
        : { ...d, inputs: v.property!, isExample: v.isExample, plan: v.plan, actuals: v.actuals, ledger: v.ledger, updatedAt: now },
    );
  } else {
    const d: Deal = { id: newId(), createdAt: now, updatedAt: now, inputs: v.property, isExample: v.isExample, plan: v.plan, actuals: v.actuals, ledger: v.ledger };
    deals = [...deals, d];
    activeId = d.id;
  }
  return { v: 3, deals, activeId, scenarios: v.scenarios, constraints: v.constraints, ...(v.branding ? { branding: v.branding } : {}) };
}

/** Phase 2 → Phase 3: every deal gets an empty ledger, and its monthly totals become manual months. */
export function migrateV2(data: unknown): Stored | null {
  const p = StoredStateV2Schema.safeParse(data);
  if (!p.success) return null;
  const deals = p.data.deals.map((d) => ({ ...d, ledger: { ...EMPTY_LEDGER, monthModes: d.actuals.map((a) => ({ month: a.month, mode: "manual" as const })) } }));
  return { ...p.data, v: 3, deals };
}

/** Phase 1 → Phase 3: the single property becomes the open deal, with its plan, actuals, scenarios and targets. */
export function migrateV1(data: unknown, now = new Date().toISOString(), id = newId()): Stored | null {
  const p = StoredStateV1Schema.safeParse(data);
  if (!p.success) return null;
  const s = p.data;
  const inputs = s.property ?? s.plan?.inputs ?? null; // a locked plan alone still carries its actuals
  const deals: StoredV2["deals"] = inputs ? [{ id, createdAt: s.plan?.lockedAt ?? now, updatedAt: now, inputs, isExample: s.isExample, plan: s.plan, actuals: s.actuals }] : [];
  return migrateV2({ v: 2, deals, activeId: s.property ? id : null, scenarios: s.scenarios, constraints: s.constraints } satisfies StoredV2);
}

/** A v3 file, or an older one migrated. null when it is none of them. */
export function parseAnyVersion(data: unknown): Stored | null {
  const v3 = StoredStateSchema.safeParse(data);
  return v3.success ? v3.data : (migrateV2(data) ?? migrateV1(data));
}

let stored: Stored | null = null; // null until read on the client
let view: AppState | null = null;
let loadFailed = false; // Never replace saved data that this tab has not been able to read.
const SAVED: StorageStatus = { problem: null, hasUnsavedChanges: false };
let storageStatus = SAVED;
const listeners = new Set<() => void>();

function read(): Stored {
  let raw: string | null;
  let older: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw === null) older = localStorage.getItem(V2_KEY) ?? localStorage.getItem(V1_KEY);
  } catch {
    loadFailed = true;
    storageStatus = { problem: "read", hasUnsavedChanges: false };
    return EMPTY_STORED;
  }
  loadFailed = false;
  storageStatus = SAVED;
  try {
    if (raw) return StoredStateSchema.safeParse(JSON.parse(raw)).data ?? EMPTY_STORED; // corrupt data never crashes the app
    if (!older) return EMPTY_STORED;
    const migrated = parseAnyVersion(JSON.parse(older));
    if (!migrated) return EMPTY_STORED;
    try {
      localStorage.setItem(KEY, JSON.stringify(migrated)); // pin the new ids; older keys stay as they were
    } catch {
      /* still usable in memory; the next edit retries the save */
    }
    return migrated;
  } catch {
    return EMPTY_STORED;
  }
}

function load(next: Stored): void {
  stored = next;
  view = toView(next);
}

function getSnapshot(): AppState {
  if (!view) load(read());
  return view!;
}

function notify(): void {
  listeners.forEach((l) => l());
}

function onStorage(e: StorageEvent): void {
  // Another tab must not replace changes we have not managed to save yet.
  if ((e.key === KEY || e.key === null) && !storageStatus.hasUnsavedChanges) {
    load(read());
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

export const EMPTY_STATE: AppState = toView(EMPTY_STORED);

/** null during server render / hydration → callers show a loading state. */
export const useAppState = (): AppState | null => useSyncExternalStore(subscribe, getSnapshot, () => null);

export function getStorageStatus(): StorageStatus {
  getSnapshot();
  return storageStatus;
}

export const useStorageStatus = (): StorageStatus | null => useSyncExternalStore(subscribe, getStorageStatus, () => null);

function persist(): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
    storageStatus = SAVED;
    return true;
  } catch {
    storageStatus = { problem: "save", hasUnsavedChanges: true };
    return false;
  }
}

/** Replace the whole stored state. Whether the edit was accepted in memory; saving may still require a retry. */
export function setStored(fn: (s: Stored) => Stored): boolean {
  getSnapshot();
  if (loadFailed) return false;
  const next = StoredStateSchema.safeParse(fn(stored!));
  // Never persist a state read() would reject: on reload it would silently wipe every property.
  if (!next.success) { console.warn("RentWise: rejected invalid state", next.error.issues); return false; }
  load(next.data);
  persist();
  notify();
  return true;
}

/** Edit the open property, scenarios or targets (or any deal) through the page view. */
export function setAppState(fn: (s: AppState) => AppState): boolean {
  const current = getSnapshot();
  if (loadFailed) return false;
  return setStored(() => fromView(fn(current)));
}

export const openDeal = (id: string | null) => setStored((s) => ({ ...s, activeId: id }));

export function renameDeal(id: string, nickname: string): boolean {
  const now = new Date().toISOString();
  const name = nickname.trim().slice(0, 60);
  return setStored((s) => ({ ...s, deals: s.deals.map((d) => (d.id === id ? { ...d, inputs: { ...d.inputs, nickname: name || undefined }, updatedAt: now } : d)) }));
}

/** A new deal with the same inputs, and no plan or actuals: a variant to try, not a second owned property. */
export function duplicateDeal(id: string): boolean {
  const now = new Date().toISOString();
  return setStored((s) => {
    const d = s.deals.find((x) => x.id === id);
    if (!d) return s;
    const base = (d.inputs.nickname || "Untitled property").slice(0, 53);
    const copy: Deal = { ...d, id: newId(), createdAt: now, updatedAt: now, inputs: { ...d.inputs, nickname: `${base} (copy)` }, plan: null, actuals: [], ledger: EMPTY_LEDGER };
    return { ...s, deals: [...s.deals, copy] };
  });
}

export const deleteDeal = (id: string) =>
  setStored((s) => ({ ...s, deals: s.deals.filter((d) => d.id !== id), activeId: s.activeId === id ? null : s.activeId }));

/**
 * Adds the properties from an exported file (v1 or v2), validated. Your scenarios and targets stay as they are.
 * Returns how many properties were added, or an error message.
 */
export function importAppData(text: string): number | string {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return "That file isn't valid JSON.";
  }
  const incoming = parseAnyVersion(data);
  if (!incoming) return "That file isn't a RentWise export, or it has values RentWise can't use.";
  if (!incoming.deals.length) return "That file has no properties in it.";
  let added = 0;
  const ok = setStored((s) => {
    const room = 50 - s.deals.length;
    const taken = new Set(s.deals.map((d) => d.id));
    const fresh = incoming.deals.slice(0, Math.max(0, room)).map((d) => (taken.has(d.id) ? { ...d, id: newId() } : d));
    added = fresh.length;
    return { ...s, deals: [...s.deals, ...fresh] };
  });
  if (!ok) return "Your saved data couldn't be updated. Try again.";
  return added || "You already have 50 properties. Delete some before importing.";
}

export function clearAppData(): boolean {
  getSnapshot();
  try {
    // Phase 1 data first: if the second removal fails, a reload must not re-migrate data the user asked to delete.
    localStorage.removeItem(V1_KEY);
    localStorage.removeItem(V2_KEY);
    localStorage.removeItem(KEY);
  } catch {
    storageStatus = { ...storageStatus, problem: "clear" };
    notify();
    return false;
  }
  load(EMPTY_STORED);
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
    load(read());
    notify();
    return storageStatus.problem === null;
  }
  const saved = persist();
  notify();
  return saved;
}

export function exportAppData(): void {
  getSnapshot();
  const blob = new Blob([JSON.stringify(stored, null, 2)], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: "rentwise-data.json" });
  a.click();
  // Revoking in the same tick can cancel the download in Safari/Firefox.
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
