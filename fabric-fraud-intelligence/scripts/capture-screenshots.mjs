// Reproducible demo-screenshot capture for the README + Remotion deck.
// Captures every guided-demo screen at 1600x1000 @2x (→ 3200x2000, matching docs/images/*.png).
//
// Usage (from fabric-fraud-intelligence/, where playwright is installed):
//   1. Start the app in demo mode (auto sign-in):
//        npm run dev:demo                                   # serves on http://localhost:5173
//   2. In another shell, run:
//        npm run screenshots -- http://localhost:5173       # base URL optional (default :5173)
//   3. Sync into the Remotion deck (from repo root):
//        Copy-Item docs/images/*.png video/remotion-slidedeck/public/ -Force
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const baseUrl = (process.argv[2] || 'http://localhost:5173').replace(/\/+$/, '');
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'images');

// wait = extra settle time (ms) for entrance / D3 / force-graph animations before the shot.
const screens = [
  { file: 'dashboard.png', path: '/', wait: 1500 },
  { file: 'alert-queue.png', path: '/alerts', wait: 1500 },
  { file: 'case-detail.png', path: '/cases/CASE-001', wait: 1800 },
  { file: 'fraud-flow.png', path: '/flow', wait: 2600 },
  { file: 'entity-graph.png', path: '/graph', wait: 3200 },
  { file: 'aml-copilot.png', path: '/aml', wait: 1800 },
  { file: 'claims-fraud.png', path: '/claims', wait: 1800 },
  { file: 'fraud-iq.png', path: '/fraud-iq', wait: 1800 },
  { file: 'settings.png', path: '/settings', wait: 1500 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });

// Warm up so the demo auto sign-in settles before the first capture.
await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

for (const s of screens) {
  await page.goto(`${baseUrl}${s.path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(s.wait);
  await page.screenshot({ path: join(outDir, s.file) });
  console.log('\u2713', s.file);
}

await browser.close();
