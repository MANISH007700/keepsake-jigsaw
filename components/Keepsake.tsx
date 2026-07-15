"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import GameBoard from "./GameBoard";
import { ImageCanvas } from "./CanvasViews";
import { ShieldIcon, SparkleIcon, UploadIcon } from "./Icons";
import { decodeImageFile, pieceResolutionWarning, validateImageFile } from "@/lib/image";
import { formatTime, gameReducer, initialGameState } from "@/lib/game";
import { createPieces, fitGrid, generateEdges, rasterizePieces } from "@/lib/puzzle";
import { hashSeed } from "@/lib/rng";
import type { Difficulty, ImageAsset, RasterPiece } from "@/lib/types";

const PRESETS = [12, 30, 50, 100];

function disposeCanvas(canvas: HTMLCanvasElement) {
  canvas.width = 0;
  canvas.height = 0;
}

function disposeRasters(rasters: Map<number, RasterPiece>) {
  rasters.forEach((piece) => disposeCanvas(piece.canvas));
}

export default function Keepsake() {
  const [state, dispatch] = useReducer(gameReducer, initialGameState);
  const [asset, setAsset] = useState<ImageAsset | null>(null);
  const [rasters, setRasters] = useState<Map<number, RasterPiece>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [draggingOver, setDraggingOver] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const completionRecordedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const seedRef = useRef(1);
  const clockAnchorRef = useRef(0);
  const elapsedRef = useRef(state.elapsedMs);
  const hintTimeoutRef = useRef<number | null>(null);

  const grid = useMemo(
    () => asset ? fitGrid(state.requestedCount, asset.width, asset.height) : null,
    [asset, state.requestedCount],
  );
  const resolutionWarning = asset && grid
    ? pieceResolutionWarning(asset.width, asset.height, grid.rows, grid.cols)
    : null;
  const placedCount = state.pieces.filter((piece) => piece.locked).length;
  const progress = state.pieces.length ? (placedCount / state.pieces.length) * 100 : 0;

  useEffect(() => {
    elapsedRef.current = state.elapsedMs;
  }, [state.elapsedMs]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (state.phase !== "playing" || !state.timerEnabled) return;
    clockAnchorRef.current = performance.now() - elapsedRef.current;
    const timer = window.setInterval(() => {
      dispatch({ type: "TICK", elapsedMs: performance.now() - clockAnchorRef.current });
    }, 250);
    return () => window.clearInterval(timer);
  }, [state.phase, state.timerEnabled]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden && state.phase === "playing") {
        const elapsedMs = state.timerEnabled ? performance.now() - clockAnchorRef.current : state.elapsedMs;
        dispatch({ type: "PAUSE", reason: "visibility", elapsedMs });
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [state.elapsedMs, state.phase, state.timerEnabled]);

  useEffect(() => {
    if (
      state.phase !== "playing" ||
      state.pieces.length === 0 ||
      placedCount !== state.pieces.length ||
      completionRecordedRef.current
    ) return;
    const elapsedMs = state.timerEnabled ? performance.now() - clockAnchorRef.current : state.elapsedMs;
    completionRecordedRef.current = true;
    dispatch({ type: "COMPLETE", elapsedMs });
  }, [placedCount, state.elapsedMs, state.phase, state.pieces.length, state.timerEnabled]);

  const loadFile = useCallback(async (file: File) => {
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    dispatch({ type: "LOADING" });
    try {
      const nextAsset = await decodeImageFile(file);
      setAsset((previous) => {
        if (previous) disposeCanvas(previous.canvas);
        return nextAsset;
      });
      setRasters(new Map());
      seedRef.current = hashSeed(`${file.name}:${file.size}:${nextAsset.width}x${nextAsset.height}`);
      dispatch({ type: "IMAGE_READY" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not read that photo. Please try another JPEG or PNG.");
      dispatch({ type: "RESET" });
    }
  }, []);

  const askForPhoto = () => {
    if (state.phase === "playing" || state.phase === "paused") {
      if (!window.confirm("Replace this photo? Your current puzzle progress will be lost.")) return;
    }
    inputRef.current?.click();
  };

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void loadFile(file);
  };

  const startPuzzle = async () => {
    if (!asset || !grid) return;
    setError(null);
    dispatch({ type: "CUTTING" });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    try {
      const edges = generateEdges(grid.rows, grid.cols, seedRef.current);
      const nextRasters = rasterizePieces(asset.canvas, grid.rows, grid.cols, edges);
      const pieces = createPieces(grid.rows, grid.cols, edges, state.difficulty, seedRef.current);
      setRasters(new Map(nextRasters.map((piece) => [piece.id, piece])));
      completionRecordedRef.current = false;
      setSessionVersion((value) => value + 1);
      clockAnchorRef.current = performance.now();
      dispatch({ type: "START", rows: grid.rows, cols: grid.cols, pieces });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The puzzle could not be cut. Try a smaller piece count.");
      dispatch({ type: "IMAGE_READY" });
    }
  };

  const pause = () => {
    const elapsedMs = state.timerEnabled ? performance.now() - clockAnchorRef.current : state.elapsedMs;
    dispatch({ type: "PAUSE", reason: "manual", elapsedMs });
  };

  const showHint = () => {
    dispatch({ type: "SHOW_HINT" });
    if (hintTimeoutRef.current) window.clearTimeout(hintTimeoutRef.current);
    hintTimeoutRef.current = window.setTimeout(() => dispatch({ type: "HIDE_HINT" }), 2000);
  };

  const resetToEmpty = () => {
    if ((state.phase === "playing" || state.phase === "paused") &&
      !window.confirm("Choose a new photo? Your current puzzle progress will be lost.")) return;
    disposeRasters(rasters);
    if (asset) disposeCanvas(asset.canvas);
    setAsset(null);
    setRasters(new Map());
    setError(null);
    dispatch({ type: "RESET" });
  };

  const replay = () => {
    if (!grid || !state.pieces.length) return;
    const pieces = createPieces(grid.rows, grid.cols, state.pieces.map((piece) => piece.edges), state.difficulty, seedRef.current ^ sessionVersion);
    completionRecordedRef.current = false;
    setSessionVersion((value) => value + 1);
    clockAnchorRef.current = performance.now();
    dispatch({ type: "REPLAY", pieces });
  };

  const headerGame = ["playing", "paused", "complete"].includes(state.phase);

  return (
    <main className="app-shell">
      <header className="site-header">
        <button className="wordmark" onClick={resetToEmpty} aria-label="Keepsake home">
          <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>
          <span>Keepsake</span>
        </button>
        <div className="header-actions">
          <span className="privacy-pill"><ShieldIcon /> Your photo stays private</span>
          <button className="text-button" onClick={() => setHelpOpen(true)}>How to play</button>
        </div>
      </header>

      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/jpeg,image/png,.jpg,.jpeg,.png"
        onChange={(event) => {
          handleFiles(event.currentTarget.files);
          event.currentTarget.value = "";
        }}
      />

      {!headerGame && (
        <section className="landing">
          <div className="hero-copy">
            <span className="eyebrow eyebrow-accent">A little time with a photo you love</span>
            <h1>Piece together<br /><em>a memory.</em></h1>
            <p>Turn any favorite photo into a tactile jigsaw puzzle—quietly, privately, right here in your browser.</p>
            <div className="privacy-callout">
              <ShieldIcon />
              <div><strong>Your photo never leaves your browser.</strong><span>No uploads, no accounts, no copies kept. Refreshing clears it by design.</span></div>
            </div>
          </div>

          <div className="setup-card">
            {state.phase === "empty" || state.phase === "loading" ? (
              <div
                className={`upload-zone${draggingOver ? " is-over" : ""}`}
                onDragEnter={(event) => { event.preventDefault(); setDraggingOver(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDraggingOver(false); }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDraggingOver(false);
                  handleFiles(event.dataTransfer.files);
                }}
              >
                {state.phase === "loading" ? (
                  <><span className="loader" /><h2>Reading your photo…</h2><p>It stays on this device while we prepare it.</p></>
                ) : (
                  <>
                    <span className="upload-icon"><UploadIcon /></span>
                    <h2>Bring a photo</h2>
                    <p>Drop it here, or choose one from your device.</p>
                    <button className="button button-primary" onClick={() => inputRef.current?.click()}>Choose a photo</button>
                    <small>JPEG or PNG · up to 15 MB</small>
                  </>
                )}
              </div>
            ) : asset && grid ? (
              <div className="preview-setup">
                <div className="preview-frame"><ImageCanvas asset={asset} className="preview-canvas" /></div>
                <div className="photo-meta"><div><strong>{asset.name}</strong><span>{asset.width} × {asset.height}px</span></div><button className="text-button" onClick={askForPhoto}>Replace</button></div>
                <PieceCountControl value={state.requestedCount} onChange={(count) => dispatch({ type: "SET_COUNT", count })} />
                <DifficultyControl value={state.difficulty} onChange={(difficulty) => dispatch({ type: "SET_DIFFICULTY", difficulty })} />
                <label className="timer-toggle"><span><strong>Race the clock</strong><small>Timer pauses when you do</small></span><input type="checkbox" checked={state.timerEnabled} onChange={(event) => dispatch({ type: "SET_TIMER", enabled: event.target.checked })} /><i /></label>
                {grid.count !== state.requestedCount && <p className="fit-note">Closest fit: <strong>{grid.count} pieces</strong> ({grid.cols} × {grid.rows})</p>}
                {resolutionWarning && <p className="warning-note">{resolutionWarning}</p>}
                <button className="button button-primary button-large" onClick={() => void startPuzzle()} disabled={state.phase === "cutting"}>
                  {state.phase === "cutting" ? <><span className="mini-loader" /> Cutting your puzzle…</> : <><SparkleIcon /> Make my puzzle</>}
                </button>
              </div>
            ) : null}
            {error && <div className="error-message" role="alert">{error}</div>}
          </div>
        </section>
      )}

      {headerGame && asset && (
        <section className="game-page">
          <div className="game-toolbar">
            <div className="game-progress-copy">
              <span className="eyebrow">{state.difficulty} · {state.pieces.length} pieces</span>
              <strong>{placedCount} / {state.pieces.length} placed</strong>
            </div>
            <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={state.pieces.length} aria-valuenow={placedCount}><span style={{ width: `${progress}%` }} /></div>
            <div className="toolbar-actions">
              {state.timerEnabled && <span className="timer-display" aria-label={`Elapsed time ${formatTime(state.elapsedMs)}`}>{formatTime(state.elapsedMs)}</span>}
              {state.difficulty !== "easy" && (
                <button className="button button-quiet" onClick={showHint} disabled={state.difficulty === "hard" && state.hintsRemaining === 0}>
                  Hint{state.difficulty === "hard" ? ` · ${state.hintsRemaining}` : ""}
                </button>
              )}
              {state.difficulty === "hard" && state.selectedPieceId !== null && (
                <button className="button button-quiet" onClick={() => dispatch({ type: "ROTATE", id: state.selectedPieceId! })}>Rotate ↻</button>
              )}
              {state.phase === "playing" && <button className="button button-quiet" onClick={pause}>Pause</button>}
              <button className="button button-quiet" onClick={resetToEmpty}>New photo</button>
            </div>
          </div>
          <GameBoard key={sessionVersion} state={state} asset={asset} rasters={rasters} dispatch={dispatch} sessionVersion={sessionVersion} />

          {state.phase === "complete" && (
            <CompletionCard
              elapsedMs={state.elapsedMs}
              timerEnabled={state.timerEnabled}
              bestTime={state.bestTime}
              pieceCount={state.pieces.length}
              onReplay={replay}
              onNewCount={() => dispatch({ type: "BACK_TO_PREVIEW" })}
              onNewPhoto={resetToEmpty}
            />
          )}
        </section>
      )}

      <footer><span>Made for quiet moments.</span><span><ShieldIcon /> Private by design · works offline after your first visit</span></footer>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
    </main>
  );
}

function PieceCountControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <fieldset className="control-group">
      <legend><span>Piece count</span><strong>{value}</strong></legend>
      <div className="preset-row">
        {PRESETS.map((preset) => <button key={preset} type="button" className={value === preset ? "is-active" : ""} onClick={() => onChange(preset)}>{preset}</button>)}
      </div>
      <input className="range" type="range" min={8} max={150} value={value} onChange={(event) => onChange(Number(event.target.value))} aria-label="Custom piece count" />
      <div className="range-labels"><span>8 · gentle</span><span>150 · ambitious</span></div>
    </fieldset>
  );
}

function DifficultyControl({ value, onChange }: { value: Difficulty; onChange: (value: Difficulty) => void }) {
  const descriptions: Record<Difficulty, string> = { easy: "Ghost + wide snap", medium: "Outlines + hints", hard: "Rotation + 3 hints" };
  return (
    <fieldset className="control-group">
      <legend><span>Difficulty</span></legend>
      <div className="difficulty-row">
        {(["easy", "medium", "hard"] as Difficulty[]).map((level) => (
          <button key={level} type="button" className={value === level ? "is-active" : ""} onClick={() => onChange(level)}><strong>{level}</strong><small>{descriptions[level]}</small></button>
        ))}
      </div>
    </fieldset>
  );
}

function CompletionCard({ elapsedMs, timerEnabled, bestTime, pieceCount, onReplay, onNewCount, onNewPhoto }: {
  elapsedMs: number; timerEnabled: boolean; bestTime: number | null; pieceCount: number;
  onReplay: () => void; onNewCount: () => void; onNewPhoto: () => void;
}) {
  return (
    <div className="completion-backdrop" role="dialog" aria-modal="true" aria-label="Puzzle complete">
      <div className="confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, index) => <i key={index} style={{ "--i": index } as React.CSSProperties} />)}</div>
      <div className="completion-card">
        <span className="completion-mark"><SparkleIcon /></span>
        <span className="eyebrow eyebrow-accent">Memory restored</span>
        <h2>Beautifully done.</h2>
        <p>You found a home for all {pieceCount} pieces.</p>
        {timerEnabled && <div className="result-time"><span>Final time<strong>{formatTime(elapsedMs)}</strong></span>{bestTime !== null && <span>Session best<strong>{formatTime(bestTime)}</strong></span>}</div>}
        <div className="completion-actions"><button className="button button-primary" onClick={onReplay}>Re-scramble</button><button className="button button-quiet" onClick={onNewCount}>New piece count</button><button className="text-button" onClick={onNewPhoto}>Choose a new photo</button></div>
      </div>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="help-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="help-card">
        <button className="modal-close" onClick={onClose} aria-label="Close help">×</button>
        <span className="eyebrow eyebrow-accent">The gentle guide</span>
        <h2 id="help-title">How to play</h2>
        <ol>
          <li><strong>Add your photo.</strong><span>Choose a JPEG or PNG. It stays in this browser only.</span></li>
          <li><strong>Choose your challenge.</strong><span>Pick 8–150 pieces, a difficulty, and whether to time yourself.</span></li>
          <li><strong>Rebuild it.</strong><span>Drag pieces from the tray. A close match clicks into place.</span></li>
          <li><strong>Make room.</strong><span>Move pieces aside clears the board; hints briefly reveal the photo.</span></li>
          <li><strong>Hard mode.</strong><span>Tap a selected piece or press R to rotate it 90 degrees.</span></li>
        </ol>
        <button className="button button-primary" onClick={onClose}>Let’s make a puzzle</button>
      </div>
    </div>
  );
}
