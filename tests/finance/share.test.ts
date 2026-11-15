import { describe, expect, it } from "vitest";
import { DEMO_PROPERTY } from "../../src/data/demo-property";
import { DEFAULT_SCENARIOS } from "../../src/lib/finance/scenarios";
import { SAFE_LINK_LENGTH, buildShareLink, decodeShare, encodeShare, type SharePayload } from "../../src/lib/share";

const base: SharePayload = { inputs: DEMO_PROPERTY, isExample: true, scenarios: DEFAULT_SCENARIOS, constraints: { minMonthlyCashFlow: 0, minIrr: 0.1 } };
const fixture = (await import("../fixtures/v1-state.json")).default;

describe("share link", () => {
  it("round-trips inputs, scenarios, targets and branding, and stays short", async () => {
    const payload = { ...base, branding: { company: "Lee Rentals", accent: "#8a1c3c" } };
    const enc = await encodeShare(payload);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).toMatch(/^v1\.[A-Za-z0-9_-]+$/); // URL-safe, no padding
    expect(enc.length).toBeLessThan(2_000);
    const dec = await decodeShare(`#${enc}`);
    expect(dec).toEqual({ ok: true, payload });
  });

  it("carries a plan and actuals only when included", async () => {
    const plain = await decodeShare(await encodeShare(base));
    expect(plain.ok && plain.payload.owned).toBeUndefined();
    const withActuals = await decodeShare(await encodeShare({ ...base, owned: { plan: fixture.plan, actuals: fixture.actuals } as SharePayload["owned"] }));
    expect(withActuals.ok && withActuals.payload.owned?.actuals).toEqual(fixture.actuals);
  });

  it("drops a logo that would make the link too long, and says so", async () => {
    // Random bytes don't compress, like a real PNG.
    let seed = 42;
    const bytes = Array.from({ length: 30_000 }, () => String.fromCharCode((seed = (seed * 1103515245 + 12345) % 2147483648) >> 23)).join("");
    const logo = `data:image/png;base64,${btoa(bytes)}`;
    const r = await buildShareLink("https://example.test", { ...base, branding: { company: "Lee Rentals", logo } });
    expect(r.logoDropped).toBe(true);
    expect(r.url.length).toBeLessThanOrEqual(SAFE_LINK_LENGTH);
    const dec = await decodeShare(r.url.split("#")[1]);
    expect(dec.ok && dec.payload.branding).toEqual({ company: "Lee Rentals" });
  });

  it("broken, tampered, empty and newer links are reported, never thrown", async () => {
    expect(await decodeShare("")).toEqual({ ok: false, reason: "empty" });
    expect(await decodeShare("#v1.not-real-data")).toEqual({ ok: false, reason: "broken" });
    expect(await decodeShare("#hello")).toEqual({ ok: false, reason: "broken" });
    expect(await decodeShare("#v2.abc")).toEqual({ ok: false, reason: "newer" });
    const enc = await encodeShare(base);
    expect((await decodeShare(enc.slice(0, -10))).ok).toBe(false); // truncated by a chat app
    // A hand-edited payload with an impossible vacancy is rejected by the same schema as typed input.
    const json = new TextEncoder().encode(JSON.stringify({ ...base, inputs: { ...DEMO_PROPERTY, vacancyPct: 5 } }));
    const z = new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
    const b64 = btoa(String.fromCharCode(...z)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(await decodeShare(`v1.${b64}`)).toEqual({ ok: false, reason: "broken" });
  });
});
