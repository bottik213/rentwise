import { z } from "zod";
import { ActualMonthSchema, BrandingSchema, PropertyInputsSchema, StoredStateSchema } from "./validation";

/**
 * A share link carries inputs only, never results: the recipient's browser recalculates everything with the
 * same engine. It lives in the URL fragment (/r#v1.…), which browsers never send to a server.
 */
const LinkSchemaV1 = z.object({
  inputs: PropertyInputsSchema,
  isExample: z.boolean(),
  scenarios: StoredStateSchema.shape.scenarios,
  constraints: StoredStateSchema.shape.constraints,
  branding: BrandingSchema.optional(),
  /** Only when the sender ticks "include actuals". */
  owned: z.object({ plan: z.object({ inputs: PropertyInputsSchema, lockedAt: z.string() }), actuals: z.array(ActualMonthSchema).max(600) }).optional(),
});
export type SharePayload = z.infer<typeof LinkSchemaV1>;

const VERSION = "v1";
/** Longer links get cut off by chat apps and email clients; past this the logo is left out. */
export const SAFE_LINK_LENGTH = 8_000;

const toB64Url = (bytes: Uint8Array) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64Url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeShare(payload: SharePayload): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(LinkSchemaV1.parse(payload)));
  return `${VERSION}.${toB64Url(await pipe(json, new CompressionStream("deflate-raw")))}`;
}

export type DecodeResult = { ok: true; payload: SharePayload } | { ok: false; reason: "empty" | "newer" | "broken" };

/** Every value is validated as if a user had typed it: a tampered link can't push anything odd into the engine. */
export async function decodeShare(fragment: string): Promise<DecodeResult> {
  const f = fragment.replace(/^#/, "");
  if (!f) return { ok: false, reason: "empty" };
  const [version, data] = [f.slice(0, f.indexOf(".")), f.slice(f.indexOf(".") + 1)];
  if (/^v\d+$/.test(version) && version !== VERSION) return { ok: false, reason: "newer" };
  if (version !== VERSION || !data) return { ok: false, reason: "broken" };
  try {
    const json = new TextDecoder().decode(await pipe(fromB64Url(data), new DecompressionStream("deflate-raw")));
    const parsed = LinkSchemaV1.safeParse(JSON.parse(json));
    return parsed.success ? { ok: true, payload: parsed.data } : { ok: false, reason: "broken" };
  } catch {
    return { ok: false, reason: "broken" };
  }
}

/** Builds the full link; drops the logo if it would make the link unsafe to paste. */
export async function buildShareLink(origin: string, payload: SharePayload): Promise<{ url: string; logoDropped: boolean }> {
  const url = `${origin}/r#${await encodeShare(payload)}`;
  if (url.length <= SAFE_LINK_LENGTH || !payload.branding?.logo) return { url, logoDropped: false };
  const { logo: _, ...rest } = payload.branding;
  void _;
  return { url: `${origin}/r#${await encodeShare({ ...payload, branding: rest })}`, logoDropped: true };
}
