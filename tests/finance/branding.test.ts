import { describe, expect, it } from "vitest";
import { accentProblem, contrastRatio } from "../../src/lib/branding";

describe("report branding", () => {
  it("computes WCAG contrast", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2); // the classic AA threshold grey
  });
  it("accepts accents that pass AA on white and explains the ones that don't", () => {
    expect(accentProblem("#1e4d3b")).toBeNull();
    expect(accentProblem("#8a1c3c")).toBeNull();
    expect(accentProblem("#ffd400")).toMatch(/too light.*1\.4:1/);
    expect(accentProblem("red")).toMatch(/#1e4d3b/);
  });
});
