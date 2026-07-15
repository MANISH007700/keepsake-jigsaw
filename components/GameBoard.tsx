"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BoardGuides, PieceCanvas } from "./CanvasViews";
import { shouldSnap } from "@/lib/puzzle";
import { shuffle } from "@/lib/rng";
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

function playSnap() {
  try {
    const AudioContextClass = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(680, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(390, context.currentTime + 0.055);
    gain.gain.setValueAtTime(0.045, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.07);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.075);
    oscillator.addEventListener("ended", () => void context.close());
  } catch {
    // Sound is a progressive enhancement; browsers may block it.
  }
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
  const [isMobile, setIsMobile] = useState(false);
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
  const desktopColumns = Math.max(1, Math.floor((trayViewport.width - gap) / Math.max(1, cellWidth + gap)));
  const trayColumns = isMobile ? Math.max(1, Math.ceil(unlockedCount / 2)) : desktopColumns;
  const trayRows = isMobile ? Math.min(2, Math.max(1, unlockedCount)) : Math.max(1, Math.ceil(unlockedCount / trayColumns));
  const trayWidth = isMobile
    ? Math.max(trayViewport.width, trayColumns * (cellWidth + gap) + gap)
    : Math.max(1, trayViewport.width);
  const trayHeight = isMobile
    ? Math.max(132, trayRows * (cellHeight + gap) + gap)
    : Math.max(trayViewport.height, trayRows * (cellHeight + gap) + gap);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const arrangeAside = useCallback(
    (randomize: boolean) => {
      if (!trayWidth || !trayHeight || !cellWidth || !cellHeight) return;
      const unlocked = state.pieces.filter((piece) => !piece.locked);
      const ordered = randomize ? shuffle(unlocked) : unlocked.sort((a, b) => a.id - b.id);
      const positions = new Map<number, Point>();
      ordered.forEach((piece, index) => {
        const column = isMobile ? Math.floor(index / 2) : index % trayColumns;
        const row = isMobile ? index % 2 : Math.floor(index / trayColumns);
        positions.set(piece.id, {
          x: (gap + column * (cellWidth + gap)) / trayWidth,
          y: (gap + row * (cellHeight + gap)) / trayHeight,
        });
      });
      dispatch({ type: "ARRANGE", positions });
    }, [cellHeight, cellWidth, dispatch, isMobile, state.pieces, trayColumns, trayHeight, trayWidth]);

  useEffect(() => {
    if (arrangedVersion.current === sessionVersion || !boardSize.width || !trayViewport.width) return;
    arrangedVersion.current = sessionVersion;
    arrangeAside(true);
  }, [arrangeAside, boardSize.width, sessionVersion, trayViewport.width]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "r" || state.selectedPieceId === null || state.phase !== "playing") return;
      dispatch({ type: "ROTATE", id: state.selectedPieceId });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dispatch, state.phase, state.selectedPieceId]);

  const beginDrag = (event: React.PointerEvent<HTMLCanvasElement>, piece: Piece) => {
    if (piece.locked || state.phase !== "playing" || !event.isPrimary || event.button !== 0 || dragRef.current) return;
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const raster = rasters.get(piece.id);
    if (!raster) return;
    const padRatioX = raster.padding / raster.canvas.width;
    const padRatioY = raster.padding / raster.canvas.height;
    const padX = rect.width * padRatioX;
    const padY = rect.height * padRatioY;
    const coreLeft = rect.left + padX;
    const coreTop = rect.top + padY;
    element.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: piece.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetCoreX: event.clientX - coreLeft,
      offsetCoreY: event.clientY - coreTop,
      originalCss: element.style.cssText,
      element,
      moved: false,
    };
    element.style.position = "fixed";
    element.style.left = "0";
    element.style.top = "0";
    element.style.width = `${rect.width}px`;
    element.style.height = `${rect.height}px`;
    element.style.zIndex = "1000";
    element.style.transform = `translate3d(${rect.left}px, ${rect.top}px, 0) rotate(${piece.rotation}deg) scale(1.055)`;
    dispatch({ type: "SELECT", id: piece.id });
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

    if (!drag.moved && state.difficulty === "hard") {
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
      if (shouldSnap(pixelPosition, target, Math.min(cellWidth, cellHeight), piece.rotation, state.difficulty)) {
        dispatch({ type: "MOVE", id: piece.id, zone: "board", position: { x: piece.col / state.cols, y: piece.row / state.rows } });
        dispatch({ type: "LOCK", id: piece.id });
        trackAnalytics({ event: "piece_placed" });
        playSnap();
        return;
      }
      position = {
        x: clamp(pixelPosition.x / boardRect.width, -0.12, 1 - 0.25 / state.cols),
        y: clamp(pixelPosition.y / boardRect.height, -0.12, 1 - 0.25 / state.rows),
      };
    } else {
      position = {
        x: clamp((coreLeft - trayRect.left) / trayRect.width, 0, Math.max(0, 1 - cellWidth / trayRect.width)),
        y: clamp((coreTop - trayRect.top) / trayRect.height, 0, Math.max(0, 1 - cellHeight / trayRect.height)),
      };
    }
    dispatch({ type: "MOVE", id: piece.id, zone, position });
  };

  const renderPiece = (piece: Piece, container: Size) => {
    const raster = rasters.get(piece.id);
    if (!raster) return null;
    const coreW = cellWidth;
    const coreH = cellHeight;
    const visualWidth = coreW + displayPadding * 2;
    const visualHeight = coreH + displayPadding * 2;
    const left = piece.position.x * container.width - displayPadding;
    const top = piece.position.y * container.height - displayPadding;
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
          <div ref={traySurfaceRef} className="tray-surface" style={{ width: trayWidth, height: trayHeight }}>
            {trayPieces.map((piece) => renderPiece(piece, { width: trayWidth, height: trayHeight }))}
          </div>
        </div>
        <div className="tray-actions">
          <button className="button button-quiet" onClick={() => dispatch({ type: "SCRAMBLE" })}>Scramble</button>
          <button className="button button-quiet" onClick={() => arrangeAside(false)}>Move pieces aside</button>
        </div>
      </section>

      <section className="board-panel" aria-label="Puzzle board">
        <div className="board-caption">
          <span className="eyebrow">Your board</span>
          {state.difficulty === "hard" && <span className="rotate-note">Tap a piece or press R to rotate</span>}
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
          <button className="button button-primary" onClick={() => dispatch({ type: "RESUME" })}>Resume puzzle</button>
        </div>
      )}
    </div>
  );
}
