export type Difficulty = "easy" | "medium" | "hard";
export type GamePhase = "empty" | "loading" | "preview" | "cutting" | "playing" | "paused" | "complete";
export type Zone = "tray" | "board";

export type Point = { x: number; y: number };

export type PieceEdges = {
  top: -1 | 0 | 1;
  right: -1 | 0 | 1;
  bottom: -1 | 0 | 1;
  left: -1 | 0 | 1;
};

export type Piece = {
  id: number;
  row: number;
  col: number;
  edges: PieceEdges;
  zone: Zone;
  position: Point;
  rotation: number;
  locked: boolean;
};

export type RasterPiece = {
  id: number;
  canvas: HTMLCanvasElement;
  sourceX: number;
  sourceY: number;
  coreWidth: number;
  coreHeight: number;
  padding: number;
};

export type ImageAsset = {
  name: string;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
};

export type GameState = {
  phase: GamePhase;
  difficulty: Difficulty;
  requestedCount: number;
  rows: number;
  cols: number;
  pieces: Piece[];
  timerEnabled: boolean;
  elapsedMs: number;
  bestTime: number | null;
  hintVisible: boolean;
  hintsRemaining: number;
  selectedPieceId: number | null;
  pauseReason: "manual" | "visibility" | null;
};
