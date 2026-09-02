# Fraud Intelligence — Remotion slide deck

A self-contained [Remotion](https://www.remotion.dev/) video deck that walks through the
Fraud Intelligence guided demo using the README screenshots, with a presenter cue
(« À dire ») on every slide.

## What's inside
- `src/slides.ts` — the demo flow (order, titles, captions, presenter cues) and timing.
- `src/Slide.tsx`, `src/Chrome.tsx`, `src/Deck.tsx` — the deck rendering (fade + Ken Burns + progress bar).
- `public/*.png` — the 9 product screenshots (copied from `docs/images/`).

## Prerequisites
- Node.js 18+ and npm.
- Remotion renders with headless Chrome (downloaded automatically on first render).

## Preview (interactive studio)
```bash
cd video/remotion-slidedeck
npm install
npm start          # opens Remotion Studio at http://localhost:3000
```

## Render the video
```bash
npm run build      # -> out/fraud-intelligence-demo.mp4  (1920x1080, ~62s)
```
Render a single still (e.g. a thumbnail):
```bash
npm run still      # -> out/frame.png
```

## Customise
- Edit the flow, captions or presenter cues in `src/slides.ts`.
- Change per-slide duration via `SLIDE_FRAMES` (default 6 s at 30 fps).
- Swap or add screenshots: drop the PNG in `public/` and add an entry in `slides`.

## Run the guided demo app locally (demo mode)
The screenshots come from the app running in **demo mode** — a deterministic mock dataset with an
auto sign-in (no MSAL, no Azure, no backend). From the SPA folder:
```powershell
cd ..\..\fabric-fraud-intelligence
npm install            # first time only
npm run dev:demo       # = vite --mode public  →  http://localhost:5173
```
- `--mode public` loads `.env.public` (`VITE_PUBLIC_DEMO=true`), so `PublicDemoAuthService`
  signs you in as a fixed analyst automatically.
- The in-app animations (Fraud IQ agentic loader, entity force-graph, Fraud Flow Sankey) all run
  on the mock data — nothing external is called.

> ⚠️ Run it **from `fabric-fraud-intelligence/`**, never the repo root. Also prefer `dev:demo`
> over `dev`: plain `npm run dev` runs a `rayfin env` prestep that can hang on a managed package
> mirror. `dev:demo` skips it.

## Refresh the screenshots (keep the deck in sync)
The `public/*.png` are copies of `docs/images/`. When a screen changes, regenerate them with the
reproducible Playwright capture (1600×1000 @2x → 3200×2000, matching the existing images):
```powershell
# 1. Start the demo app (shell A)
cd ..\..\fabric-fraud-intelligence
npm run dev:demo                                   # http://localhost:5173

# 2. Capture all 9 screens (shell B) — writes into ../docs/images/
cd ..\..\fabric-fraud-intelligence
npm run screenshots -- http://localhost:5173

# 3. Sync the refreshed PNGs into this deck (from the repo root)
Copy-Item docs\images\*.png video\remotion-slidedeck\public\ -Force
```
- The capture script lives at `fabric-fraud-intelligence/scripts/capture-screenshots.mjs`
  (routes + per-screen settle timings for the animated views).
- If you add / remove / reorder a screen, also update the flow in `src/slides.ts` **and** the
  README "Screens" section so the guided demo stays accurate.

> Downloadable & portable: the `public/` folder already contains the images, so the
> whole `remotion-slidedeck/` folder works on its own (just `npm install`).
