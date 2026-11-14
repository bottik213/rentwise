/** Round to integer cents, half away from zero (symmetric for negatives). */
export const roundCents = (x: number): number => Math.sign(x) * Math.round(Math.abs(x));

/** Engine entry guard: NaN/Infinity never propagate into results. */
export function assertFinite(obj: object, where: string): void {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "number" && !Number.isFinite(v)) throw new RangeError(`${where}: ${k} is not a finite number`);
  }
}
