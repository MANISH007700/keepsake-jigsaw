"use client";

import { useEffect, useRef } from "react";
import { createPiecePath } from "@/lib/puzzle";
import type { ImageAsset, Piece, RasterPiece } from "@/lib/types";

export function ImageCanvas({ asset, className = "" }: { asset: ImageAsset; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = asset.width;
    canvas.height = asset.height;
    canvas.getContext("2d")?.drawImage(asset.canvas, 0, 0);
  }, [asset]);

  return <canvas ref={ref} className={className} aria-label={`Preview of ${asset.name}`} />;
}

export function BoardGuides({
  asset,
  rows,
  cols,
  showGhost,
  showSlots,
}: {
  asset: ImageAsset;
  rows: number;
  cols: number;
  showGhost: boolean;
  showSlots: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(dpr, dpr);
    context.clearRect(0, 0, rect.width, rect.height);
    if (showGhost) {
      context.globalAlpha = 0.18;
      context.drawImage(asset.canvas, 0, 0, rect.width, rect.height);
      context.globalAlpha = 1;
    }
    if (showSlots) {
      context.strokeStyle = "rgba(66, 55, 42, 0.28)";
      context.lineWidth = 1;
      context.setLineDash([4, 5]);
      for (let col = 1; col < cols; col += 1) {
        const x = (col * rect.width) / cols;
        context.beginPath();
        context.moveTo(x, 0);
        context.lineTo(x, rect.height);
        context.stroke();
      }
      for (let row = 1; row < rows; row += 1) {
        const y = (row * rect.height) / rows;
        context.beginPath();
        context.moveTo(0, y);
        context.lineTo(rect.width, y);
        context.stroke();
      }
    }
  }, [asset, cols, rows, showGhost, showSlots]);

  return <canvas ref={ref} className="board-guides" aria-hidden="true" />;
}

export function PieceCanvas({
  piece,
  raster,
  style,
  selected,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  piece: Piece;
  raster: RasterPiece;
  style: React.CSSProperties;
  selected: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLCanvasElement>) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = raster.canvas.width;
    canvas.height = raster.canvas.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(raster.canvas, 0, 0);
    const path = createPiecePath(raster.coreWidth, raster.coreHeight, raster.padding, piece.edges);
    context.save();
    context.clip(path);
    context.strokeStyle = piece.locked ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.62)";
    context.lineWidth = piece.locked ? 1 : Math.max(1.5, raster.coreWidth * 0.015);
    context.stroke(path);
    context.translate(1.2, 1.5);
    context.strokeStyle = piece.locked ? "rgba(30,24,18,.1)" : "rgba(21,25,32,.58)";
    context.stroke(path);
    context.restore();
  }, [piece.edges, piece.locked, raster]);

  return (
    <canvas
      ref={ref}
      className={`puzzle-piece${piece.locked ? " is-locked" : ""}${selected ? " is-selected" : ""}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label={`Puzzle piece ${piece.id + 1}${piece.locked ? ", placed" : ""}`}
      data-piece-id={piece.id}
    />
  );
}
