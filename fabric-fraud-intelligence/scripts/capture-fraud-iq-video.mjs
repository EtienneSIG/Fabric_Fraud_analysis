// Records the Fraud IQ agentic scenario run as an MP4 for the Remotion deck.
// Reuses the demo-mode app (auto sign-in, deterministic mock) like capture-screenshots.mjs.
//
// Usage (from fabric-fraud-intelligence/, playwright + ffmpeg on PATH):
//   1. npm run dev:demo                                   # serves http://localhost:5173
//   2. npm run capture:fraud-iq -- http://localhost:5173  # base URL optional
//        -> writes ../video/remotion-slidedeck/public/fraud-iq-run.mp4
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const baseUrl = (process.argv[2] || 'http://localhost:5173').replace(/\/+$/, '');
const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, '..', '..', 'video', 'remotion-slidedeck', 'public', 'fraud-iq-run.mp4');
const vdir = mkdtempSync(join(tmpdir(), 'fraudiq-vid-'));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  recordVideo: { dir: vdir, size: { width: 1600, height: 1000 } },
});
const page = await context.newPage();

// Warm up so the demo auto sign-in settles.
await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);

await page.goto(`${baseUrl}/fraud-iq`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// Launch the agentic scenario — the button label starts with ▶ in every locale.
const launch = page.getByRole('button', { name: /▶/ }).first();
await launch.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await launch.click();

// Let the four IQ columns reveal in sequence (the Live/Simulated pill lands at the end).
await page.waitForTimeout(7000);

await context.close(); // finalizes the .webm
await browser.close();

const webm = readdirSync(vdir).find((f) => f.endsWith('.webm'));
if (!webm) {
  rmSync(vdir, { recursive: true, force: true });
  throw new Error('Playwright produced no video file');
}
// Transcode to H.264 MP4 (Remotion-friendly), keep it silent and 1600x1000.
execFileSync(
  'ffmpeg',
  ['-y', '-i', join(vdir, webm), '-vf', 'scale=1600:1000:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', '-an', outFile],
  { stdio: 'inherit' },
);
rmSync(vdir, { recursive: true, force: true });
console.log('\u2713 wrote', outFile);
