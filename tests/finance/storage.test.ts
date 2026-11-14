import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory localStorage: the store runs in Node here, with no browser.
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

// Fresh module per test: the store caches state in a module variable.
const load = () => import("../../src/lib/storage");
const KEY = "rentwise:v1";

describe("storage guard", () => {
  beforeEach(() => {
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
});
