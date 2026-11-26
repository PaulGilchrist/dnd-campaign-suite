// @maintained-by-ai 2026-11-02
// Campaign meta client lane (server/routes/campaigns-meta.js twin):
// getCampaignTypes stays defensive ({}) — a failed list read must never
// brick the campaign screen. loadCampaignMeta is a PURE read of the server
// contract (resolved type + normalized toolbelt) and THROWS on failure:
// defaulting policy lives in useCampaignMeta, so no caller silently paints
// defaults over live data mid-session. saveCampaignToolbelt rides PUT /meta
// (GM-only, partial upsert — the stored type is never sent, never touched).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCampaignTypes, loadCampaignMeta, saveCampaignToolbelt } from './campaignMetaService.js';

const CAMPAIGN = 'qa-arena';

const jsonResponse = (body, ok = true, status = 200) => ({
  ok,
  status,
  statusText: ok ? 'OK' : 'Bad Request',
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

describe('loadCampaignMeta', () => {
  it('passes the server-resolved type and toolbelt through', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      type: 'starter',
      toolbelt: { hiddenViews: ['music', 'mapsManager'] },
    }));
    await expect(loadCampaignMeta(CAMPAIGN)).resolves.toEqual({
      type: 'starter',
      hiddenViews: ['music', 'mapsManager'],
    });
    expect(fetchMock).toHaveBeenCalledWith(`/api/campaigns/${CAMPAIGN}/meta`);
  });

  it('reads the all-visible default the server answers for an unset toolbelt', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ type: 'standard', toolbelt: { hiddenViews: [] } }));
    await expect(loadCampaignMeta(CAMPAIGN)).resolves.toEqual({ type: 'standard', hiddenViews: [] });
  });

  it('REJECTS on a failed read (the hook owns the default policy)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'boom' }, false, 500));
    await expect(loadCampaignMeta(CAMPAIGN)).rejects.toThrow(/500/);
  });

  it('REJECTS on a network error', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    await expect(loadCampaignMeta(CAMPAIGN)).rejects.toThrow('offline');
  });
});

describe('saveCampaignToolbelt', () => {
  it('PUTs exactly the { toolbelt: { hiddenViews } } partial (type untouched)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Campaign meta saved successfully', type: 'standard', toolbelt: { hiddenViews: ['music'] } }));
    await saveCampaignToolbelt(CAMPAIGN, ['music']);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`/api/campaigns/${CAMPAIGN}/meta`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ toolbelt: { hiddenViews: ['music'] } });
  });

  it('quotes the server plain-English refusal', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Only the GM (localhost) can set the campaign meta' }, false, 403));
    await expect(saveCampaignToolbelt(CAMPAIGN, [])).rejects.toThrow('Only the GM (localhost) can set the campaign meta');
  });

  it('names the status when the refusal carries no body copy', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => { throw new Error('html page'); } });
    await expect(saveCampaignToolbelt(CAMPAIGN, [])).rejects.toThrow(/500/);
  });
});
