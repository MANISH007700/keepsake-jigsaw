import { describe, expect, it } from "vitest";
import { boundedPilePoint, fitTrayLayout } from "@/lib/tray";

describe("fitTrayLayout", () => {
  it("scales a large puzzle so every piece fits inside the visible tray", () => {
    const fit = fitTrayLayout(150, 420, 560, 82, 76, 8);
    const usedWidth = fit.columns * 82 * fit.scale + (fit.columns + 1) * 8;
    const usedHeight = fit.rows * 76 * fit.scale + (fit.rows + 1) * 8;
    expect(fit.columns * fit.rows).toBeGreaterThanOrEqual(150);
    expect(usedWidth).toBeLessThanOrEqual(420.001);
    expect(usedHeight).toBeLessThanOrEqual(560.001);
  });

  it("never enlarges tray pieces to full board size", () => {
    expect(fitTrayLayout(8, 600, 500, 120, 110).scale).toBeLessThanOrEqual(0.9);
  });
});

describe("boundedPilePoint", () => {
  it("keeps the whole visual piece inside the tray", () => {
    for (let index = 0; index < 30; index += 1) {
      const point = boundedPilePoint(index, 30, 400, 300, 90, 80, 8);
      expect(point.x).toBeGreaterThanOrEqual(8);
      expect(point.y).toBeGreaterThanOrEqual(8);
      expect(point.x + 90).toBeLessThanOrEqual(392);
      expect(point.y + 80).toBeLessThanOrEqual(292);
    }
  });
});
