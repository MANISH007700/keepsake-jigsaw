"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardGuides, PieceCanvas } from "./CanvasViews";
import { shouldSnap } from "@/lib/puzzle";
import { shuffle } from "@/lib/rng";
import { soundEngine } from "@/lib/sound";
import { boundedPilePoint, fitTrayLayout } from "@/lib/tray";
import type { GameAction } from "@/lib/game";
import type { GameState, ImageAsset, Piece, Point, RasterPiece, Zone } from "@/lib/types";
import { trackAnalytics } from "@/lib/analytics";

type Size = { width: number; height: number };
type DragState = {
  id: number;
  pointerId: number;
  startX: number;
  startY: number;
  offsetCoreX: number;
  offsetCoreY: number;
  originalCss: string;
  element: HTMLCanvasElement;
  moved: boolean;
};

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function GameBoard({
  state,
  asset,
  rasters,
  dispatch,
  sessionVersion,
}: {
  state: GameState;
  asset: ImageAsset;
  rasters: Map<number, RasterPiece>;
  dispatch: React.Dispatch<GameAction>;
  sessionVersion: number;
}) {
  const [boardRef, boardSize] = useElementSize<HTMLDivElement>();
  const [boardWrapRef, boardWrapSize] = useElementSize<HTMLDivElement>();
  const [trayScrollRef, trayViewport] = useElementSize<HTMLDivElement>();
  const [trayMode, setTrayMode] = useState<"pile" | "spread">("pile");
  const traySurfaceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const arrangedVersion = useRef<number>(-1);
  const unlockedCount = state.pieces.filter((piece) => !piece.locked).length;
  const cellWidth = boardSize.width / Math.max(1, state.cols);
  const cellHeight = boardSize.height / Math.max(1, state.rows);
  const displayPadding = Math.min(cellWidth, cellHeight) * 0.27;
  const boardAspect = asset.width / asset.height;
  const fittedBoardWidth = boardWrapSize.width && boardWrapSize.height
    ? Math.min(boardWrapSize.width, boardWrapSize.height * boardAspect)
    : undefined;
  const gap = 9;
  const trayWidth = Math.max(1, trayViewport.width);
  const trayHeight = Math.max(1, trayViewport.height);
  const visualPieceWidth = cellWidth + displayPadding * 2;
  const visualPieceHeight = cellHeight + displayPadding * 2;
  const trayFit = useMemo(
    () => fitTrayLayout(Math.max(1, state.pieces.length), trayWidth, trayHeight, visualPieceWidth, visualPieceHeight, gap),
    [state.pieces.length, trayHeight, trayWidth, visualPieceHeight, visualPieceWidth],
  );
  const pileScale = Math.min(
    0.76,
    Math.max(
      trayFit.scale,
      Math.min(0.46, (trayWidth - gap * 2) / Math.max(1, visualPieceWidth), (trayHeight - gap * 2) / Math.max(1, visualPieceHeight)),
    ),
  );
  const trayScale = trayMode === "spread" ? trayFit.scale : pileScale;

  const arrangeTray = useCallback(
    (mode: "pile" | "spread") => {
      if (!trayWidth || !trayHeight || !cellWidth || !cellHeight) return;
      const unlocked = state.pieces.filter((piece) => !piece.locked);
      const ordered = mode === "pile" ? shuffle(unlocked) : [...unlocked].sort((a, b) => a.id - b.id);
      const positions = new Map<number, Point>();
      const scale = mode === "spread" ? trayFit.scale : pileScale;
      const scaledVisualWidth = visualPieceWidth * scale;
      const scaledVisualHeight = visualPieceHeight * scale;
      const scaledPadding = displayPadding * scale;
      const usedColumns = Math.min(trayFit.columns, Math.max(1, ordered.length));
      const usedRows = Math.ceil(ordered.length / usedColumns);
      const gridWidth = usedColumns * scaledVisualWidth + Math.max(0, usedColumns - 1) * gap;
      const gridHeight = usedRows * scaledVisualHeight + Math.max(0, usedRows - 1) * gap;
      const gridLeft = Math.max(gap, (trayWidth - gridWidth) / 2);
      const gridTop = Math.max(gap, (trayHeight - gridHeight) / 2);
      ordered.forEach((piece, index) => {
        const visualPoint = mode === "pile"
          ? boundedPilePoint(index, ordered.length, trayWidth, trayHeight, scaledVisualWidth, scaledVisualHeight, gap)
          : {
              x: gridLeft + (index % usedColumns) * (scaledVisualWidth + gap),
              y: gridTop + Math.floor(index / usedColumns) * (scaledVisualHeight + gap),
            };
        positions.set(piece.id, {
          x: (visualPoint.x + scaledPadding) / trayWidth,
          y: (visualPoint.y + scaledPadding) / trayHeight,
        });
      });
      setTrayMode(mode);
      dispatch({ type: "ARRANGE", positions });
    }, [cellHeight, cellWidth, dispatch, displayPadding, pileScale, state.pieces, trayFit.columns, trayFit.scale, trayHeight, trayWidth, visualPieceHeight, visualPieceWidth]);

  useEffect(() => {
    if (arrangedVersion.current === sessionVersion || !boardSize.width || !trayViewport.width) return;
    arrangedVersion.current = sessionVersion;
    arrangeTray("pile");
  }, [arrangeTray, boardSize.width, sessionVersion, trayViewport.width]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "r" || !state.rotationEnabled || state.selectedPieceId === null || state.phase !== "playing") return;
      soundEngine.playRotate();
      dispatch({ type: "ROTATE", id: state.selectedPieceId });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, state.phase, state.rotationEnabled, state.selectedPieceId]);

  const beginDrag = (event: React.PointerEvent<HTMLCanvasElement>, piece: Piece) => {
    if (piece.locked || state.phase !== "playing" || !event.isPrimary || event.button !== 0 || dragRef.current) return;
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const raster = rasters.get(piece.id);
    if (!raster) return;
    const currentScale = piece.zone === "tray" ? trayScale : 1;
    const padX = displayPadding * currentScale;
    const padY = displayPadding * currentScale;
    const coreLeft = rect.left + padX;
    const coreTop = rect.top + padY;
    const pointerRatioX = clamp((event.clientX - coreLeft) / Math.max(1, cellWidth * currentScale), 0, 1);
    const pointerRatioY = clamp((event.clientY - coreTop) / Math.max(1, cellHeight * currentScale), 0, 1);
    const offsetCoreX = pointerRatioX * cellWidth;
    const offsetCoreY = pointerRatioY * cellHeight;
    element.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: piece.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetCoreX,
      offsetCoreY,
      originalCss: element.style.cssText,
      element,
      moved: false,
    };
    element.style.position = "fixed";
    element.style.left = "0";
    element.style.top = "0";
    element.style.width = `${visualPieceWidth}px`;
    element.style.height = `${visualPieceHeight}px`;
    element.style.zIndex = "1000";
    element.style.transform = `translate3d(${event.clientX - offsetCoreX - displayPadding}px, ${event.clientY - offsetCoreY - displayPadding}px, 0) rotate(${piece.rotation}deg) scale(1.055)`;
    dispatch({ type: "SELECT", id: piece.id });
    soundEngine.playPickup();
    event.preventDefault();
  };

  const moveDrag = (event: React.PointerEvent<HTMLCanvasElement>, piece: Piece) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.id !== piece.id) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (distance > 5) drag.moved = true;
    const raster = rasters.get(piece.id);
    if (!raster) return;
    const visualLeft = event.clientX - drag.offsetCoreX - displayPadding;
    const visualTop = event.clientY - drag.offsetCoreY - displayPadding;
    drag.element.style.transform = `translate3d(${visualLeft}px, ${visualTop}px, 0) rotate(${piece.rotation}deg) scale(1.055)`;
    event.preventDefault();
  };

  const endDrag = (event: React.PointerEvent<HTMLCanvasElement>, piece: Piece) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.id !== piece.id) return;
    drag.element.style.cssText = drag.originalCss;
    if (drag.element.hasPointerCapture(event.pointerId)) drag.element.releasePointerCapture(event.pointerId);
    dragRef.current = null;

    if (!drag.moved && state.rotationEnabled) {
      soundEngine.playRotate();
      dispatch({ type: "ROTATE", id: piece.id });
      return;
    }

    const coreLeft = event.clientX - drag.offsetCoreX;
    const coreTop = event.clientY - drag.offsetCoreY;
    const boardRect = boardRef.current?.getBoundingClientRect();
    const trayRect = traySurfaceRef.current?.getBoundingClientRect();
    if (!boardRect || !trayRect) return;
    const overBoard =
      event.clientX >= boardRect.left && event.clientX <= boardRect.right &&
      event.clientY >= boardRect.top && event.clientY <= boardRect.bottom;
    const zone: Zone = overBoard ? "board" : "tray";
    let position: Point;

    if (zone === "board") {
      const pixelPosition = { x: coreLeft - boardRect.left, y: coreTop - boardRect.top };
      const target = { x: piece.col * cellWidth, y: piece.row * cellHeight };
      if (shouldSnap(pixelPosition, target, Math.min(cellWidth, cellHeight), piece.rotation, state.difficulty, state.rotationEnabled)) {
        dispatch({ type: "MOVE", id: piece.id, zone: "board", position: { x: piece.col / state.cols, y: piece.row / state.rows } });
        dispatch({ type: "LOCK", id: piece.id });
        trackAnalytics({ event: "piece_placed" });
        soundEngine.playSnap();
        return;
      }
      soundEngine.playMiss();
      position = {
        x: clamp(pixelPosition.x / boardRect.width, -0.12, 1 - 0.25 / state.cols),
        y: clamp(pixelPosition.y / boardRect.height, -0.12, 1 - 0.25 / state.rows),
      };
    } else {
      const scaledPadding = displayPadding * trayScale;
      const minX = scaledPadding;
      const minY = scaledPadding;
      const maxX = Math.max(minX, trayRect.width - (cellWidth + displayPadding) * trayScale);
      const maxY = Math.max(minY, trayRect.height - (cellHeight + displayPadding) * trayScale);
      position = {
        x: clamp(coreLeft - trayRect.left, minX, maxX) / trayRect.width,
        y: clamp(coreTop - trayRect.top, minY, maxY) / trayRect.height,
      };
    }
    dispatch({ type: "MOVE", id: piece.id, zone, position });
  };

  const renderPiece = (piece: Piece, container: Size) => {
    const raster = rasters.get(piece.id);
    if (!raster) return null;
    const scale = piece.zone === "tray" ? trayScale : 1;
    const visualWidth = visualPieceWidth * scale;
    const visualHeight = visualPieceHeight * scale;
    const scaledPadding = displayPadding * scale;
    const left = piece.position.x * container.width - scaledPadding;
    const top = piece.position.y * container.height - scaledPadding;
    const style: React.CSSProperties = {
      width: visualWidth,
      height: visualHeight,
      transform: `translate3d(${left}px, ${top}px, 0) rotate(${piece.rotation}deg)`,
      zIndex: piece.locked ? 2 : state.selectedPieceId === piece.id ? 20 : 4 + (piece.id % 6),
    };
    return (
      <PieceCanvas
        key={piece.id}
        piece={piece}
        raster={raster}
        style={style}
        selected={state.selectedPieceId === piece.id}
        onPointerDown={(event) => beginDrag(event, piece)}
        onPointerMove={(event) => moveDrag(event, piece)}
        onPointerUp={(event) => endDrag(event, piece)}
      />
    );
  };

  const trayPieces = useMemo(() => state.pieces.filter((piece) => piece.zone === "tray"), [state.pieces]);
  const boardPieces = useMemo(() => state.pieces.filter((piece) => piece.zone === "board"), [state.pieces]);
  const showGhost = state.difficulty === "easy" || state.hintVisible;
  const showSlots = state.difficulty !== "hard";

  return (
    <div className={`game-workspace${state.phase === "paused" ? " is-paused" : ""}`}>
      <section className="tray-panel" aria-label="Puzzle piece tray">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Piece tray</span>
            <h2>Find the next fit</h2>
          </div>
          <span className="piece-badge">{unlockedCount} left</span>
        </div>
        <div className="tray-scroll" ref={trayScrollRef}>
          <div ref={traySurfaceRef} className={`tray-surface tray-${trayMode}`} style={{ width: trayWidth, height: trayHeight }}>
            {trayPieces.map((piece) => renderPiece(piece, { width: trayWidth, height: trayHeight }))}
          </div>
        </div>
        <div className="tray-actions">
          <button className={`button button-quiet${trayMode === "pile" ? " is-active" : ""}`} onClick={() => { soundEngine.playShuffle(); arrangeTray("pile"); }}>Pile scramble</button>
          <button className={`button button-quiet${trayMode === "spread" ? " is-active" : ""}`} onClick={() => { soundEngine.playShuffle(); arrangeTray("spread"); }}>Neat spread</button>
        </div>
      </section>

      <section className="board-panel" aria-label="Puzzle board">
        <div className="board-caption">
          <span className="eyebrow">Your board</span>
          {state.rotationEnabled && <span className="rotate-note">Tap a piece or press R to rotate</span>}
        </div>
        <div className="board-wrap" ref={boardWrapRef}>
          <div ref={boardRef} className="board-shell" style={{ aspectRatio: `${asset.width} / ${asset.height}`, width: fittedBoardWidth }}>
            <BoardGuides asset={asset} rows={state.rows} cols={state.cols} showGhost={showGhost} showSlots={showSlots} />
            <div className="piece-layer board-piece-layer">
              {boardPieces.map((piece) => renderPiece(piece, boardSize))}
            </div>
          </div>
        </div>
      </section>

      {state.phase === "paused" && (
        <div className="pause-cover" role="dialog" aria-modal="true" aria-label="Puzzle paused">
          <span className="eyebrow">No peeking</span>
          <h2>Puzzle paused</h2>
          <p>Your board and pieces are tucked away until you’re ready.</p>
          <button className="button button-primary" onClick={() => { soundEngine.playResume(); dispatch({ type: "RESUME" }); }}>Resume puzzle</button>
        </div>
      )}
    </div>
  );
}
