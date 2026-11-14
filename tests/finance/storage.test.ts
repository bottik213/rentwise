import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory localStorage: the store runs in Node here, with no browser.
const mem = new Map<string, string>();
const storage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};
vi.stubGlobal("localStorage", storage);

// Fresh module per test: the store caches state in a module variable.
const load = () => import("../../src/lib/storage");
const KEY = "rentwise:v1";

describe("storage guard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mem.clear();
    vi.resetModules();
  });

  it("refuses to save a state that would be rejected on reload", async () => {
    const { setAppState } = await load();
    setAppState((s) => ({ ...s, constraints: { minMonthlyCashFlow: 20_000 } }));
    const saved = mem.get(KEY);

    setAppState((s) => ({ ...s, constraints: { minMonthlyCashFlow: 1.5 } })); // not whole cents
    expect(mem.get(KEY)).toBe(saved);
    expect(JSON.parse(mem.get(KEY)!).constraints.minMonthlyCashFlow).toBe(20_000);
  });

  it("loads corrupt data as the empty state instead of crashing", async () => {
    mem.set(KEY, "{not json");
    const { setAppState, EMPTY_STATE } = await load();
    let seen: unknown;
    setAppState((s) => (seen = s));
    expect(seen).toEqual(EMPTY_STATE);
  });

  it("keeps unsaved edits in memory and retries the latest version after a quota error", async () => {
    const { setAppState, getStorageStatus, retryStorage } = await load();
    setAppState((s) => ({ ...s, constraints: { minMonthlyCashFlow: 20_000 } }));
    const saved = mem.get(KEY);
    const write = vi.spyOn(storage, "setItem").mockImplementation(() => { throw new DOMException("Full", "QuotaExceededError"); });

    setAppState((s) => ({ ...s, constraints: { minMonthlyCashFlow: 30_000 } }));
    setAppState((s) => ({ ...s, constraints: { ...s.constraints, maxUpfrontCash: 8_500_000 } }));
    expect(mem.get(KEY)).toBe(saved);
    expect(getStorageStatus()).toEqual({ problem: "save", hasUnsavedChanges: true });
    expect(retryStorage()).toBe(false);

    // Invalid edits cannot clear the warning or replace the valid, unsaved changes.
    setAppState((s) => ({ ...s, constraints: { minMonthlyCashFlow: 1.5 } }));
    expect(getStorageStatus().hasUnsavedChanges).toBe(true);
    write.mockRestore();
    expect(retryStorage()).toBe(true);
    expect(JSON.parse(mem.get(KEY)!).constraints).toEqual({ minMonthlyCashFlow: 30_000, maxUpfrontCash: 8_500_000 });
    expect(getStorageStatus()).toEqual({ problem: null, hasUnsavedChanges: false });
  });

  it("retries a failed load without overwriting the existing saved data", async () => {
    const { EMPTY_STATE, setAppState, getStorageStatus, retryStorage } = await load();
    const saved = JSON.stringify({ ...EMPTY_STATE, constraints: { minMonthlyCashFlow: 40_000 } });
    mem.set(KEY, saved);
    const read = vi.spyOn(storage, "getItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });

    expect(getStorageStatus()).toEqual({ problem: "read", hasUnsavedChanges: false });
    expect(retryStorage()).toBe(false);
    expect(mem.get(KEY)).toBe(saved);
    read.mockRestore();
    expect(retryStorage()).toBe(true);
    expect(mem.get(KEY)).toBe(saved);
    let seen: unknown;
    setAppState((s) => { seen = s.constraints.minMonthlyCashFlow; return s; });
    expect(seen).toBe(40_000);
    expect(getStorageStatus().problem).toBeNull();
  });

  it("does not report a successful clear when deletion fails, and retries deletion", async () => {
    const { setAppState, clearAppData, getStorageStatus, retryStorage, EMPTY_STATE } = await load();
    setAppState((s) => ({ ...s, constraints: { minMonthlyCashFlow: 20_000 } }));
    const saved = mem.get(KEY);
    const remove = vi.spyOn(storage, "removeItem").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });

    expect(clearAppData()).toBe(false);
    expect(mem.get(KEY)).toBe(saved);
    expect(getStorageStatus()).toEqual({ problem: "clear", hasUnsavedChanges: false });
    expect(retryStorage()).toBe(false);
    remove.mockRestore();
    expect(retryStorage()).toBe(true);
    expect(mem.has(KEY)).toBe(false);
    expect(getStorageStatus()).toEqual({ problem: null, hasUnsavedChanges: false });
    let seen: unknown;
    setAppState((s) => { seen = s; return s; });
    expect(seen).toEqual(EMPTY_STATE);
  });

  it("keeps the unsaved-change warning after a failed clear", async () => {
    const { setAppState, clearAppData, getStorageStatus } = await load();
    vi.spyOn(storage, "setItem").mockImplementation(() => { throw new Error("Blocked"); });
    setAppState((s) => ({ ...s, constraints: { minMonthlyCashFlow: 30_000 } }));
    vi.spyOn(storage, "removeItem").mockImplementation(() => { throw new Error("Blocked"); });

    expect(clearAppData()).toBe(false);
    expect(getStorageStatus()).toEqual({ problem: "clear", hasUnsavedChanges: true });
  });

  it("blocks edits until unread saved data has been loaded, even after access recovers", async () => {
    const { EMPTY_STATE, setAppState, getStorageStatus, retryStorage } = await load();
    const saved = JSON.stringify({ ...EMPTY_STATE, constraints: { minMonthlyCashFlow: 40_000 } });
    mem.set(KEY, saved);
    const read = vi.spyOn(storage, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    const edit = vi.fn((s) => ({ ...s, constraints: { maxUpfrontCash: 8_500_000 } }));

    expect(setAppState(edit)).toBe(false);
    expect(edit).not.toHaveBeenCalled();
    read.mockRestore();
    expect(setAppState(edit)).toBe(false);
    expect(mem.get(KEY)).toBe(saved);
    expect(getStorageStatus().problem).toBe("read");

    expect(retryStorage()).toBe(true);
    expect(setAppState((s) => ({ ...s, constraints: { ...s.constraints, maxUpfrontCash: 8_500_000 } }))).toBe(true);
    expect(JSON.parse(mem.get(KEY)!).constraints).toEqual({ minMonthlyCashFlow: 40_000, maxUpfrontCash: 8_500_000 });
  });

  it("failed deletion cannot bypass the unread-data guard", async () => {
    const { EMPTY_STATE, getStorageStatus, setAppState, clearAppData, retryStorage } = await load();
    const saved = JSON.stringify({ ...EMPTY_STATE, constraints: { minMonthlyCashFlow: 40_000 } });
    mem.set(KEY, saved);
    const read = vi.spyOn(storage, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    getStorageStatus();
    const remove = vi.spyOn(storage, "removeItem").mockImplementation(() => { throw new Error("Blocked"); });
    expect(clearAppData()).toBe(false);
    read.mockRestore();
    expect(setAppState((s) => ({ ...s, constraints: {} }))).toBe(false);
    expect(mem.get(KEY)).toBe(saved);

    remove.mockRestore();
    expect(retryStorage()).toBe(true); // Retry the deletion the user explicitly requested.
    expect(mem.has(KEY)).toBe(false);
    expect(setAppState((s) => ({ ...s, constraints: { minMonthlyCashFlow: 20_000 } }))).toBe(true);
  });
});
