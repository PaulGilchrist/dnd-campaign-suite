// Campaign-meta hook (Item 1): loads the type + toolbelt on campaign enter,
// converges LIVE by re-reading on the existing campaigns-list 'updated' SSE
// event (no new lane), keeps the all-visible default on a failed FIRST load
// (nav must never brick) but holds the LAST-KNOWN set on a failed live
// refresh, and saveHiddenViews writes through PUT /meta then settles
// optimistic local state.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import useCampaignMeta, { useHiddenViewFallback } from './useCampaignMeta.js';

const sseHandlers = new Map();
vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: vi.fn((campaignName, handler) => {
    sseHandlers.set(campaignName, handler);
    return () => sseHandlers.delete(campaignName);
  }),
}));

const loadMeta = vi.fn();
const saveToolbelt = vi.fn();
vi.mock('../../services/campaign/campaignMetaService.js', () => ({
  loadCampaignMeta: (...args) => loadMeta(...args),
  saveCampaignToolbelt: (...args) => saveToolbelt(...args),
}));

const ALL_VISIBLE = { type: 'standard', hiddenViews: [] };

function fireCampaignsList(campaign, action = 'updated') {
  const handler = sseHandlers.get(campaign);
  handler({ key: 'campaigns-list', data: { action, campaign } });
}

beforeEach(() => {
  sseHandlers.clear();
  loadMeta.mockReset().mockResolvedValue({ ...ALL_VISIBLE });
  saveToolbelt.mockReset().mockResolvedValue({});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('useCampaignMeta — load + defaults', () => {
  it('defaults ALL views visible while the meta read is in flight and when no meta is stored', async () => {
    const { result } = renderHook(() => useCampaignMeta('test-campaign'));
    expect(result.current).toMatchObject({ campaignType: 'standard', hiddenViews: [] });
    await waitFor(() => expect(loadMeta).toHaveBeenCalledWith('test-campaign'));
    expect(result.current.hiddenViews).toEqual([]);
  });

  it('adopts the stored hidden set once the lane answers', async () => {
    loadMeta.mockResolvedValue({ type: 'starter', hiddenViews: ['music', 'initiative'] });
    const { result } = renderHook(() => useCampaignMeta('test-campaign'));
    await waitFor(() => expect(result.current.hiddenViews).toEqual(['music', 'initiative']));
    expect(result.current.campaignType).toBe('starter');
  });

  it('a FAILED first load keeps the all-visible default (a blip never bricks the nav)', async () => {
    loadMeta.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useCampaignMeta('test-campaign'));
    await waitFor(() => expect(loadMeta).toHaveBeenCalled());
    expect(result.current).toMatchObject({ campaignType: 'standard', hiddenViews: [] });
  });

  it('resets to the default with no campaign open and subscribes to SSE only for a campaign', async () => {
    const { result } = renderHook(() => useCampaignMeta(null));
    expect(result.current.hiddenViews).toEqual([]);
    expect(loadMeta).not.toHaveBeenCalled();
    expect(sseHandlers.size).toBe(0);
  });
});

describe('useCampaignMeta — live convergence via the campaigns-list event', () => {
  it('re-reads the meta when the GM writes the toolbelt (visitor convergence, no reload)', async () => {
    loadMeta.mockResolvedValue({ ...ALL_VISIBLE });
    const { result } = renderHook(() => useCampaignMeta('test-campaign'));
    await waitFor(() => expect(result.current.hiddenViews).toEqual([]));

    loadMeta.mockResolvedValue({ type: 'standard', hiddenViews: ['mapsManager'] });
    fireCampaignsList('test-campaign');
    await waitFor(() => expect(result.current.hiddenViews).toEqual(['mapsManager']));
    expect(loadMeta).toHaveBeenCalledTimes(2);
  });

  it('ignores events for other campaigns, other actions, and other keys', async () => {
    const { result } = renderHook(() => useCampaignMeta('test-campaign'));
    await waitFor(() => expect(loadMeta).toHaveBeenCalledTimes(1));
    // Everything arrives on THIS tab's handler — the hook's own filters must
    // reject off-target campaigns, other actions, and other event keys.
    const handler = sseHandlers.get('test-campaign');
    handler({ key: 'change-test-campaign-combatSummary', data: {} });
    handler({ key: 'campaigns-list', data: { action: 'updated', campaign: 'other-campaign' } });
    handler({ key: 'campaigns-list', data: { action: 'deleted', campaign: 'test-campaign' } });
    await new Promise((r) => setTimeout(r, 0));
    expect(loadMeta).toHaveBeenCalledTimes(1);
    expect(result.current.hiddenViews).toEqual([]);
  });

  it('a FAILED live refresh keeps the last-known set (never pastes defaults over a working nav)', async () => {
    loadMeta.mockResolvedValue({ type: 'standard', hiddenViews: ['music'] });
    const { result } = renderHook(() => useCampaignMeta('test-campaign'));
    await waitFor(() => expect(result.current.hiddenViews).toEqual(['music']));

    loadMeta.mockRejectedValue(new Error('blip'));
    fireCampaignsList('test-campaign');
    await waitFor(() => expect(loadMeta).toHaveBeenCalledTimes(2));
    expect(result.current.hiddenViews).toEqual(['music']);
  });

  it('unsubscribes on campaign switch', async () => {
    const { rerender } = renderHook(({ name }) => useCampaignMeta(name), { initialProps: { name: 'a' } });
    await waitFor(() => expect(sseHandlers.has('a')).toBe(true));
    rerender({ name: 'b' });
    await waitFor(() => expect(sseHandlers.has('a')).toBe(false));
    expect(sseHandlers.has('b')).toBe(true);
  });
});

describe('useCampaignMeta — save round-trip', () => {
  it('hide/show round-trip: PUTs the set, settles locally, and the SSE echo re-read confirms', async () => {
    const { result } = renderHook(() => useCampaignMeta('test-campaign'));
    await waitFor(() => expect(loadMeta).toHaveBeenCalledTimes(1));

    saveToolbelt.mockImplementation(async (_c, views) => {
      loadMeta.mockResolvedValue({ type: 'standard', hiddenViews: views });
      return {};
    });
    await act(async () => { await result.current.saveHiddenViews(['initiative', 'music']); });
    expect(saveToolbelt).toHaveBeenCalledWith('test-campaign', ['initiative', 'music']);
    expect(result.current.hiddenViews).toEqual(['initiative', 'music']);

    fireCampaignsList('test-campaign');
    await waitFor(() => expect(result.current.hiddenViews).toEqual(['initiative', 'music']));
    expect(loadMeta).toHaveBeenCalledTimes(2);
  });

  it('a rejected save leaves the visible set UNCHANGED (no optimistic lie before the write)', async () => {
    const { result } = renderHook(() => useCampaignMeta('test-campaign'));
    await waitFor(() => expect(loadMeta).toHaveBeenCalledTimes(1));
    saveToolbelt.mockRejectedValue(new Error('Only the GM can set the campaign meta'));
    await expect(result.current.saveHiddenViews(['music'])).rejects.toThrow('Only the GM');
    expect(result.current.hiddenViews).toEqual([]);
  });
});

describe('useHiddenViewFallback — route guard', () => {
  it('drops a mounted activeView back to null once its view is hidden, and leaves visible views alone', () => {
    const setActiveView = vi.fn();
    const { rerender } = renderHook(
      ({ view, hidden }) => useHiddenViewFallback(view, hidden, setActiveView),
      { initialProps: { view: 'music', hidden: [] } },
    );
    expect(setActiveView).not.toHaveBeenCalled();
    rerender({ view: 'music', hidden: ['music'] });
    expect(setActiveView).toHaveBeenCalledWith(null);
    rerender({ view: 'initiative', hidden: ['music'] });
    expect(setActiveView).toHaveBeenCalledTimes(1);
  });
});
