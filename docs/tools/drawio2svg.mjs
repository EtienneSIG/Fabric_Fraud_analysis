// Rendu .drawio -> SVG auto-contenue (icônes officielles MS inlinées) -> PNG.
// Icônes : téléchargées depuis aka.ms/MsiconsCollections puis inlinées (rendu GitHub-safe).
// Usage : node drawio2svg.mjs <in.drawio> <out.svg> <out.png>
// Dépendance : @resvg/resvg-js (exécuter depuis un dossier où il est installé).
import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';

const [, , inPath, outSvg, outPng] = process.argv;

const FONT = "'Segoe UI', Helvetica, Arial, sans-serif";
const unesc = (s) =>
  (s ?? '')
    .replace(/&#xa;|&#10;/gi, '\n')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------- parsing ----------
const xml = await readFile(inPath, 'utf8');

const parseStyle = (s) => {
  const o = {};
  for (const part of (s ?? '').split(';')) {
    if (!part) continue;
    const i = part.indexOf('=');
    if (i < 0) o[part] = true;
    else o[part.slice(0, i)] = part.slice(i + 1);
  }
  return o;
};

const cells = [];
const cellRe = /<mxCell\b([^>]*?)(\/>|>([\s\S]*?)<\/mxCell>)/g;
for (const m of xml.matchAll(cellRe)) {
  const attrs = {};
  for (const a of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
  const body = m[3] ?? '';
  const g = body.match(/<mxGeometry\b([^>]*)/);
  const geo = {};
  if (g) for (const a of g[1].matchAll(/([\w-]+)="([^"]*)"/g)) geo[a[1]] = a[2];
  const points = [...body.matchAll(/<mxPoint\s+([^/>]*)\/>/g)].map((p) => {
    const o = {};
    for (const a of p[1].matchAll(/([\w-]+)="([^"]*)"/g)) o[a[1]] = a[2];
    return o;
  });
  const offset = points.find((p) => p.as === 'offset');
  const waypoints = points.filter((p) => p.as === undefined).map((p) => ({ x: +p.x, y: +p.y }));
  cells.push({
    id: attrs.id,
    value: unesc(attrs.value),
    style: parseStyle(attrs.style),
    vertex: attrs.vertex === '1',
    edge: attrs.edge === '1',
    source: attrs.source,
    target: attrs.target,
    x: +geo.x || 0,
    y: +geo.y || 0,
    w: +geo.width || 0,
    h: +geo.height || 0,
    points: waypoints,
    // draw.io omet les attributs à 0 lors d'une re-sauvegarde.
    labelOffset: { x: +(offset?.x ?? 0), y: +(offset?.y ?? 0) },
  });
}
const byId = Object.fromEntries(cells.map((c) => [c.id, c]));
const model = xml.match(/<mxGraphModel\b([^>]*)/)[1];
const pageW = +(model.match(/pageWidth="(\d+)"/)?.[1] ?? 1500);
const pageH = +(model.match(/pageHeight="(\d+)"/)?.[1] ?? 900);

// ---------- icônes officielles : téléchargées puis inlinées ----------
const iconUrls = [...new Set(cells.map((c) => c.style.image).filter(Boolean))];
const iconSrc = {};
await Promise.all(
  iconUrls.map(async (u) => {
    const r = await fetch(u);
    if (!r.ok) throw new Error(`icône ${r.status} : ${u}`);
    iconSrc[u] = await r.text();
  }),
);

let iconSeq = 0;
const inlineIcon = (url, x, y, w, h) => {
  const ns = `i${iconSeq++}`;
  let s = iconSrc[url]
    .replace(/<\?xml[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  // Les ids internes sont préfixés : plusieurs instances d'une même icône ne doivent pas se voler leurs dégradés.
  const ids = [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids) {
    const re = new RegExp(`(["'#(])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["')])`, 'g');
    s = s.replace(re, `$1${ns}-${id}$2`);
  }
  const head = s.match(/<svg\b[^>]*>/)[0];
  let viewBox = head.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) {
    const iw = parseFloat(head.match(/\bwidth="([\d.]+)/)?.[1] ?? 18);
    const ih = parseFloat(head.match(/\bheight="([\d.]+)/)?.[1] ?? 18);
    viewBox = `0 0 ${iw} ${ih}`;
  }
  const inner = s.slice(s.indexOf('>', s.indexOf('<svg')) + 1, s.lastIndexOf('</svg>'));
  return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" overflow="visible">${inner}</svg>`;
};

// ---------- texte ----------
const textBlock = (lines, cx, topY, size, color, weight, style, anchor) =>
  lines
    .map(
      (l, i) =>
        `<text x="${cx}" y="${(topY + size * 0.82 + i * size * 1.25).toFixed(1)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" ${
          style ? 'font-style="italic" ' : ''
        }fill="${color}" text-anchor="${anchor}">${esc(l)}</text>`,
    )
    .join('');

const out = [];

// ---------- sommets ----------
for (const c of cells.filter((c) => c.vertex)) {
  const st = c.style;
  const size = +(st.fontSize ?? 12);
  const color = st.fontColor ?? '#1A1A1A';
  const weight = st.fontStyle === '1' ? 700 : 500;
  const italic = st.fontStyle === '2';
  const lines = c.value ? c.value.split('\n') : [];

  if (st.shape === 'image') {
    out.push(inlineIcon(st.image, c.x, c.y, c.w, c.h));
    if (lines.length) out.push(textBlock(lines, c.x + c.w / 2, c.y + c.h + 5, size, color, weight, italic, 'middle'));
    continue;
  }

  const fill = st.fillColor && st.fillColor !== 'none' ? st.fillColor : 'none';
  const stroke = st.strokeColor && st.strokeColor !== 'none' ? st.strokeColor : 'none';
  const dash = st.dashed === '1' ? ` stroke-dasharray="${(st.dashPattern ?? '6 4').replace(/\s+/g, ' ')}"` : '';
  out.push(
    `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}" fill="${fill}" stroke="${stroke}" stroke-width="1"${dash}/>`,
  );

  // Nœud "label" avec une icône à gauche (imageAlign=left) : on inline l'icône dans la gouttière gauche.
  const pad = +(st.spacingLeft ?? st.spacing ?? 0);
  if (st.image) {
    const iw = +(st.imageWidth ?? 24);
    const ih = +(st.imageHeight ?? 24);
    const ix = c.x + Math.max(5, (pad - iw) / 2);
    const iy = c.y + (c.h - ih) / 2;
    out.push(inlineIcon(st.image, ix, iy, iw, ih));
  }

  if (!lines.length) continue;

  const anchor = st.align === 'left' ? 'start' : st.align === 'right' ? 'end' : 'middle';
  const tx = anchor === 'start' ? c.x + pad : anchor === 'end' ? c.x + c.w : c.x + c.w / 2;
  const blockH = lines.length * size * 1.25;
  const top =
    st.verticalAlign === 'top'
      ? c.y + +(st.spacingTop ?? 0) + 2
      : st.verticalAlign === 'bottom'
        ? c.y + c.h - blockH
        : c.y + (c.h - blockH) / 2;
  out.push(textBlock(lines, tx, top, size, color, weight, italic, anchor));
}

// ---------- arêtes ----------
const markers = new Map();
function markerId(color) {
  if (!markers.has(color)) markers.set(color, `arw${markers.size}`);
  return markers.get(color);
}

const H = new Set(['left', 'right']);
const sideOf = (fx, fy) => (fx === 0 ? 'left' : fx === 1 ? 'right' : fy === 0 ? 'top' : 'bottom');
const anchorPoint = (c, fx, fy) => ({ x: c.x + c.w * fx, y: c.y + c.h * fy });

// Insère les coudes manquants : draw.io ne stocke que les points de passage, pas le tracé orthogonal.
function orthogonalize(pts, dirS, dirE) {
  const res = [pts[0]];
  const last = pts.length - 2;
  for (let i = 0; i <= last; i++) {
    const a = res[res.length - 1];
    const b = pts[i + 1];
    if (a.x === b.x || a.y === b.y) {
      res.push(b);
      continue;
    }
    if (i === 0 && i === last) {
      if (H.has(dirS) && H.has(dirE)) {
        const mx = (a.x + b.x) / 2;
        res.push({ x: mx, y: a.y }, { x: mx, y: b.y }, b);
        continue;
      }
      if (!H.has(dirS) && !H.has(dirE)) {
        const my = (a.y + b.y) / 2;
        res.push({ x: a.x, y: my }, { x: b.x, y: my }, b);
        continue;
      }
    }
    let horizFirst;
    if (i === 0) horizFirst = H.has(dirS);
    else if (i === last) horizFirst = !H.has(dirE);
    else horizFirst = res[res.length - 2].y === a.y ? false : true;
    res.push(horizFirst ? { x: b.x, y: a.y } : { x: a.x, y: b.y }, b);
  }
  return res;
}

for (const c of cells.filter((c) => c.edge)) {
  const st = c.style;
  const s = byId[c.source];
  const t = byId[c.target];
  if (!s || !t) continue;
  const sx = +st.exitX,
    sy = +st.exitY,
    tx = +st.entryX,
    ty = +st.entryY;
  const hasS = Number.isFinite(sx) && Number.isFinite(sy);
  const hasE = Number.isFinite(tx) && Number.isFinite(ty);
  const start = hasS ? anchorPoint(s, sx, sy) : { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  const end = hasE ? anchorPoint(t, tx, ty) : { x: t.x + t.w / 2, y: t.y + t.h / 2 };
  const dirS = hasS ? sideOf(sx, sy) : 'right';
  const dirE = hasE ? sideOf(tx, ty) : 'left';

  let pts;
  if (c.points.length) {
    pts = orthogonalize([start, ...c.points, end], dirS, dirE);
  } else if (start.x === end.x || start.y === end.y) {
    pts = [start, end];
  } else if (H.has(dirS) && H.has(dirE)) {
    const mx = (start.x + end.x) / 2;
    pts = [start, { x: mx, y: start.y }, { x: mx, y: end.y }, end];
  } else if (!H.has(dirS) && !H.has(dirE)) {
    const my = (start.y + end.y) / 2;
    pts = [start, { x: start.x, y: my }, { x: end.x, y: my }, end];
  } else if (H.has(dirS)) {
    pts = [start, { x: end.x, y: start.y }, end];
  } else {
    pts = [start, { x: start.x, y: end.y }, end];
  }

  const stroke = st.strokeColor ?? '#333333';
  const dash = st.dashed === '1' ? ' stroke-dasharray="6 4"' : '';
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  const mid = markerId(stroke);
  out.push(
    `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.6"${dash} marker-end="url(#${mid})"/>`,
  );

  if (!c.value) continue;
  const fs = +(st.fontSize ?? 11);
  const m = midpoint(pts);
  const lp = { x: m.x + c.labelOffset.x, y: m.y + c.labelOffset.y };
  const label = c.value;
  const w = label.length * fs * 0.52 + 10;
  out.push(
    `<rect x="${(lp.x - w / 2).toFixed(1)}" y="${(lp.y - fs * 0.85).toFixed(1)}" width="${w.toFixed(1)}" height="${(fs * 1.6).toFixed(1)}" rx="3" fill="#FFFFFF" fill-opacity="0.82"/>`,
  );
  out.push(
    `<text x="${lp.x.toFixed(1)}" y="${(lp.y + fs * 0.35).toFixed(1)}" font-family="${FONT}" font-size="${fs}" font-weight="600" fill="${st.fontColor ?? stroke}" text-anchor="middle">${esc(label)}</text>`,
  );
}

function midpoint(pts) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    segs.push(len);
    total += len;
  }
  let acc = 0;
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= total / 2) {
      const r = (total / 2 - acc) / (segs[i] || 1);
      return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * r, y: pts[i].y + (pts[i + 1].y - pts[i].y) * r };
    }
    acc += segs[i];
  }
  return pts[0];
}

const defs = [...markers.entries()]
  .map(
    ([color, id]) =>
      `<marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L10 5 L0 10 z" fill="${color}"/></marker>`,
  )
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${pageW}" height="${pageH}" viewBox="0 0 ${pageW} ${pageH}"><defs>${defs}</defs><rect width="${pageW}" height="${pageH}" fill="#FFFFFF"/>${out.join('')}</svg>`;

await writeFile(outSvg, svg, 'utf8');
const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1920 }, font: { loadSystemFonts: true } }).render().asPng();
await writeFile(outPng, png);
console.log(`${outSvg} ${svg.length}o · ${outPng} ${png.length}o · ${iconUrls.length} icônes inlinées`);
