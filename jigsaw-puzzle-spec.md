# Keepsake - Full Product Spec

A privacy-first, browser-only jigsaw puzzle app.
Upload a loved photo, choose a piece count and difficulty, and rebuild the image by dragging scrambled pieces from the left tray onto the fixed board on the right.
Companion document: `jigsaw-puzzle-agent-prompt.md` (the build prompt). This spec goes deeper on design, ideas, and gameplay.

## 1. Vision and principles

- **The feeling**: solving a real puzzle of a photo you love, on a cozy table, without giving that photo to anyone.
- **Privacy is the product**: the image never leaves the browser. This is stated visibly in the UI and is a hard architectural constraint, not a policy promise.
- **Calm, tactile, satisfying**: generous whitespace, soft shadows, a physical "click" when a piece snaps. No ads, no accounts, no noise.
- **Zero friction**: from landing to solving in under 15 seconds. No signup, no settings required, sensible defaults everywhere.

## 2. How to play (user-facing copy, ships in the app's Help modal)

1. **Add your photo.** Drop a JPEG or PNG onto the upload area, or click to browse. Color or black-and-white, both work. Your photo stays in your browser only - it is never uploaded anywhere.
2. **Choose your challenge.** Pick how many pieces - a preset (12, 30, 50, 100) or any custom value from 8 to 150 with the slider - and a difficulty: Easy, Medium, or Hard.
3. **Scramble.** Your photo is cut into interlocking pieces and shuffled into the tray on the left.
4. **Rebuild it.** Drag pieces from the tray onto the board on the right. When a piece is close to its home, it snaps in and locks with a click.
5. **Need room?** Hit "Move pieces aside" any time to sweep unplaced pieces back into the tray.
6. **Stuck?** On Easy the board shows a faint ghost of your photo. On Medium and Hard, use the Hint button for a 2-second flash of the ghost.
7. **Race yourself.** Turn on the timer before you start. Pausing hides the board, so no peeking.
8. **Finish.** Place the last piece and enjoy the confetti. Play again with a fresh scramble, a new piece count, or a new photo.

Hard mode extra: pieces arrive rotated. Tap or click a held piece (or press R) to rotate it 90 degrees. A piece only snaps when position AND rotation are right.

## 3. Feature spec

### 3.1 Upload and image pipeline

- Drag-and-drop zone plus click-to-browse. Accept `image/jpeg` and `image/png` only.
- Reject others with a friendly message; explicitly detect HEIC and explain it is not supported.
- Max file size 15 MB. Downscale to max 2048 px on the long edge before cutting.
- Any aspect ratio is accepted; the board adapts to it. No forced crop in v1.
- Warn when the image is too small for the chosen piece count (a piece under ~40 px looks bad).
- All processing via in-memory canvas / ImageBitmap. Revoke object URLs on replace or reset.

### 3.2 Cutting engine

- Grid fit: choose rows x cols so rows * cols is closest to the requested count while pieces stay near-square for the image's aspect ratio. Show the actual count if it differs ("Closest fit: 28 pieces").
- True interlocking shapes: every interior edge is a bezier tab/socket pair; border edges are flat. Adjacent pieces share the exact same edge curve so they mate perfectly.
- Seeded RNG per puzzle for edge shapes (deterministic re-cut within a session).
- Each piece is rasterized once to an offscreen canvas (clip path + drawImage with bleed for tabs). Dragging reuses these canvases; nothing is re-clipped per frame.
- Edge treatment: subtle dark + light stroke along each piece outline so pieces read as physical even on flat or black-and-white images. The stroke softens once a piece locks, so completed regions look seamless.

### 3.3 Board and tray

- Desktop: tray on the left (scrollable overflow), fixed board on the right at final size.
- Board shows the puzzle frame; slot guidance depends on difficulty (see 3.4).
- Drag with the Pointer Events API (one code path for mouse and touch). One piece at a time; ignore secondary pointers.
- While dragging: slight scale-up, drop shadow, top z-index. On release within snap radius: animated settle, soft click sound (if sound on), piece locks and becomes non-interactive.
- Positions stored in board-relative coordinates so window resize and zoom never break placement.
- "Move pieces aside": arranges all unplaced pieces into a loose grid in the tray.
- "Scramble": re-shuffles unplaced pieces only; locked pieces never move.
- Mobile: board on top, tray as a horizontal scrolling strip below. Genuinely playable, not merely rendered.

### 3.4 Difficulty

| | Easy | Medium | Hard |
|---|---|---|---|
| Ghost image on board | Yes, faint | No | No |
| Slot outlines | Yes | Yes | No (frame only) |
| Piece rotation | No | No | Yes, 90-degree steps |
| Snap radius | Generous (~40% of piece) | Normal (~30%) | Tight (~20%), rotation must match |
| Hint button | Not needed | 2 s ghost flash (unlimited) | 2 s ghost flash (3 per game) |

### 3.5 Timer, progress, completion

- Optional timer, toggled before start. Pauses on tab hide (Page Visibility API) and on manual pause; pause overlay hides board and tray.
- Piece counter: "23 / 50 placed" plus a slim progress bar.
- Completion: confetti, final time, session-best time (memory only), actions: Re-scramble, New piece count, New photo.

## 4. Design spec

### 4.1 Mood and direction

Cozy-tactile: a quiet evening puzzle table, not a casual-games arcade.
Dark, warm ink-navy environment that makes the user's photo the hero; one warm coral accent for actions; cream board surface like matte card stock.

### 4.2 Design tokens

- Background: deep ink navy `#141A26`; panels `#1D2534`.
- Board surface: warm cream `#F3ECDD`; board frame: soft gold `#E8B64C` (thin).
- Accent (buttons, active states): coral `#FF7A59`. Success: teal `#3EC6A8`.
- Text: `#E9EDF4` primary, `#9AA5B5` muted.
- Type: Fraunces (or similar warm serif) for display headings; Inter / system sans for UI. UI text 14-15 px, generous line height.
- Radius: 12 px cards, 8 px controls. Shadows: soft, large-blur, low-opacity; stronger on a lifted (dragged) piece.

### 4.3 Motion

- Piece pickup: 120 ms scale to 1.05 + shadow grow. Snap: 160 ms ease-out settle + 1-frame flash of the outline. Wrong drop: nothing (no punishment animation).
- Completion: confetti burst ~2.5 s, then a calm results card. All motion respects `prefers-reduced-motion`.

### 4.4 States to design

Empty (pre-upload) with privacy note; image loading; cut preview; in-game; paused; completed; errors (wrong type, too big, too small, decode failure); mid-game "replace photo?" confirm.

## 5. Ideas and roadmap

**v1 (ship this):** everything in section 3.

**v1.1 (fast follows):**
- Optional pre-cut crop/rotate step.
- Sound pack toggle (snap click, completion chime).
- Piece-edge sorting helper: a button that groups border pieces at the front of the tray.
- Shareable "I solved a 100-piece puzzle in 12:34" text/image card that contains NO photo content unless the user explicitly includes a thumbnail.

**Later / exploratory:**
- Daily puzzle from a bundled royalty-free photo set (works fully offline, no privacy concern).
- Local multiplayer on one screen (two cursors, cooperative).
- Irregular whimsy piece shapes; 200+ piece mode with a single-canvas renderer.
- PWA install + full offline support.
- Accessibility mode: keyboard-only placement (select piece, arrow to slot, Enter to place).

**Explicit non-goals:** accounts, cloud saves, leaderboards, any server-side image handling.

## 6. Architecture and privacy

- Next.js (App Router) + TypeScript on Vercel; the puzzle experience is a fully client-side route. No image data in server components, actions, or API routes - such routes must not exist.
- Interactive layer: one absolutely-positioned canvas element per piece, moved with CSS transforms (compositor-friendly). Fine to ~150 pieces; single-canvas renderer is a later upgrade for larger counts.
- Single reducer/store for game state: pieces (id, slot, position, rotation, locked), status, difficulty, timer.
- No localStorage / IndexedDB / sessionStorage of image data. No third-party analytics on the puzzle route. Refresh loses the puzzle by design; the UI says so before start.
- Works offline after first load.

## 7. Edge cases

- Extreme panoramas: cap grid so pieces are never absurdly thin; warn on poor fit.
- Corrupt or truncated files: catch decode errors, friendly message.
- Resize/zoom mid-game: board-relative coordinates keep everything consistent.
- devicePixelRatio: render piece canvases at DPR so edges stay crisp on retina.
- Rapid drags, multi-touch, drag leaving the window: pointer capture, single active piece.

## 8. Acceptance criteria

1. A JPEG and a PNG (one color, one black-and-white) each load and cut correctly; DevTools network tab shows zero requests containing image data.
2. Reassembling all pieces programmatically reproduces the original image pixel-identically (proves the cut).
3. A 30-piece puzzle is completable end-to-end with mouse and with touch emulation on Easy, Medium, and Hard (including rotation on Hard).
4. Scramble never moves locked pieces; Move-aside clears the board area of unplaced pieces.
5. Timer pauses on tab hide and on pause; pause hides the board.
6. Unit tests pass for grid-fit, edge matching, snap detection, and scramble invariants.
7. 60 fps dragging on a mid-range laptop at 100 pieces; no layout shift during drag.

## 9. Decisions

- **App name: Keepsake.** Fits the loved-photos, private, cozy positioning.
- **Piece count control:** presets (12, 30, 50, 100) plus a slider for custom values 8-150. No free-form number input (arbitrary counts produce bad grids).
- **Hint budget:** unlimited on Medium; 3 per game on Hard, with the remaining count shown on the button and the button disabled at 0.
- **Hard mode:** 90-degree rotation is the only added challenge in v1 (tray side is not randomized). Revisit after measuring.
