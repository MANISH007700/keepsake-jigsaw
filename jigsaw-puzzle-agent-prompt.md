# Build Prompt: Privacy-First Jigsaw Puzzle Web App

## What we are building

A browser-based jigsaw puzzle app where a user uploads any personal photo, chooses a piece count, and solves the puzzle by dragging scrambled pieces from a tray onto a fixed board template.
The entire experience runs client-side.
The uploaded image never leaves the user's browser and is never stored on any server.
Deploy target is Vercel as a static/SSR-lite Next.js app, but no API routes should ever receive image data.

## Core user flow

1. User lands on the app and sees an upload zone ("Drop your photo here or click to browse").
2. User uploads a JPEG or PNG (color or black-and-white, both must work identically).
3. User picks a piece count from presets (e.g. 12, 30, 50, 100) or a custom number.
4. User picks a difficulty: Easy, Medium, or Hard.
5. User optionally enables a timer.
6. App cuts the image into interlocking jigsaw pieces and scrambles them into the tray on the LEFT side of the screen.
7. The RIGHT side shows a fixed board: the puzzle outline at final size, with slot positions matching the piece grid.
8. User drags pieces one by one from the left tray onto the right board.
9. When a piece is dropped near its correct slot (within snap tolerance), it snaps into place, locks, and plays a subtle click/settle animation.
10. When all pieces are placed, show a completion celebration (confetti or similar), final time, and options: "Play again (re-scramble)", "New piece count", "New photo".

There must also be a "Move all pieces aside" action: one click that sweeps every unplaced piece into the tray area so the board is clear, letting the user pull pieces back one by one.

## Hard requirements

### Privacy (non-negotiable)

- The image must exist only in browser memory for the current session (object URLs / in-memory canvases / ImageBitmap).
- No upload to any server, no API route that accepts the image, no localStorage/IndexedDB/sessionStorage persistence of image data, no third-party analytics that could capture it.
- Refreshing or closing the tab loses the puzzle. That is acceptable and by design.
- Revoke object URLs and release canvases/ImageBitmaps when a new image is loaded or the session resets.
- State a visible privacy note in the UI: "Your photo never leaves your browser."

### Image handling

- Accept JPEG and PNG via file picker and drag-and-drop. Validate MIME type and reject others with a friendly message (explicitly mention HEIC is not supported if detected).
- Enforce a max file size (suggest 15 MB) with a clear error message.
- Downscale very large images to a working resolution (suggest max 2048px on the long edge) before cutting, to keep memory and performance sane on mobile.
- Handle any aspect ratio. Do not crop by default; fit the board to the image's aspect ratio. Optionally offer a simple crop step before cutting (nice-to-have, not required for v1).
- Grayscale and color images must both render correctly (no special handling should be needed, but test both).

### Piece generation (the heart of the app)

- Cut the image into a grid of rows x cols chosen so that rows * cols is as close as possible to the requested piece count while keeping pieces roughly square given the image aspect ratio.
  Example: a 3:2 landscape photo at "30 pieces" should become something like 7x4 or 6x5, whichever gives more square-ish pieces.
  Show the user the actual count if it differs from the requested one ("Closest fit: 28 pieces").
- Pieces must be true interlocking jigsaw shapes, not plain rectangles: each interior edge is a bezier curve with a tab (knob) on one side and a matching blank (socket) on the other. Border pieces have flat outer edges.
- Generate edge shapes once per puzzle with a seeded random generator so adjacent pieces always match perfectly.
- Render each piece to its own offscreen canvas once at cut time (path clip + drawImage with bleed for the tabs), then reuse those canvases for all dragging. Never re-clip on every frame.
- Each piece needs a subtle inner shadow or bevel stroke along its outline so pieces read as physical pieces even on low-contrast images (important for black-and-white photos and large flat areas like sky).

### Layout

- Two-panel layout on desktop: left panel is the scramble tray (scrollable if needed), right panel is the fixed board.
- The board on the right shows the puzzle frame at final size with the grid of target slots.
- Board slot guidance depends on difficulty (see below).
- Pieces are dragged with pointer events (must work with mouse AND touch; use Pointer Events API, not separate mouse/touch code paths).
- While dragging, the piece lifts (slight scale-up + drop shadow) and renders above everything else.
- Snap: when released within the snap radius of its correct slot, the piece animates into place and locks (cannot be picked up again). Otherwise it stays where dropped.
- Placed pieces visually merge into the growing image (remove or soften their bevel once locked, so the completed regions look seamless).
- Responsive: on narrow/mobile screens, stack tray below or above the board, or make the tray a horizontal strip. Solving must be genuinely playable on a phone, not just "it renders".

### Difficulty modes

Difficulty affects both the scramble and the assistance level:

- Easy:
  - Pieces scrambled in the tray, all upright (no rotation).
  - Board shows a faint ghost of the full image plus slot outlines.
  - Generous snap radius.
- Medium:
  - Pieces upright, no rotation.
  - Board shows only the empty frame and grid slot outlines, no ghost image.
  - Normal snap radius.
- Hard:
  - Pieces are randomly rotated in 90-degree increments; user rotates a piece by tapping/clicking it while selected (or a rotate key/button).
  - Board shows only the outer frame, no grid lines, no ghost.
  - Tight snap radius; piece must also be in correct rotation to snap.

Scramble itself should be genuinely random (Fisher-Yates over tray positions) and the "Scramble" button can be pressed again at any time to re-shuffle all UNPLACED pieces without disturbing locked ones.

### Timer and extras

- Optional timer: user can toggle it on before starting; shows elapsed time; pauses when the tab is hidden (Page Visibility API) and when the user hits pause.
- Pause overlay hides the board and tray (so the timer cannot be gamed by studying while paused).
- Piece counter: "23 / 50 placed".
- Optional nice-to-haves if time permits: hint button (briefly flashes the ghost image on Medium/Hard), sound toggle for the snap click, best-time display kept in memory only for the session.

## Tech stack and architecture guidance

- Next.js (App Router) + TypeScript + React, deployed on Vercel. The puzzle page must be fully client-side ("use client"); no image data in server components, server actions, or API routes.
- Rendering: HTML Canvas for piece rasterization; for the interactive layer, either
  (a) each piece as its own absolutely-positioned canvas/img element moved with CSS transforms, or
  (b) a single full-scene canvas with a render loop.
  Option (a) is simpler and fine up to ~150 pieces; pick it for v1 and document the decision.
- Use CSS transforms (translate/rotate) for dragging, never top/left layout properties, to stay on the compositor.
- Keep puzzle state in a single reducer/store (pieces array with id, correct slot, current position, rotation, placed flag; plus game status, timer, difficulty).
- Seeded RNG for edge generation so a puzzle could be re-cut deterministically within the session.
- Zero backend dependencies. The app must work with the network disconnected after first load.

## Edge cases to handle

- Extreme aspect ratios (panoramas): cap the grid so pieces do not become absurdly thin; warn the user if the image is a poor fit.
- Tiny images: warn if resolution is too low for the chosen piece count (e.g. each piece would be under ~40px).
- Corrupt/unreadable files: catch decode errors and show a friendly message.
- User uploads a new image mid-game: confirm before discarding current progress.
- Browser zoom and window resize mid-game: board and pieces must rescale consistently without breaking placed positions (store positions in board-relative coordinates, not screen pixels).
- Very fast repeated drags and multi-touch: only one piece may be dragged at a time; ignore secondary pointers.

## Quality bar and verification

Work in this order, verifying each step before moving on:

1. Image upload + validation + in-memory pipeline. Verify: JPEG and PNG load, oversized files rejected, nothing hits the network (check DevTools network tab).
2. Grid math + jigsaw edge generation + piece rasterization. Verify: render all pieces reassembled at their correct slots; the result must be pixel-identical to the original (this proves the cut is correct).
3. Tray + board layout + drag + snap + lock. Verify: complete a 12-piece puzzle end to end with mouse and with touch emulation.
4. Difficulty modes, scramble, move-aside, rotation on Hard. Verify each mode by playing it.
5. Timer, pause, completion state, play-again flows.
6. Polish pass: animations, mobile layout, empty states, error states.

Include unit tests for the pure logic (grid-fit algorithm, edge matching between neighbors, snap detection, scramble not moving locked pieces).
Do an end-to-end pass on both desktop and a mobile viewport before calling it done.
Be picky about visual quality: piece edges must be crisp (account for devicePixelRatio), drags must be 60fps smooth, and snapping must feel satisfying.

## Out of scope for v1

- Accounts, sharing, leaderboards, multiplayer.
- Saving puzzles across sessions (conflicts with the privacy model).
- Irregular/whimsy piece shapes beyond the standard tab/blank grid.
- Server-side anything involving the image.
