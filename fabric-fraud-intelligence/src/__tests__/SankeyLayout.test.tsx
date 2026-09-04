import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Sankey } from '@/app/components/Sankey';
import { buildJourneyFlow, journeyColumns, terminalEvents } from '@/backend/api/flow';

function renderSankey() {
  const { nodes, links } = buildJourneyFlow(terminalEvents()[0], 5);
  return renderToStaticMarkup(
    <Sankey nodes={nodes} links={links} columns={journeyColumns(5)} height={330} />
  );
}

describe('Sankey layout', () => {
  it('offers multiple distinct paths for every fraud type', () => {
    const fraudTerminals = terminalEvents().filter((terminal) => terminal.startsWith('Fraud:'));

    expect(fraudTerminals.length).toBeGreaterThan(0);
    for (const terminal of fraudTerminals) {
      const { links } = buildJourneyFlow(terminal, 5);
      expect(new Set(links.map((link) => link.key)).size, terminal).toBeGreaterThanOrEqual(3);
    }
  });

  it('draws colored node bars for every event', () => {
    const fills = [...renderSankey().matchAll(/<rect[^>]*?fill="([^"]*)"/g)].map((m) => m[1]);
    expect(fills.length).toBeGreaterThan(0);
    expect(fills.every((fill) => /^#[0-9a-f]{6}$/i.test(fill))).toBe(true);
  });

  it('draws value-scaled centerlines instead of background-like closed ribbons', () => {
    const markup = renderSankey();
    const paths = [...markup.matchAll(/<path[^>]*d="([^"]*)"[^>]*fill="([^"]*)"[^>]*stroke-width="([^"]*)"/g)];
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((match) => !match[1].includes(' Z') && match[2] === 'none')).toBe(true);
    const widths = paths.map((match) => Number(match[3]));
    expect(new Set(widths.map((width) => width.toFixed(2))).size).toBeGreaterThan(1);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(1.25);
    expect(Math.max(...widths)).toBe(11.375);
    expect(Math.max(...widths)).toBeLessThanOrEqual(12);
  });

  it('chains ribbons across columns without gaps', () => {
    const starts = new Set<number>();
    const ends = new Set<number>();
    for (const m of renderSankey().matchAll(/ d="M([\d.]+),[\d.]+ C[\d.]+,[\d.]+ [\d.]+,[\d.]+ ([\d.]+),/g)) {
      starts.add(Number(m[1]));
      ends.add(Number(m[2]));
    }
    const sortedEnds = [...ends].sort((a, b) => a - b);
    expect(sortedEnds.length).toBeGreaterThan(1);
    expect(sortedEnds.slice(0, -1).every((x) => starts.has(x))).toBe(true);
  });
});
