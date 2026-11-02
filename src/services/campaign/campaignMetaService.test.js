// @maintained-by-ai
// Campaign-type client lane: reads default ({} / 'standard') instead of
// rejecting — a failed meta fetch must never brick the sidebar or the
// campaign list. The GM-only write surfaces the server's error text so the
// orchestrator can log it.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCampaignTypes, loadCampaignType, saveCampaignType } from './campaignMetaService.js';

const CAMPAIGN = 'qa-arena';
const URL = `/api/campaigns/${CAMPAIGN}/meta`;

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

describe('saveCampaignType', () => {
  it('PUTs the { type } payload', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'ok' }));
    await saveCampaignType(CAMPAIGN, 'arena');
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(URL);
    expect(opts.method).toBe('PUT');
    expect(JSON.parse(opts.body)).toEqual({ type: 'arena' });
  });

  it('throws the server error text (e.g. the GM-only 403)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Only the GM (localhost) can set the campaign type' }, false, 403));
    await expect(saveCampaignType(CAMPAIGN, 'arena')).rejects.toThrow(/Only the GM/);
  });
});
