import { describe, expect, it } from "vitest";
import { gameReducer, initialGameState } from "@/lib/game";
import type { Piece } from "@/lib/types";

const piece: Piece = {
  id: 0,
  row: 0,
  col: 0,
  edges: { top: 0, right: 0, bottom: 0, left: 0 },
  zone: "tray",
  position: { x: 0.2, y: 0.2 },
  rotation: 0,
  locked: false,
};

describe("optional piece rotation", () => {
  it("can be enabled independently of difficulty", () => {
    const enabled = gameReducer(initialGameState, { type: "SET_ROTATION", enabled: true });
    const playing = { ...enabled, phase: "playing" as const, pieces: [piece] };
    expect(gameReducer(playing, { type: "ROTATE", id: 0 }).pieces[0].rotation).toBe(90);
  });

  it("is required in hard mode and turns off when leaving hard mode", () => {
    const hard = gameReducer(initialGameState, { type: "SET_DIFFICULTY", difficulty: "hard" });
    expect(hard.rotationEnabled).toBe(true);
    expect(gameReducer(hard, { type: "SET_ROTATION", enabled: false }).rotationEnabled).toBe(true);
    expect(gameReducer(hard, { type: "SET_DIFFICULTY", difficulty: "medium" }).rotationEnabled).toBe(false);
  });
});

describe("piece hints", () => {
  it("highlights a tray piece on easy and medium without consuming a hint", () => {
    for (const difficulty of ["easy", "medium"] as const) {
      const playing = { ...initialGameState, phase: "playing" as const, difficulty, pieces: [piece] };
      const hinted = gameReducer(playing, { type: "SHOW_HINT", id: piece.id });
      expect(hinted.hintVisible).toBe(true);
      expect(hinted.hintedPieceId).toBe(piece.id);
      expect(hinted.hintsRemaining).toBe(3);
    }
  });

  it("keeps hard mode to three piece hints", () => {
    const hard = { ...initialGameState, phase: "playing" as const, difficulty: "hard" as const, pieces: [piece], hintsRemaining: 1 };
    const lastHint = gameReducer(hard, { type: "SHOW_HINT", id: piece.id });
    expect(lastHint.hintsRemaining).toBe(0);
    expect(gameReducer(lastHint, { type: "SHOW_HINT", id: piece.id })).toBe(lastHint);
  });
});
