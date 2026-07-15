import { scrambleUnlocked } from "./puzzle";
import type { Difficulty, GameState, Piece, Point, Zone } from "./types";

export const initialGameState: GameState = {
  phase: "empty",
  difficulty: "easy",
  requestedCount: 30,
  rows: 0,
  cols: 0,
  pieces: [],
  timerEnabled: true,
  rotationEnabled: false,
  elapsedMs: 0,
  bestTime: null,
  hintVisible: false,
  hintsRemaining: 3,
  selectedPieceId: null,
  pauseReason: null,
};

export type GameAction =
  | { type: "LOADING" }
  | { type: "IMAGE_READY" }
  | { type: "RESET" }
  | { type: "SET_COUNT"; count: number }
  | { type: "SET_DIFFICULTY"; difficulty: Difficulty }
  | { type: "SET_TIMER"; enabled: boolean }
  | { type: "SET_ROTATION"; enabled: boolean }
  | { type: "CUTTING" }
  | { type: "START"; rows: number; cols: number; pieces: Piece[] }
  | { type: "MOVE"; id: number; zone: Zone; position: Point }
  | { type: "LOCK"; id: number }
  | { type: "SELECT"; id: number | null }
  | { type: "ROTATE"; id: number }
  | { type: "SCRAMBLE"; random?: () => number }
  | { type: "ARRANGE"; positions: Map<number, Point> }
  | { type: "PAUSE"; reason: "manual" | "visibility"; elapsedMs: number }
  | { type: "RESUME" }
  | { type: "TICK"; elapsedMs: number }
  | { type: "SHOW_HINT" }
  | { type: "HIDE_HINT" }
  | { type: "COMPLETE"; elapsedMs: number }
  | { type: "BACK_TO_PREVIEW" }
  | { type: "REPLAY"; pieces: Piece[] };

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "LOADING":
      return { ...state, phase: "loading" };
    case "IMAGE_READY":
      return { ...state, phase: "preview" };
    case "RESET":
      return { ...initialGameState, requestedCount: state.requestedCount, difficulty: state.difficulty, rotationEnabled: state.rotationEnabled, bestTime: state.bestTime };
    case "SET_COUNT":
      return { ...state, requestedCount: Math.min(150, Math.max(8, Math.round(action.count))) };
    case "SET_DIFFICULTY":
      return {
        ...state,
        difficulty: action.difficulty,
        rotationEnabled: action.difficulty === "hard"
          ? true
          : state.difficulty === "hard" ? false : state.rotationEnabled,
      };
    case "SET_TIMER":
      return { ...state, timerEnabled: action.enabled };
    case "SET_ROTATION":
      return { ...state, rotationEnabled: state.difficulty === "hard" ? true : action.enabled };
    case "CUTTING":
      return { ...state, phase: "cutting" };
    case "START":
      return {
        ...state,
        phase: "playing",
        rows: action.rows,
        cols: action.cols,
        pieces: action.pieces,
        elapsedMs: 0,
        hintsRemaining: 3,
        selectedPieceId: null,
        pauseReason: null,
      };
    case "MOVE":
      return {
        ...state,
        pieces: state.pieces.map((piece) =>
          piece.id === action.id && !piece.locked
            ? { ...piece, zone: action.zone, position: action.position }
            : piece,
        ),
        selectedPieceId: action.id,
      };
    case "LOCK": {
      const pieces = state.pieces.map((piece) =>
        piece.id === action.id
          ? {
              ...piece,
              zone: "board" as const,
              position: { x: piece.col / state.cols, y: piece.row / state.rows },
              rotation: 0,
              locked: true,
            }
          : piece,
      );
      return { ...state, pieces, selectedPieceId: null };
    }
    case "SELECT":
      return { ...state, selectedPieceId: action.id };
    case "ROTATE":
      if (!state.rotationEnabled) return state;
      return {
        ...state,
        pieces: state.pieces.map((piece) =>
          piece.id === action.id && !piece.locked ? { ...piece, rotation: (piece.rotation + 90) % 360 } : piece,
        ),
        selectedPieceId: action.id,
      };
    case "SCRAMBLE":
      return { ...state, pieces: scrambleUnlocked(state.pieces, action.random), selectedPieceId: null };
    case "ARRANGE":
      return {
        ...state,
        pieces: state.pieces.map((piece) =>
          piece.locked
            ? piece
            : {
                ...piece,
                zone: "tray",
                position: action.positions.get(piece.id) ?? piece.position,
              },
        ),
        selectedPieceId: null,
      };
    case "PAUSE":
      if (state.phase !== "playing") return state;
      return { ...state, phase: "paused", pauseReason: action.reason, elapsedMs: action.elapsedMs };
    case "RESUME":
      if (state.phase !== "paused") return state;
      return { ...state, phase: "playing", pauseReason: null };
    case "TICK":
      return { ...state, elapsedMs: action.elapsedMs };
    case "SHOW_HINT":
      if (state.difficulty === "easy" || (state.difficulty === "hard" && state.hintsRemaining <= 0)) return state;
      return {
        ...state,
        hintVisible: true,
        hintsRemaining: state.difficulty === "hard" ? state.hintsRemaining - 1 : state.hintsRemaining,
      };
    case "HIDE_HINT":
      return { ...state, hintVisible: false };
    case "COMPLETE":
      return {
        ...state,
        phase: "complete",
        elapsedMs: action.elapsedMs,
        bestTime: state.timerEnabled && (state.bestTime === null || action.elapsedMs < state.bestTime)
          ? action.elapsedMs
          : state.bestTime,
        selectedPieceId: null,
      };
    case "BACK_TO_PREVIEW":
      return { ...state, phase: "preview", pieces: [], elapsedMs: 0, selectedPieceId: null };
    case "REPLAY":
      return {
        ...state,
        phase: "playing",
        pieces: action.pieces,
        elapsedMs: 0,
        hintsRemaining: 3,
        selectedPieceId: null,
        pauseReason: null,
      };
    default:
      return state;
  }
}

export function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
