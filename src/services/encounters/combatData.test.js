// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as combatData from './combatData.js';

const originalFetch = globalThis.fetch;

function stubFetchCombatSummary(payload) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ combatSummary: payload }),
    })
  );
}

function stubFetchCombatSummaryError() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: false })
  );
}

describe('combatData', () => {
  beforeEach(() => {
    localStorage.clear();
    combatData.setCombatSummaryCache(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    combatData.setCombatSummaryCache(null);
  });

  describe('setCombatSummaryCache', () => {
    it('stores the summary in the in-memory cache', () => {
      const summary = { round: 7, creatures: [{ name: 'Orc' }] };
      combatData.setCombatSummaryCache(summary, 'testCampaign');
      expect(combatData.getCombatSummary()).toBe(summary);
    });

    it('clears cache when null is passed', () => {
      combatData.setCombatSummaryCache({ round: 1 }, 'testCampaign');
      combatData.setCombatSummaryCache(null, 'testCampaign');
      expect(combatData.getCombatSummary()).toBeNull();
    });
  });

  describe('loadCombatSummary', () => {
    it('returns the combat summary from the API and caches it', async () => {
      stubFetchCombatSummary({ round: 5, creatures: [{ name: 'Orc' }] });
      const result = await combatData.loadCombatSummary('testCampaign');
      expect(result).toEqual({ round: 5, creatures: [{ name: 'Orc' }] });
      expect(combatData.getCombatSummary()).toEqual(result);
    });

    it('returns null when the API returns no combatSummary', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ combatSummary: null }),
        })
      );
      const result = await combatData.loadCombatSummary('testCampaign');
      expect(result).toBeNull();
    });

    it('returns null when the API responds with non-OK status', async () => {
      stubFetchCombatSummaryError();
      const result = await combatData.loadCombatSummary('testCampaign');
      expect(result).toBeNull();
    });

    it('returns null when fetch throws', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('network error'))
      );
      const result = await combatData.loadCombatSummary('testCampaign');
      expect(result).toBeNull();
    });

    it('returns null and does not call fetch when campaignName is falsy', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      const result = await combatData.loadCombatSummary(null);
      expect(result).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('getCombatSummary', () => {
    it('returns the cached summary after loadCombatSummary', async () => {
      stubFetchCombatSummary({ round: 4, creatures: [] });
      await combatData.loadCombatSummary('testCampaign');
      expect(combatData.getCombatSummary()).toEqual({ round: 4, creatures: [] });
    });

    it('returns null when no summary has been loaded', () => {
      expect(combatData.getCombatSummary()).toBeNull();
    });
  });

  describe('loadActiveCreatureName', () => {
    it('returns the active creature name from the API', async () => {
      stubFetchCombatSummary({ round: 1, activeCreatureName: 'Orc' });
      const result = await combatData.loadActiveCreatureName('testCampaign');
      expect(result).toBe('Orc');
    });

    it('returns null when the API has no activeCreatureName', async () => {
      stubFetchCombatSummary({ round: 1, creatures: [] });
      const result = await combatData.loadActiveCreatureName('testCampaign');
      expect(result).toBeNull();
    });

    it('returns null when the API call fails', async () => {
      stubFetchCombatSummaryError();
      const result = await combatData.loadActiveCreatureName('testCampaign');
      expect(result).toBeNull();
    });
  });

  describe('getActiveCreatureName', () => {
    it('returns the cached active creature name', () => {
      combatData.setCombatSummaryCache({ round: 1, activeCreatureName: 'Goblin' });
      expect(combatData.getActiveCreatureName()).toBe('Goblin');
    });

    it('returns null when no cache is set', () => {
      expect(combatData.getActiveCreatureName()).toBeNull();
    });
  });

  describe('loadCurrentCombatRound', () => {
    it('returns the round from the API', async () => {
      stubFetchCombatSummary({ round: 5 });
      const result = await combatData.loadCurrentCombatRound('testCampaign');
      expect(result).toBe(5);
    });

    it('returns 1 when the API returns no round', async () => {
      stubFetchCombatSummary({ creatures: [] });
      const result = await combatData.loadCurrentCombatRound('testCampaign');
      expect(result).toBe(1);
    });

    it('returns 1 when the API call fails', async () => {
      stubFetchCombatSummaryError();
      const result = await combatData.loadCurrentCombatRound('testCampaign');
      expect(result).toBe(1);
    });

    it('returns 1 when campaignName is null', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      const result = await combatData.loadCurrentCombatRound(null);
      expect(result).toBe(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('getCurrentCombatRound', () => {
    it('returns the cached round', () => {
      combatData.setCombatSummaryCache({ round: 3, creatures: [] });
      expect(combatData.getCurrentCombatRound()).toBe(3);
    });

    it('returns 1 when no cache is set', () => {
      expect(combatData.getCurrentCombatRound()).toBe(1);
    });
  });
});
