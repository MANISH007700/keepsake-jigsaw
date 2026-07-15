# Prompt for the coding assistant

Copy everything below the line into your coding assistant (Claude Code, Cursor, etc.).
The two companion files in this folder - `jigsaw-puzzle-spec.md` (full spec) and `jigsaw-puzzle-agent-prompt.md` (detailed build notes) - contain the complete detail; keep them in the repo and refer to them.

---

You are building a production-quality web app called **Keepsake**: a privacy-first jigsaw puzzle game that runs entirely in the browser. A user uploads a personal photo, picks a piece count and difficulty, and rebuilds the image by dragging scrambled interlocking pieces from a tray on the left onto a fixed board on the right.

The full specification is in `jigsaw-puzzle-spec.md` in this repo. Read it first and treat it as the source of truth. This prompt is your working brief.

## Non-negotiable constraint: privacy

The uploaded image must never leave the browser. No upload endpoint, no API route that receives image data, no localStorage/IndexedDB/sessionStorage of image bytes, no third-party analytics on the puzzle route. The image lives only in in-memory canvases/ImageBitmaps for the session; a refresh loses it by design. Revoke object URLs on reset. Show a visible "Your photo never leaves your browser" note in the UI. Treat any violation of this as a bug.

## Stack

- Next.js (App Router) + TypeScript + React, deployed on Vercel.
- The puzzle experience is a fully client-side route ("use client"). Do not create server actions or API routes that touch image data.
- Rendering: HTML Canvas. For the interactive layer use one absolutely-positioned canvas element per piece, moved with CSS transforms (compositor-friendly). This is fine to ~150 pieces; note in code that a single-canvas renderer is the upgrade path for larger counts.
- Game state in a single reducer/store: pieces (id, correct slot, current position, rotation, locked), plus status, difficulty, timer.
- Seeded RNG for edge generation so a puzzle re-cuts deterministically within a session.
- Zero backend dependencies; must work offline after first load.

## What to build (v1 scope)

1. **Upload**: drag-and-drop + click-to-browse. Accept only `image/jpeg` and `image/png`; detect HEIC and explain it is unsupported; reject others and files over 15 MB with friendly messages. Downscale to max 2048 px on the long edge before cutting.
1a. **Piece count control**: offer presets (12, 30, 50, 100) plus a slider for custom values from 8 to 150. Do not use a free-form number input - arbitrary counts produce bad grids.
2. **Cutting engine**: fit a rows x cols grid closest to the requested piece count while keeping pieces near-square for the image's aspect ratio; show the actual count when it differs ("Closest fit: 28 pieces"). Generate true interlocking pieces - every interior edge is a bezier tab/socket, border edges flat, adjacent pieces share the exact same edge curve. Rasterize each piece once to an offscreen canvas (clip + drawImage with bleed for tabs); never re-clip while dragging. Give each piece a subtle dark+light bevel stroke so it reads as physical even on flat/black-and-white images; soften the bevel once locked.
3. **Two-panel layout**: scrambled tray on the left (scrollable), fixed board on the right at final size. Board slot guidance depends on difficulty (below).
4. **Drag and snap**: Pointer Events API only (one path for mouse and touch), one piece at a time, ignore secondary pointers, use pointer capture. On release within the snap radius the piece animates into place, plays a soft click, and locks (non-interactive). Store positions in board-relative coordinates so resize/zoom never breaks placement. Render piece canvases at devicePixelRatio for crisp edges.
5. **Controls**: "Scramble" (re-shuffles unplaced pieces only, never moves locked ones; Fisher-Yates), "Move pieces aside" (sweeps all unplaced pieces into a loose tray grid so the board is clear).
6. **Difficulty**:
   - Easy: no rotation, board shows a faint ghost of the image + slot outlines, generous snap radius.
   - Medium: no rotation, slot outlines only (no ghost), normal snap radius, hint button flashes the ghost for 2 s (unlimited hints).
   - Hard: pieces randomly rotated in 90-degree steps (user rotates a held piece by tap/click or R key), board shows only the frame, tight snap radius, piece must match rotation to snap. Hints are limited to 3 per game; show the remaining count on the hint button and disable it at 0.
7. **Timer + progress**: optional timer toggled before start; pauses on tab hide (Page Visibility API) and on manual pause; pause overlay hides board and tray. Piece counter "23 / 50 placed" + progress bar.
8. **Completion**: confetti, final time, session-only best time, and actions: re-scramble, new piece count, new photo. Respect `prefers-reduced-motion`.
9. **Responsive**: desktop tray-left/board-right; mobile board-on-top with a horizontal scrolling tray strip. Must be genuinely playable on a phone.
10. **States**: design empty/pre-upload (with privacy note), loading, cut preview, in-game, paused, completed, and all error states (wrong type, HEIC, too big, resolution too low for the count, decode failure, mid-game "replace photo?" confirm).

Design direction, tokens, and copy are in the spec (cozy-tactile, dark warm environment, cream board, coral accent). Follow them.

## How to work

Build and verify in this order; do not move on until each step is verified:

1. Upload + validation + in-memory pipeline. Verify: JPEG and PNG load, oversized/wrong files rejected, and the DevTools network tab shows zero requests containing image data.
2. Grid-fit math + jigsaw edge generation + piece rasterization. Verify by reassembling all pieces at their correct slots and confirming the result is pixel-identical to the original - this proves the cut is correct.
3. Tray + board + drag + snap + lock. Verify: complete a 12-piece puzzle end to end with mouse and with touch emulation.
4. Difficulty modes, scramble, move-aside, Hard-mode rotation. Verify each by playing it.
5. Timer, pause, completion, play-again flows.
6. Polish: animations, mobile layout, empty/error states, 60 fps dragging.

Write unit tests for the pure logic: grid-fit algorithm, edge matching between neighbors, snap detection, and the invariant that scramble never moves locked pieces. Do an end-to-end pass on both desktop and a mobile viewport before calling it done.

## Definition of done

- Zero network requests carry image data (verified).
- Programmatic reassembly is pixel-identical to the original.
- A 30-piece puzzle is completable with mouse and touch on Easy, Medium, and Hard (including rotation).
- Scramble preserves locked pieces; move-aside clears the board.
- Timer pauses on tab hide and manual pause; pause hides the board.
- Unit tests pass; 60 fps drag at 100 pieces; no layout shift during drag.

## Out of scope for v1

Accounts, sharing, leaderboards, multiplayer, cross-session saving, irregular whimsy piece shapes, and anything server-side involving the image.

## Before you start

State your assumptions, flag anything ambiguous, and if a simpler approach exists say so. Then confirm your plan and proceed step by step, verifying as you go. Keep changes surgical and match a consistent code style.
