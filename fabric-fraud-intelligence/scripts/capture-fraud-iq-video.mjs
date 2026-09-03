// Records the Fraud IQ agentic scenario run as an MP4 for the Remotion deck.
//
// Two modes:
//   • mock (default)  — demo app (auto sign-in, deterministic mock). Fast, no real latency.
//   • --live          — hits the REAL Foundry agent (Foundry IQ + Web IQ). Waits for the real
//                        answer, then time-lapses (speeds up) the grounding wait so the clip is
//                        short while the answer plays at normal speed.
//
// The left nav starts collapsed (wider content), the run scrolls to the Foundry IQ + Web IQ answer,
// and the non-relevant intro is trimmed off.
//
// LIVE needs a signed-in MSAL session (interactive) that automation can reuse silently, so it uses a
// PERSISTENT browser profile. Sign in ONCE with the demo-tenant analyst, then capture reuses it:
//   1. npm run capture:fraud-iq -- --login https://mild-falls-763438f7b8-swedencentral.webapp.fabricapps.net
//      (a real browser opens — complete the Microsoft sign-in + consent, then it closes)
//   2. npm run capture:fraud-iq -- --live  https://mild-falls-763438f7b8-swedencentral.webapp.fabricapps.net
//      Optional Foundry wiring via env (else set it once in Settings › Agents in the --login step):
//      FFI_FOUNDRY_ENDPOINT / FFI_FOUNDRY_TENANT / FFI_FOUNDRY_CLIENT / FFI_FOUNDRY_AGENT
//   Speed of the time-lapse: --speed 6 (default).
//
// Mock (from fabric-fraud-intelligence/, playwright + ffmpeg on PATH):
//   npm run dev:demo                                      # http://localhost:5173
//   npm run capture:fraud-iq -- http://localhost:5173     # -> public/fraud-iq-run.mp4
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(name);
const flagValue = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const LOGIN = hasFlag('--login');
const LIVE = hasFlag('--live') || LOGIN;
const SPEED = Math.max(1, Number(flagValue('--speed', '6')) || 6);
const baseUrl = (argv.find((a) => /^https?:\/\//.test(a)) || 'http://localhost:5173').replace(/\/+$/, '');

const here = dirname(fileURLToPath(import.meta.url));
const outFile = join(here, '..', '..', 'video', 'remotion-slidedeck', 'public', 'fraud-iq-run.mp4');
const profileDir = flagValue('--profile', join(here, '..', '.cache', 'fraudiq-capture-profile'));
const VIEWPORT = { width: 1600, height: 1000 };

// Foundry wiring injected into the app for the LIVE path (optional — Settings persists in the profile).
const foundryEnv = {
  'ffi.foundry.projectEndpoint': process.env.FFI_FOUNDRY_ENDPOINT || '',
  'ffi.foundry.tenantId': process.env.FFI_FOUNDRY_TENANT || '',
  'ffi.foundry.clientId': process.env.FFI_FOUNDRY_CLIENT || '',
  'ffi.foundry.agent': process.env.FFI_FOUNDRY_AGENT || '',
};

const initScript = (live, env) => {
  const values = {
    'ffi.nav.collapsed': '1',
    ...(live ? { 'ffi.foundry.forceDemo': '' } : {}),
    ...(live ? Object.fromEntries(Object.entries(env).filter(([, v]) => v)) : {}),
  };
  return `try { const v = ${JSON.stringify(values)}; for (const k in v) localStorage.setItem(k, v[k]); } catch {}`;
};

// --- LOGIN: open a real browser so the analyst signs in once; the profile keeps the MSAL cache. ---
if (LOGIN) {
  mkdirSync(profileDir, { recursive: true });
  const ctx = await chromium.launchPersistentContext(profileDir, { headless: false, viewport: VIEWPORT });
  await ctx.addInitScript(initScript(true, foundryEnv));
  const page = ctx.pages()[0] || (await ctx.newPage());
  await page.goto(`${baseUrl}/fraud-iq`, { waitUntil: 'networkidle' });
  console.log('\nSign in with the demo-tenant analyst in the opened window (you have 3 min)…');
  // Wait until MSAL has cached a token in this profile.
  await page
    .waitForFunction(() => Object.keys(localStorage).some((k) => /login\.windows|msal|accesstoken/i.test(k)), {
      timeout: 180000,
    })
    .catch(() => console.log('(!) No MSAL cache detected — you can still run --live if Settings are configured.'));
  await page.waitForTimeout(1500);
  await ctx.close();
  console.log('\u2713 profile saved:', profileDir, '\nNow run:  npm run capture:fraud-iq -- --live', baseUrl);
  process.exit(0);
}

const vdir = mkdtempSync(join(tmpdir(), 'fraudiq-vid-'));

// LIVE reuses the persistent (signed-in) profile; mock uses a throwaway context.
let context;
let browser;
if (LIVE) {
  mkdirSync(profileDir, { recursive: true });
  context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: VIEWPORT,
    recordVideo: { dir: vdir, size: VIEWPORT },
  });
} else {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: vdir, size: VIEWPORT } });
}
await context.addInitScript(initScript(LIVE, foundryEnv));

const tStart = Date.now(); // ~ recording t=0
const page = context.pages()[0] || (await context.newPage());

await page.goto(`${baseUrl}/fraud-iq`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1800); // sign-in / entrance settle (intro — trimmed off below)

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

let tReveal;
if (LIVE) {
  // Real agent: scroll to the (still grounding) Foundry/Web row and WAIT for the real answer.
  await page.waitForTimeout(900);
  await scroll(0.85, 1200);
  await page
    .waitForFunction(() => document.querySelectorAll('.animate-spin').length === 0, { timeout: 180000 })
    .catch(() => console.log('(!) reveal wait timed out — capturing whatever is on screen.'));
  tReveal = Date.now();
  await page.waitForTimeout(700);
  // Answer portion (kept at normal speed): pan across Foundry IQ + Web IQ + citations.
  await scroll(0.82, 1600);
  await page.waitForTimeout(1600);
  await scroll(1.0, 1700);
  await page.waitForTimeout(1500);
  await scroll(0.4, 1300);
} else {
  // Mock resolves fast; the staggered reveal (~2.4s) is the whole show.
  await page.waitForTimeout(1600);
  await scroll(0.28, 1700);
  await scroll(0.55, 1800);
  await scroll(0.82, 2100);
  await page.waitForTimeout(1600);
  await scroll(1.0, 1700);
  await page.waitForTimeout(1400);
  await scroll(0.35, 1300);
}

const tEnd = Date.now();
await context.close(); // finalizes the .webm
if (browser) await browser.close();

const webm = readdirSync(vdir).find((f) => f.endsWith('.webm'));
if (!webm) {
  rmSync(vdir, { recursive: true, force: true });
  throw new Error('Playwright produced no video file');
}
const src = join(vdir, webm);
const startSec = Math.max(0, (tAction - tStart) / 1000 - 0.6); // trim intro, start just before the click
const endSec = (tEnd - tStart) / 1000;

if (LIVE && tReveal) {
  // Time-lapse: speed up the grounding wait [start..reveal] by SPEED×, keep the answer at 1×.
  const revealSec = Math.min(endSec - 0.2, Math.max(startSec + 0.5, (tReveal - tStart) / 1000));
  const vf =
    `[0:v]trim=start=${startSec.toFixed(2)}:end=${revealSec.toFixed(2)},setpts=(PTS-STARTPTS)/${SPEED}[g];` +
    `[0:v]trim=start=${revealSec.toFixed(2)}:end=${endSec.toFixed(2)},setpts=PTS-STARTPTS[a];` +
    `[g][a]concat=n=2:v=1,scale=1600:1000:flags=lanczos[v]`;
  execFileSync(
    'ffmpeg',
    ['-y', '-i', src, '-filter_complex', vf, '-map', '[v]', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', '-an', outFile],
    { stdio: 'inherit' },
  );
  rmSync(vdir, { recursive: true, force: true });
  console.log('\u2713 wrote', outFile, `(live: ${((revealSec - startSec)).toFixed(1)}s grounding @${SPEED}× + answer @1×)`);
} else {
  execFileSync(
    'ffmpeg',
    ['-y', '-ss', startSec.toFixed(2), '-i', src, '-vf', 'scale=1600:1000:flags=lanczos', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', '-an', outFile],
    { stdio: 'inherit' },
  );
  rmSync(vdir, { recursive: true, force: true });
  console.log('\u2713 wrote', outFile, `(mock: trimmed ${startSec.toFixed(1)}s intro)`);
}
