import { describe, expect, it } from "vitest";
import { fitGrid, generateEdges, getCellBounds, shouldSnap, scrambleUnlocked } from "@/lib/puzzle";
import { mulberry32 } from "@/lib/rng";
import type { Piece } from "@/lib/types";

describe("fitGrid", () => {
  it("keeps pieces near-square while staying close to the request", () => {
    const grid = fitGrid(30, 1500, 1000);
    const pieceAspect = (1500 / grid.cols) / (1000 / grid.rows);
    expect(Math.abs(grid.count - 30)).toBeLessThanOrEqual(3);
    expect(pieceAspect).toBeGreaterThan(0.65);
    expect(pieceAspect).toBeLessThan(1.5);
  });

  it("always respects the supported count bounds", () => {
    expect(fitGrid(2, 1000, 1000).count).toBeGreaterThanOrEqual(8);
    expect(fitGrid(999, 1000, 1000).count).toBeLessThanOrEqual(150);
  });
});

describe("edge generation", () => {
  it("gives every neighbor an exactly complementary edge", () => {
    const rows = 6;
    const cols = 5;
    const edges = generateEdges(rows, cols, 42);
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const current = edges[row * cols + col];
        if (col + 1 < cols) expect(current.right).toBe(-edges[row * cols + col + 1].left);
        if (row + 1 < rows) expect(current.bottom).toBe(-edges[(row + 1) * cols + col].top);
      }
    }
  });

  it("is deterministic for a seed", () => {
    expect(generateEdges(5, 6, 801)).toEqual(generateEdges(5, 6, 801));
    expect(generateEdges(5, 6, 801)).not.toEqual(generateEdges(5, 6, 802));
  });
});

describe("source coverage", () => {
  it("partitions every source pixel exactly once before jigsaw clipping", () => {
    const width = 1003;
    const segments = Array.from({ length: 7 }, (_, index) => getCellBounds(index, 7, width));
    expect(segments[0][0]).toBe(0);
    expect(segments.at(-1)?.[1]).toBe(width);
    segments.slice(1).forEach((segment, index) => expect(segment[0]).toBe(segments[index][1]));
    expect(segments.reduce((sum, [start, end]) => sum + end - start, 0)).toBe(width);
  });
});

describe("snap detection", () => {
  it("uses difficulty-specific radii and hard rotation", () => {
    expect(shouldSnap({ x: 35, y: 0 }, { x: 0, y: 0 }, 100, 0, "easy")).toBe(true);
    expect(shouldSnap({ x: 35, y: 0 }, { x: 0, y: 0 }, 100, 0, "medium")).toBe(false);
    expect(shouldSnap({ x: 10, y: 0 }, { x: 0, y: 0 }, 100, 90, "hard")).toBe(false);
    expect(shouldSnap({ x: 19, y: 0 }, { x: 0, y: 0 }, 100, 360, "hard")).toBe(true);
  });
});

describe("scramble", () => {
  it("never changes a locked piece", () => {
    const pieces: Piece[] = Array.from({ length: 6 }, (_, id) => ({
      id,
      row: 0,
      col: id,
      edges: { top: 0, right: 0, bottom: 0, left: 0 },
      zone: id === 0 ? "board" : "tray",
      position: { x: id / 10, y: id / 12 },
      rotation: id * 90,
      locked: id === 0,
    }));
    const lockedBefore = structuredClone(pieces[0]);
    const result = scrambleUnlocked(pieces, mulberry32(99));
    expect(result[0]).toEqual(lockedBefore);
    expect(result.slice(1).map((piece) => piece.position)).not.toEqual(pieces.slice(1).map((piece) => piece.position));
  });
});
