import { describe, expect, it } from 'vitest';

import { PublicDemoAuthService } from '@/services/PublicDemoAuthService';

describe('PublicDemoAuthService', () => {
  it('returns the synthetic demo identity without interactive authentication', async () => {
    const service = new PublicDemoAuthService();

    await expect(service.initEmbeddedAuth()).resolves.toEqual({
      id: 'public-demo',
      email: 'analyst@demo',
      name: 'Public demo',
    });
    expect(service.fabricAuthEnabled).toBe(false);
  });
});