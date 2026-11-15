/** WCAG 2 relative luminance of a #rrggbb color. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colors (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The report is white (the card color) on screen and paper; AA for normal text is 4.5:1. */
export const ACCENT_MIN_CONTRAST = 4.5;
export const accentProblem = (hex: string): string | null => {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "Use a color like #1e4d3b.";
  const r = contrastRatio(hex, "#ffffff");
  return r >= ACCENT_MIN_CONTRAST ? null : `That color is too light to read on white (${r.toFixed(1)}:1; it needs ${ACCENT_MIN_CONTRAST}:1). Pick a darker one.`;
};

export const LOGO_MAX_BYTES = 200_000;

/** Reads a PNG or JPG logo as a data URL. SVG is refused: it can carry scripts. */
export function readLogo(file: File): Promise<string> {
  if (!["image/png", "image/jpeg"].includes(file.type)) return Promise.reject(new Error("Use a PNG or JPG logo. SVG files aren't accepted."));
  if (file.size > LOGO_MAX_BYTES) return Promise.reject(new Error("That logo is over 200 KB. Export a smaller version."));
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("That file couldn't be read."));
    r.readAsDataURL(file);
  });
}
