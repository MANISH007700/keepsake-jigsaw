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
