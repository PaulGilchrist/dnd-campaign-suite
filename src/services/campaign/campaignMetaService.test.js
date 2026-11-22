// @maintained-by-ai
// Campaign-type client lane: reads default ({} / 'standard') instead of
// rejecting — a failed meta fetch must never brick the sidebar or the
// campaign list. Type WRITES are server-side only now: the create route stamps
// the preset synchronously and Admin rides PUT /meta directly.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCampaignTypes, loadCampaignType } from './campaignMetaService.js';

const CAMPAIGN = 'qa-arena';

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  statusText: 'Forbidden',
  json: async () => body,
});

let fetchMock;
beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('getCampaignTypes', () => {
  it('returns the name→type map from the list endpoint', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ folders: [CAMPAIGN], types: { [CAMPAIGN]: 'arena' } }));
    await expect(getCampaignTypes()).resolves.toEqual({ [CAMPAIGN]: 'arena' });
    expect(fetchMock).toHaveBeenCalledWith('/api/campaigns');
  });

  it('defaults to {} on a failed fetch', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    await expect(getCampaignTypes()).resolves.toEqual({});
  });
});

describe('loadCampaignType', () => {
  it('returns the resolved type', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ type: 'starter' }));
    await expect(loadCampaignType(CAMPAIGN)).resolves.toBe('starter');
  });

  it('falls back to standard when the read fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, false, 500));
    await expect(loadCampaignType(CAMPAIGN)).resolves.toBe('standard');
  });
});
