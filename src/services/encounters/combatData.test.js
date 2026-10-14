import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as combatData from './combatData.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';

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
    combatData.setCombatSummaryCache(null, 'test-campaign');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    combatData.setCombatSummaryCache(null, 'test-campaign');
  });

  describe('setCombatSummaryCache', () => {
    it('stores the summary in the in-memory cache', () => {
      const summary = { round: 7, creatures: [{ name: 'Orc' }] };
      combatData.setCombatSummaryCache(summary, 'test-campaign');
      expect(combatData.getCombatSummary('test-campaign')).toBe(summary);
    });

    it('clears cache when null is passed', () => {
      combatData.setCombatSummaryCache({ round: 1 }, 'test-campaign');
      combatData.setCombatSummaryCache(null, 'test-campaign');
      expect(combatData.getCombatSummary('test-campaign')).toBeNull();
    });

    it('does not interfere with other campaigns', () => {
      const summaryA = { round: 1, campaign: 'A' };
      const summaryB = { round: 2, campaign: 'B' };
      combatData.setCombatSummaryCache(summaryA, 'campaignA');
      combatData.setCombatSummaryCache(summaryB, 'campaignB');
      expect(combatData.getCombatSummary('campaignA')).toBe(summaryA);
      expect(combatData.getCombatSummary('campaignB')).toBe(summaryB);
      expect(combatData.getCombatSummary('campaignA')).not.toBe(summaryB);
    });

    it('returns null for unknown campaign', () => {
      expect(combatData.getCombatSummary('unknownCampaign')).toBeNull();
    });
  });

  describe('loadCombatSummary', () => {
    it('returns the combat summary from the API and caches it', async () => {
      stubFetchCombatSummary({ round: 5, creatures: [{ name: 'Orc' }], activeCreatureName: 'Orc' });
      const result = await combatData.loadCombatSummary('test-campaign');
      expect(result).toEqual({ round: 5, creatures: [{ name: 'Orc' }], activeCreatureName: 'Orc' });
      expect(combatData.getCombatSummary('test-campaign')).toEqual(result);
    });

    it('auto-sets activeCreatureName from first creature when missing', async () => {
      stubFetchCombatSummary({ round: 5, creatures: [{ name: 'Orc' }, { name: 'Goblin' }] });
      const result = await combatData.loadCombatSummary('test-campaign');
      expect(result.activeCreatureName).toBe('Orc');
      expect(result.creatures.length).toBe(2);
    });

    it('falls back to runtime activeCreatureName when API has none and no creatures', async () => {
      stubFetchCombatSummary({ round: 3, creatures: [] });
      vi.spyOn(useRuntimeState, 'getRuntimeValue').mockReturnValue('TopLevelCreature');
      const result = await combatData.loadCombatSummary('test-campaign');
      expect(result.activeCreatureName).toBe('TopLevelCreature');
    });

    it('returns null when the API returns no combatSummary', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ combatSummary: null }),
        })
      );
      const result = await combatData.loadCombatSummary('test-campaign');
      expect(result).toBeNull();
    });

    it('returns null when the API responds with non-OK status', async () => {
      stubFetchCombatSummaryError();
      const result = await combatData.loadCombatSummary('test-campaign');
      expect(result).toBeNull();
    });

    it('returns null when fetch throws', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('network error'))
      );
      const result = await combatData.loadCombatSummary('test-campaign');
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
      await combatData.loadCombatSummary('test-campaign');
      expect(combatData.getCombatSummary('test-campaign')).toEqual({ round: 4, creatures: [] });
    });

    it('returns null when no summary has been loaded', () => {
      expect(combatData.getCombatSummary('test-campaign')).toBeNull();
    });

    it('returns null when campaignName is falsy', () => {
      expect(combatData.getCombatSummary(null)).toBeNull();
    });
  });

  describe('loadActiveCreatureName', () => {
    it('returns the active creature name from the API', async () => {
      stubFetchCombatSummary({ round: 1, activeCreatureName: 'Orc' });
      const result = await combatData.loadActiveCreatureName('test-campaign');
      expect(result).toBe('Orc');
    });

    it('returns null when the API has no activeCreatureName', async () => {
      stubFetchCombatSummary({ round: 1, creatures: [] });
      const result = await combatData.loadActiveCreatureName('test-campaign');
      expect(result).toBeNull();
    });

    it('falls back to runtime activeCreatureName when API has none', async () => {
      stubFetchCombatSummary({ round: 1, creatures: [{ name: 'Orc' }] });
      vi.spyOn(useRuntimeState, 'getRuntimeValue').mockReturnValue('RuntimeCreature');
      const result = await combatData.loadActiveCreatureName('test-campaign');
      expect(result).toBe('RuntimeCreature');
    });

    it('returns null when the API call fails', async () => {
      stubFetchCombatSummaryError();
      const result = await combatData.loadActiveCreatureName('test-campaign');
      expect(result).toBeNull();
    });
  });

  describe('getActiveCreatureName', () => {
    it('returns the cached active creature name', () => {
      combatData.setCombatSummaryCache({ round: 1, activeCreatureName: 'Goblin' }, 'test-campaign');
      expect(combatData.getActiveCreatureName('test-campaign')).toBe('Goblin');
    });

    it('returns null when activeCreatureName is empty string', () => {
      combatData.setCombatSummaryCache({ round: 1, activeCreatureName: '' }, 'test-campaign');
      expect(combatData.getActiveCreatureName('test-campaign')).toBeNull();
    });

    it('returns null when no cache is set', () => {
      expect(combatData.getActiveCreatureName('test-campaign')).toBeNull();
    });

    it('returns null when campaignName is falsy', () => {
      expect(combatData.getActiveCreatureName(null)).toBeNull();
    });
  });

  describe('loadCurrentCombatRound', () => {
    it('returns the round from the API', async () => {
      stubFetchCombatSummary({ round: 5 });
      const result = await combatData.loadCurrentCombatRound('test-campaign');
      expect(result).toBe(5);
    });

    it('returns 1 when the API returns no round', async () => {
      stubFetchCombatSummary({ creatures: [] });
      const result = await combatData.loadCurrentCombatRound('test-campaign');
      expect(result).toBe(1);
    });

    it('returns 1 when the API call fails', async () => {
      stubFetchCombatSummaryError();
      const result = await combatData.loadCurrentCombatRound('test-campaign');
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
      combatData.setCombatSummaryCache({ round: 3, creatures: [] }, 'test-campaign');
      expect(combatData.getCurrentCombatRound('test-campaign')).toBe(3);
    });

    it('returns 1 when no cache is set', () => {
      expect(combatData.getCurrentCombatRound('test-campaign')).toBe(1);
    });

    it('returns 1 when campaignName is falsy', () => {
      expect(combatData.getCurrentCombatRound(null)).toBe(1);
    });
  });
});
