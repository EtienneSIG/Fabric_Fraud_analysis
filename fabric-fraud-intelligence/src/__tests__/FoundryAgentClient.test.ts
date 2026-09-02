import { describe, expect, it } from 'vitest';

import {
  getVersionedAgentEndpoint,
  parseFoundryResponse,
  requiresInteractiveAuth,
  shouldRetryFoundryRequest,
} from '@/services/FoundryAgentClient';

describe('getVersionedAgentEndpoint', () => {
  it('adds the required API version while preserving existing parameters', () => {
    expect(getVersionedAgentEndpoint('https://example.test/responses?trace=true')).toBe(
      'https://example.test/responses?trace=true&api-version=2025-11-15-preview'
    );
  });
});

describe('requiresInteractiveAuth', () => {
  it('recovers from an MSAL silent-token timeout with interactive authentication', () => {
    expect(requiresInteractiveAuth({ errorCode: 'timed_out' })).toBe(true);
  });

  it('does not hide unrelated authentication failures', () => {
    expect(requiresInteractiveAuth({ errorCode: 'invalid_request' })).toBe(false);
  });
});

describe('shouldRetryFoundryRequest', () => {
  it('retries transient service and throttling responses', () => {
    expect([408, 429, 500, 502, 503, 504].every(shouldRetryFoundryRequest)).toBe(true);
  });

  it('does not retry authentication or validation failures', () => {
    expect([400, 401, 403, 404].some(shouldRetryFoundryRequest)).toBe(false);
  });
});

describe('parseFoundryResponse', () => {
  it('extracts response text and unique URL citations', () => {
    const result = parseFoundryResponse({
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: 'Obligation réglementaire vérifiée.',
              annotations: [
                { type: 'url_citation', title: 'EUR-Lex', url: 'https://eur-lex.europa.eu/example' },
                { type: 'url_citation', title: 'EUR-Lex', url: 'https://eur-lex.europa.eu/example' },
              ],
            },
          ],
        },
      ],
    });

    expect(result.answer).toBe('Obligation réglementaire vérifiée.');
    expect(result.citations).toEqual([
      { title: 'EUR-Lex', url: 'https://eur-lex.europa.eu/example' },
    ]);
  });

  it('rejects an empty agent response', () => {
    expect(() => parseFoundryResponse({ output: [] })).toThrow(
      'Foundry IQ returned an empty response.'
    );
  });
});