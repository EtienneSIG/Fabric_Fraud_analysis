// Records the Fraud IQ agentic scenario run as an MP4 for the Remotion deck.
// Reuses the demo-mode app (auto sign-in, deterministic mock) like capture-screenshots.mjs.
// The left nav starts collapsed (wider content), the run scrolls down to the Foundry IQ + Web IQ
// answer, and the non-relevant intro (auto sign-in settle) is trimmed off via a measured offset.
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
// Start with the left nav collapsed so the four IQ columns get the full width.
await context.addInitScript(() => {
  try {
    localStorage.setItem('ffi.nav.collapsed', '1');
  } catch {
    /* ignore */
  }
});

const tStart = Date.now(); // ~ recording t=0
const page = await context.newPage();

await page.goto(`${baseUrl}/fraud-iq`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800); // auto sign-in + entrance settle (intro — trimmed off below)

// Smoothly scroll to a fraction of the page's scrollable height (robust to which element scrolls).
const scroll = async (frac, ms) => {
  await page.evaluate((f) => {
    const cands = [
      document.querySelector('main.ffi-scroll'),
      document.querySelector('main'),
      document.scrollingElement,
      document.documentElement,
      document.body,
    ];
    const el = cands.find((c) => c && c.scrollHeight - c.clientHeight > 40) || document.scrollingElement;
    const max = el.scrollHeight - el.clientHeight;
    el.scrollTo({ top: max * f, behavior: 'smooth' });
  }, frac);
  await page.waitForTimeout(ms);
};

// App is open — mark where the relevant footage begins (just before the launch click).
const launch = page.getByRole('button', { name: /▶/ }).first();
await launch.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
const tAction = Date.now();
await launch.click();

// Show the processing (grounding spinners), then scroll down to reveal Work/Fabric and the
// Foundry IQ + Web IQ answer at the bottom, holding on the response and its citations.
await page.waitForTimeout(1600); // grounding visible
await scroll(0.28, 1700); // Work IQ / Fabric IQ
await scroll(0.55, 1800); // columns keep revealing
await scroll(0.82, 2100); // Foundry IQ + Web IQ row
await page.waitForTimeout(1600); // hold on the answer
await scroll(1.0, 1700); // citations / bottom
await page.waitForTimeout(1400);
await scroll(0.35, 1300); // ease back up

await context.close(); // finalizes the .webm
await browser.close();

const webm = readdirSync(vdir).find((f) => f.endsWith('.webm'));
if (!webm) {
  rmSync(vdir, { recursive: true, force: true });
  throw new Error('Playwright produced no video file');
}
// Trim the intro (start ~0.6s before the launch click) and transcode to H.264 MP4.
const offset = Math.max(0, (tAction - tStart) / 1000 - 0.6);
execFileSync(
  'ffmpeg',
  ['-y', '-ss', offset.toFixed(2), '-i', join(vdir, webm), '-vf', 'scale=1600:1000:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', '-an', outFile],
  { stdio: 'inherit' },
);
rmSync(vdir, { recursive: true, force: true });
console.log('\u2713 wrote', outFile, `(trimmed ${offset.toFixed(1)}s intro)`);
