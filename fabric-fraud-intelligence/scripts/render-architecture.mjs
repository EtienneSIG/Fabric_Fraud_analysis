// Renders video/remotion-slidedeck/architecture.mmd to public/architecture.png.
// Uses the already-installed Playwright chromium + Mermaid from a CDN, themed to match the deck.
//
// Usage (from fabric-fraud-intelligence/):
//   npm run render:architecture
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const deck = join(here, '..', '..', 'video', 'remotion-slidedeck');
const mmd = readFileSync(join(deck, 'architecture.mmd'), 'utf8');
const out = join(deck, 'public', 'architecture.png');

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;background:#0b1220;}
  #wrap{display:inline-block;padding:56px;background:#0b1220;}
  .mermaid{font-family:'Segoe UI',system-ui,sans-serif;}
</style></head><body>
  <div id="wrap"><pre class="mermaid">${mmd.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></div>
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        background: '#0b1220',
        primaryColor: '#111a2e', primaryTextColor: '#e5e7eb', primaryBorderColor: '#6366f1',
        lineColor: '#94a3b8', tertiaryColor: '#0b1220',
        clusterBkg: 'rgba(148,163,184,0.06)', clusterBorder: 'rgba(148,163,184,0.35)',
        fontFamily: "'Segoe UI', system-ui, sans-serif", fontSize: '18px',
      },
      flowchart: { curve: 'basis', htmlLabels: true, padding: 12, nodeSpacing: 46, rankSpacing: 60 },
    });
    await mermaid.run({ querySelector: '.mermaid' });
    window.__done = true;
  </script>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__done === true, { timeout: 45000 });
await page.waitForTimeout(300);
const el = await page.$('#wrap');
await el.screenshot({ path: out });
await browser.close();
console.log('\u2713 wrote', out);
