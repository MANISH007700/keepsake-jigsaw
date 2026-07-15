import { mulberry32, shuffle } from "./rng";
import type { Difficulty, Piece, PieceEdges, Point, RasterPiece } from "./types";

export type GridFit = { rows: number; cols: number; count: number; score: number };

export function fitGrid(requestedCount: number, imageWidth: number, imageHeight: number): GridFit {
  const target = Math.min(150, Math.max(8, Math.round(requestedCount)));
  const aspect = Math.max(0.08, Math.min(12, imageWidth / imageHeight));
  let best: GridFit | null = null;

  for (let rows = 1; rows <= 30; rows += 1) {
    for (let cols = 1; cols <= 30; cols += 1) {
      const count = rows * cols;
      if (count < 8 || count > 150) continue;
      const pieceAspect = aspect * (rows / cols);
      const squarenessPenalty = Math.abs(Math.log(pieceAspect));
      const countPenalty = Math.abs(count - target) / target;
      const extremePenalty = pieceAspect < 0.42 || pieceAspect > 2.4 ? 1.25 : 0;
      const score = countPenalty * 2.5 + squarenessPenalty + extremePenalty;
      if (
        !best ||
        score < best.score - 1e-9 ||
        (Math.abs(score - best.score) < 1e-9 && Math.abs(count - target) < Math.abs(best.count - target))
      ) {
        best = { rows, cols, count, score };
      }
    }
  }

  if (!best) throw new Error("Could not fit a puzzle grid.");
  return best;
}

export function generateEdges(rows: number, cols: number, seed: number): PieceEdges[] {
  const random = mulberry32(seed);
  const edges: PieceEdges[] = [];
  const horizontal = Array.from({ length: Math.max(0, rows - 1) }, () =>
    Array.from({ length: cols }, () => (random() < 0.5 ? -1 : 1) as -1 | 1),
  );
  const vertical = Array.from({ length: rows }, () =>
    Array.from({ length: Math.max(0, cols - 1) }, () => (random() < 0.5 ? -1 : 1) as -1 | 1),
  );

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      edges.push({
        top: row === 0 ? 0 : ((-horizontal[row - 1][col]) as -1 | 1),
        right: col === cols - 1 ? 0 : vertical[row][col],
        bottom: row === rows - 1 ? 0 : horizontal[row][col],
        left: col === 0 ? 0 : ((-vertical[row][col - 1]) as -1 | 1),
      });
    }
  }
  return edges;
}

export function getCellBounds(index: number, total: number, size: number): [number, number] {
  return [Math.round((index * size) / total), Math.round(((index + 1) * size) / total)];
}

type CanvasPath = CanvasRenderingContext2D | Path2D;

function edgeSegment(
  path: CanvasPath,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  outwardX: number,
  outwardY: number,
  direction: -1 | 0 | 1,
  amplitude: number,
) {
  if (direction === 0) {
    path.lineTo(endX, endY);
    return;
  }
  const dx = endX - startX;
  const dy = endY - startY;
  const point = (t: number, lift = 0) => ({
    x: startX + dx * t + outwardX * amplitude * direction * lift,
    y: startY + dy * t + outwardY * amplitude * direction * lift,
  });
  const p33 = point(0.33);
  const p40 = point(0.4, 0.92);
  const p46 = point(0.46, 1);
  const p50 = point(0.5, 1.08);
  const p54 = point(0.54, 1);
  const p60 = point(0.6, 0.92);
  const p67 = point(0.67);
  path.lineTo(p33.x, p33.y);
  path.bezierCurveTo(point(0.38).x, point(0.38).y, point(0.36, 0.92).x, point(0.36, 0.92).y, p40.x, p40.y);
  path.bezierCurveTo(point(0.42, 1).x, point(0.42, 1).y, p44().x, p44().y, p46.x, p46.y);
  path.bezierCurveTo(point(0.48, 1.08).x, point(0.48, 1.08).y, point(0.49, 1.08).x, point(0.49, 1.08).y, p50.x, p50.y);
  path.bezierCurveTo(point(0.51, 1.08).x, point(0.51, 1.08).y, point(0.52, 1.08).x, point(0.52, 1.08).y, p54.x, p54.y);
  path.bezierCurveTo(p56().x, p56().y, point(0.58, 1).x, point(0.58, 1).y, p60.x, p60.y);
  path.bezierCurveTo(point(0.64, 0.92).x, point(0.64, 0.92).y, point(0.62).x, point(0.62).y, p67.x, p67.y);
  path.lineTo(endX, endY);

  function p44() {
    return point(0.44, 1);
  }
  function p56() {
    return point(0.56, 1);
  }
}

export function createPiecePath(
  coreWidth: number,
  coreHeight: number,
  padding: number,
  edges: PieceEdges,
): Path2D {
  const path = new Path2D();
  const x = padding;
  const y = padding;
  const amplitude = Math.min(coreWidth, coreHeight) * 0.23;
  path.moveTo(x, y);
  edgeSegment(path, x, y, x + coreWidth, y, 0, -1, edges.top, amplitude);
  edgeSegment(path, x + coreWidth, y, x + coreWidth, y + coreHeight, 1, 0, edges.right, amplitude);
  edgeSegment(path, x + coreWidth, y + coreHeight, x, y + coreHeight, 0, 1, edges.bottom, amplitude);
  edgeSegment(path, x, y + coreHeight, x, y, -1, 0, edges.left, amplitude);
  path.closePath();
  return path;
}

export function rasterizePieces(
  source: HTMLCanvasElement,
  rows: number,
  cols: number,
  edgeMap: PieceEdges[],
): RasterPiece[] {
  const averageWidth = source.width / cols;
  const averageHeight = source.height / rows;
  const padding = Math.ceil(Math.min(averageWidth, averageHeight) * 0.27);
  const pieces: RasterPiece[] = [];

  for (let row = 0; row < rows; row += 1) {
    const [sourceY, nextY] = getCellBounds(row, rows, source.height);
    for (let col = 0; col < cols; col += 1) {
      const id = row * cols + col;
      const [sourceX, nextX] = getCellBounds(col, cols, source.width);
      const coreWidth = nextX - sourceX;
      const coreHeight = nextY - sourceY;
      const canvas = document.createElement("canvas");
      canvas.width = coreWidth + padding * 2;
      canvas.height = coreHeight + padding * 2;
      const context = canvas.getContext("2d", { alpha: true });
      if (!context) throw new Error("Canvas is unavailable in this browser.");
      const path = createPiecePath(coreWidth, coreHeight, padding, edgeMap[id]);
      context.clip(path);
      context.drawImage(source, padding - sourceX, padding - sourceY);
      pieces.push({ id, canvas, sourceX, sourceY, coreWidth, coreHeight, padding });
    }
  }
  return pieces;
}

export function createPieces(
  rows: number,
  cols: number,
  edgeMap: PieceEdges[],
  difficulty: Difficulty,
  seed: number,
  rotationEnabled = difficulty === "hard",
): Piece[] {
  const random = mulberry32(seed ^ 0xa53c9e1f);
  const ids = shuffle(Array.from({ length: rows * cols }, (_, id) => id), random);
  const trayPositions = ids.map((_, index) => ({
    x: 0.08 + (index % Math.max(2, Math.ceil(Math.sqrt(ids.length / 1.5)))) * 0.14,
    y: 0.06 + Math.floor(index / Math.max(2, Math.ceil(Math.sqrt(ids.length / 1.5)))) * 0.1,
  }));
  const positionsById = new Map(ids.map((id, index) => [id, trayPositions[index]]));
  return Array.from({ length: rows * cols }, (_, id) => ({
    id,
    row: Math.floor(id / cols),
    col: id % cols,
    edges: edgeMap[id],
    zone: "tray" as const,
    position: positionsById.get(id) ?? { x: 0.1, y: 0.1 },
    rotation: rotationEnabled ? Math.floor(random() * 4) * 90 : 0,
    locked: false,
  }));
}

export function shouldSnap(
  current: Point,
  target: Point,
  pieceWidth: number,
  rotation: number,
  difficulty: Difficulty,
  rotationRequired = difficulty === "hard",
): boolean {
  if (rotationRequired && ((rotation % 360) + 360) % 360 !== 0) return false;
  const tolerance = pieceWidth * (difficulty === "easy" ? 0.4 : difficulty === "medium" ? 0.3 : 0.2);
  return Math.hypot(current.x - target.x, current.y - target.y) <= tolerance;
}

export function scrambleUnlocked(pieces: Piece[], random: () => number = Math.random): Piece[] {
  const unlocked = pieces.filter((piece) => !piece.locked);
  const positions = shuffle(unlocked.map((piece) => ({ zone: piece.zone, position: piece.position, rotation: piece.rotation })), random);
  let cursor = 0;
  return pieces.map((piece) => {
    if (piece.locked) return piece;
    const next = positions[cursor++];
    return { ...piece, zone: next.zone, position: { ...next.position }, rotation: next.rotation };
  });
}
