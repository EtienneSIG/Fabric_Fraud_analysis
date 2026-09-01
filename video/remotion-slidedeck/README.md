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

## Refresh the screenshots
The images are copies of `docs/images/`. To re-sync after regenerating them:
```powershell
Copy-Item ..\..\docs\images\*.png .\public\ -Force
```

> Downloadable & portable: the `public/` folder already contains the images, so the
> whole `remotion-slidedeck/` folder works on its own (just `npm install`).
