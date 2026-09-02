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
  it('draws no opaque node bars over the ribbons', () => {
    const fills = [...renderSankey().matchAll(/<rect[^>]*?fill="([^"]*)"/g)].map((m) => m[1]);
    expect(fills.length).toBeGreaterThan(0);
    expect(new Set(fills)).toEqual(new Set(['transparent']));
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
