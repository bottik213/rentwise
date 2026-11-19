import { beforeEach, describe, expect, it, vi } from "vitest";
import fixture from "../fixtures/v1-state.json";
import { DEMO_PROPERTY } from "../../src/data/demo-property";
import type { AppState } from "../../src/lib/storage";

// In-memory localStorage: the store runs in Node here, with no browser.
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

const load = () => import("../../src/lib/storage");
const KEY = "rentwise:kz:v1";
const V1 = "rentwise:v1";
const peek = (st: Awaited<ReturnType<typeof load>>) => {
  let v: AppState | undefined;
  st.setAppState((s) => (v = s));
  return v!;
};

beforeEach(() => {
  mem.clear();
  vi.resetModules();
});

describe("the US version's data is left alone (KZ brief: never converted)", () => {
  it("an old v1 state is not loaded, not migrated and not rewritten; the KZ store starts empty", async () => {
    const raw = JSON.stringify(fixture);
    mem.set(V1, raw);
    const st = await load();
    expect(peek(st).deals).toEqual([]);
    expect(mem.get(V1)).toBe(raw);
    expect(st.oldData()).toEqual({ [V1]: raw }); // offered as a download, byte for byte
    st.setAppState((s) => ({ ...s, property: DEMO_PROPERTY }));
    expect(mem.get(V1)).toBe(raw);
    expect(JSON.parse(mem.get(KEY)!).deals).toHaveLength(1);
  });

  it("migrateV1 still turns a real production v1 file into one deal with nothing lost (used by import)", async () => {
    const { migrateV1 } = await load();
    const v3 = migrateV1(fixture, "2026-11-15T00:00:00.000Z", "deal-1")!;
    expect(v3.v).toBe(3);
    expect(v3.deals[0].inputs).toEqual(fixture.property);
    expect(v3.deals[0].isExample).toBe(fixture.isExample);
    expect(v3.deals[0].plan).toEqual(fixture.plan);
    expect(v3.deals[0].actuals).toEqual(fixture.actuals);
    expect(v3.scenarios).toEqual(fixture.scenarios);
    expect(v3.constraints).toEqual(fixture.constraints);
    expect(v3.activeId).toBe("deal-1");
    expect(v3.deals[0].ledger.monthModes).toEqual(fixture.actuals.map((a) => ({ month: a.month, mode: "manual" })));
  });

  it("migrates v1 data written by the Phase 2 build (projection, growth deltas, new targets)", async () => {
    const { migrateV1 } = await load();
    const v1 = {
      ...fixture,
      property: { ...fixture.property, projection: { holdYears: 12, rentGrowth: 0.02, expenseGrowth: 0.03, valueGrowth: 0.025, sellingCostPct: 0.07 } },
      scenarios: { ...fixture.scenarios, conservative: { ...fixture.scenarios.conservative, rentGrowthPts: -0.03 } },
      constraints: { ...fixture.constraints, minCapRate: 0.06, minDscr: 1.25, minIrr: 0.1 },
    };
    const v2 = migrateV1(v1, "2026-11-15T00:00:00.000Z", "deal-1")!;
    expect(v2.deals[0].inputs).toEqual(v1.property);
    expect(v2.scenarios.conservative.rentGrowthPts).toBe(-0.03);
    expect(v2.constraints).toEqual(v1.constraints);
  });

  it("an empty v1 state becomes empty; a plan without a property is kept as a closed deal", async () => {
    const { migrateV1 } = await load();
    expect(migrateV1({ ...fixture, property: null, plan: null, actuals: [] })!.deals).toEqual([]);
    const planOnly = migrateV1({ ...fixture, property: null }, "2026-11-15T00:00:00.000Z", "deal-1")!;
    expect(planOnly.deals[0].inputs).toEqual(fixture.plan.inputs);
    expect(planOnly.deals[0].actuals).toEqual(fixture.actuals);
    expect(planOnly.activeId).toBeNull();
  });

  it("corrupt v1 data loads as empty and is never overwritten", async () => {
    mem.set(V1, "{broken");
    const st = await load();
    expect(peek(st)).toEqual(st.EMPTY_STATE);
    expect(mem.get(V1)).toBe("{broken");
  });

  it("clear my data removes this version's data only; the old version's keys stay", async () => {
    mem.set(V1, JSON.stringify(fixture));
    mem.set("rentwise:v2", "{}");
    const st = await load();
    st.setAppState((s) => ({ ...s, property: DEMO_PROPERTY }));
    expect(st.clearAppData()).toBe(true);
    expect([...mem.keys()].sort()).toEqual([V1, "rentwise:v2"].sort());
  });
});

describe("deals: open, rename, duplicate, delete, import", () => {
  const two = async () => {
    const st = await load();
    st.setAppState((s) => ({ ...s, property: { ...DEMO_PROPERTY, nickname: "A" } }));
    st.setAppState((s) => ({ ...s, activeId: null, property: { ...DEMO_PROPERTY, nickname: "B", monthlyRent: 300_000 }, plan: null, actuals: [] }));
    return { st, view: peek(st) };
  };

  it("a new property is added next to the open one; edits go to the open deal only", async () => {
    const { st, view } = await two();
    expect(view.deals.map((d) => d.inputs.nickname)).toEqual(["A", "B"]);
    expect(view.property!.nickname).toBe("B");
    st.setAppState((s) => ({ ...s, property: { ...s.property!, monthlyRent: 310_000 } }));
    const saved = JSON.parse(mem.get(KEY)!);
    expect(saved.deals.map((d: { inputs: { monthlyRent: number } }) => d.inputs.monthlyRent)).toEqual([245_000, 310_000]);
  });

  it("open, rename, duplicate (no plan or actuals) and delete", async () => {
    const { st, view } = await two();
    const [a, b] = view.deals;
    expect(st.openDeal(a.id)).toBe(true);
    expect(st.renameDeal(a.id, "  Maple St  ")).toBe(true);
    expect(st.duplicateDeal(b.id, (n) => `${n} (copy)`)).toBe(true);
    let v = peek(st);
    expect(v.property!.nickname).toBe("Maple St");
    expect(v.deals.map((d) => d.inputs.nickname)).toEqual(["Maple St", "B", "B (copy)"]);
    expect(v.deals[2].plan).toBeNull();
    expect(st.deleteDeal(a.id)).toBe(true);
    v = peek(st);
    expect(v.activeId).toBeNull();
    expect(v.property).toBeNull();
    expect(v.deals).toHaveLength(2);
  });

  it("imports a v1 or v2 export (validated), adds deals without touching settings, and rejects junk", async () => {
    const { st } = await two();
    expect(st.importAppData(JSON.stringify(fixture))).toBe(1);
    expect(st.importAppData(mem.get(KEY)!)).toBe(3); // a v2 export of this same browser: ids are made unique
    expect(st.importAppData("{nope")).toBe("json");
    expect(st.importAppData(JSON.stringify({ v: 2, deals: [{ id: "x" }] }))).toBe("notExport");
    const saved = JSON.parse(mem.get(KEY)!);
    expect(saved.deals).toHaveLength(6);
    expect(new Set(saved.deals.map((d: { id: string }) => d.id)).size).toBe(6);
    expect(saved.constraints).toEqual({ minMonthlyCashFlow: 0 });
  });
});

describe("v2 schema stays readable", () => {
  it("a real v2 state captured from the browser still parses (guards later schema changes)", async () => {
    const v2 = (await import("../fixtures/v2-state.json")).default;
    const { parseAnyVersion, toView } = await load();
    const parsed = parseAnyVersion(v2);
    expect(parsed).not.toBeNull();
    expect(parsed!.deals).toHaveLength(2);
    expect(toView(parsed!).actuals).toHaveLength(1);
    expect(parsed!.constraints.minIrr).toBe(0.1);
  });
});

describe("branding is kept by every kind of edit", () => {
  it("survives page edits through the open-deal view", async () => {
    const st = await load();
    st.setStored((s) => ({ ...s, branding: { company: "Lee Rentals", accent: "#8a1c3c" } }));
    st.setAppState((s) => ({ ...s, property: DEMO_PROPERTY }));
    st.setAppState((s) => ({ ...s, constraints: { minMonthlyCashFlow: 10_000 } }));
    expect(JSON.parse(mem.get(KEY)!).branding).toEqual({ company: "Lee Rentals", accent: "#8a1c3c" });
  });
  it("rejects an SVG or oversized logo", async () => {
    const st = await load();
    expect(st.setStored((s) => ({ ...s, branding: { logo: "data:image/svg+xml;base64,PHN2Zz4=" } }))).toBe(false);
    expect(st.setStored((s) => ({ ...s, branding: { logo: `data:image/png;base64,${"A".repeat(300_000)}` } }))).toBe(false);
  });
});

describe("Phase 2 files (v2 → v3), for import", () => {
  it("a real v2 state gains empty ledgers and its monthly totals become manual months", async () => {
    const v2 = (await import("../fixtures/v2-state.json")).default;
    const { migrateV2 } = await load();
    const v = migrateV2(v2)!;
    expect(v.deals.map((d) => d.id)).toEqual(v2.deals.map((d) => d.id));
    expect(v.deals.map((d) => d.actuals)).toEqual(v2.deals.map((d) => d.actuals));
    expect(v.deals.map((d) => d.plan)).toEqual(v2.deals.map((d) => d.plan));
    expect(v.activeId).toBe(v2.activeId);
    expect(v.constraints).toEqual(v2.constraints);
    expect(v.deals[0].ledger.monthModes).toEqual(v2.deals[0].actuals.map((a) => ({ month: a.month, mode: "manual" })));
    expect(v.deals[0].ledger.payments).toEqual([]);
    expect(v.v).toBe(3);
  });
  it("old v2 and v1 data in the browser is not loaded, and imports accept v1, v2 and v3 files", async () => {
    const v2 = (await import("../fixtures/v2-state.json")).default;
    mem.set("rentwise:v2", JSON.stringify(v2));
    mem.set(V1, JSON.stringify(fixture));
    const st = await load();
    expect(peek(st).deals).toEqual([]);
    expect(st.parseAnyVersion(v2)!.v).toBe(3);
    expect(st.parseAnyVersion(fixture)!.v).toBe(3);
    expect(st.importAppData(JSON.stringify(v2))).toBe(v2.deals.length);
    expect(st.parseAnyVersion(JSON.parse(mem.get(KEY)!))!.deals).toHaveLength(v2.deals.length);
  });
  it("the ledger survives page edits and a reload", async () => {
    const st = await load();
    st.setAppState((s) => ({ ...s, property: DEMO_PROPERTY }));
    const lease = { id: "L1", tenantNickname: "Unit A tenant", startDate: "2026-01-01", endDate: null, trackFrom: "2026-01-01", monthlyRent: 245_000, dueDay: 1, graceDays: 5, lateFee: null, depositAmount: 245_000, depositReceivedDate: "2026-01-01", status: "active" as const };
    expect(st.setAppState((s) => ({ ...s, ledger: { ...s.ledger, leases: [lease] } }))).toBe(true);
    st.setAppState((s) => ({ ...s, constraints: { minMonthlyCashFlow: 10_000 } }));
    vi.resetModules();
    expect(peek(await load()).ledger.leases).toEqual([lease]);
  });
  it("rejects a tenant record with anything but a short nickname", async () => {
    const st = await load();
    st.setAppState((s) => ({ ...s, property: DEMO_PROPERTY }));
    const bad = { id: "L1", tenantNickname: "", startDate: "2026-01-01", endDate: null, trackFrom: "2026-01-01", monthlyRent: 245_000, dueDay: 31, graceDays: 5, lateFee: null, depositAmount: 0, depositReceivedDate: null, status: "active" as const };
    expect(st.setAppState((s) => ({ ...s, ledger: { ...s.ledger, leases: [bad] } }))).toBe(false);
  });
});
