import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as combatData from './combatData.js';
import * as realCombatData from '../services/encounters/combatData.js';

const EXPORTED_NAMES = [
  'getCombatContext',
  'setCombatSummaryCache',
  'loadCombatSummary',
  'getCombatSummary',
  'loadActiveCreatureName',
  'getActiveCreatureName',
  'loadCurrentCombatRound',
  'getCurrentCombatRound',
];

/**
 * Create a fetch stub that returns the given payload for the combat-context API path.
 */
function stubFetchCombatSummary(payload) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ combatSummary: payload }),
    })
  );
}

/**
 * Stub fetch to return a non-ok response, causing getCombatContext to fail.
 */
function stubFetchCombatSummaryFail() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({}),
    })
  );
}

describe('combatData shim (src/encounters/combatData.js)', () => {
  beforeEach(() => {
    combatData.setCombatSummaryCache(null, 'test-campaign');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    combatData.setCombatSummaryCache(null, 'test-campaign');
  });

  describe('re-exports', () => {
    it('re-exports every known binding from the real module', () => {
      for (const name of EXPORTED_NAMES) {
        expect(combatData[name]).toBeTypeOf('function');
        expect(combatData[name]).toBe(realCombatData[name]);
      }
    });

    it('re-exports getCombatContext as a function', () => {
      expect(combatData.getCombatContext).toBeTypeOf('function');
      expect(combatData.getCombatContext).toBe(realCombatData.getCombatContext);
    });
  });

  describe('in-memory cache', () => {
    it('setCombatSummaryCache / getCombatSummary round-trip', () => {
      const summary = { round: 2, creatures: [{ name: 'Orc' }], activeCreatureName: 'Orc' };
      combatData.setCombatSummaryCache(summary, 'test-campaign');
      expect(combatData.getCombatSummary('test-campaign')).toBe(summary);
      combatData.setCombatSummaryCache(null, 'test-campaign');
      expect(combatData.getCombatSummary('test-campaign')).toBeNull();
    });

    it('caches independently per campaign name', () => {
      const summaryA = { round: 1, activeCreatureName: 'A' };
      const summaryB = { round: 2, activeCreatureName: 'B' };
      combatData.setCombatSummaryCache(summaryA, 'campaign-a');
      combatData.setCombatSummaryCache(summaryB, 'campaign-b');
      expect(combatData.getCombatSummary('campaign-a')).toBe(summaryA);
      expect(combatData.getCombatSummary('campaign-b')).toBe(summaryB);
      combatData.setCombatSummaryCache(null, 'campaign-a');
      combatData.setCombatSummaryCache(null, 'campaign-b');
    });

    it('getCombatSummary returns null for unknown campaign', () => {
      expect(combatData.getCombatSummary('nonexistent')).toBeNull();
    });

    it('getCombatSummary returns null when campaignName is falsy', () => {
      expect(combatData.getCombatSummary(null)).toBeNull();
      expect(combatData.getCombatSummary(undefined)).toBeNull();
      expect(combatData.getCombatSummary('')).toBeNull();
    });
  });

  describe('active creature name', () => {
    it('getActiveCreatureName reads from the shared cache', () => {
      combatData.setCombatSummaryCache({ round: 7, activeCreatureName: 'Goblin' }, 'test-campaign');
      expect(combatData.getActiveCreatureName('test-campaign')).toBe('Goblin');
    });

    it('getActiveCreatureName returns null when cache entry has no activeCreatureName', () => {
      combatData.setCombatSummaryCache({ round: 3, creatures: [{ name: 'Orc' }] }, 'test-campaign');
      expect(combatData.getActiveCreatureName('test-campaign')).toBeNull();
    });

    it('getActiveCreatureName returns null when no cache exists', () => {
      expect(combatData.getActiveCreatureName('test-campaign')).toBeNull();
    });

    it('getActiveCreatureName returns null when campaignName is falsy', () => {
      expect(combatData.getActiveCreatureName(null)).toBeNull();
      expect(combatData.getActiveCreatureName(undefined)).toBeNull();
      expect(combatData.getActiveCreatureName('')).toBeNull();
    });
  });

  describe('combat round', () => {
    it('getCurrentCombatRound reads from the shared cache', () => {
      combatData.setCombatSummaryCache({ round: 7 }, 'test-campaign');
      expect(combatData.getCurrentCombatRound('test-campaign')).toBe(7);
    });

    it('getCurrentCombatRound returns 1 when no cache exists', () => {
      expect(combatData.getCurrentCombatRound('test-campaign')).toBe(1);
    });

    it('getCurrentCombatRound returns 1 when round is missing from cache', () => {
      combatData.setCombatSummaryCache({ activeCreatureName: 'Orc' }, 'test-campaign');
      expect(combatData.getCurrentCombatRound('test-campaign')).toBe(1);
    });

    it('getCurrentCombatRound returns 1 when round is null in cache', () => {
      combatData.setCombatSummaryCache({ round: null }, 'test-campaign');
      expect(combatData.getCurrentCombatRound('test-campaign')).toBe(1);
    });

    it('getCurrentCombatRound returns 1 when campaignName is falsy', () => {
      expect(combatData.getCurrentCombatRound(null)).toBe(1);
      expect(combatData.getCurrentCombatRound(undefined)).toBe(1);
      expect(combatData.getCurrentCombatRound('')).toBe(1);
    });
  });

  describe('loadCombatSummary', () => {
    it('fetches through the API and seeds the shared cache', async () => {
      stubFetchCombatSummary({ round: 5, creatures: [{ name: 'Orc' }], activeCreatureName: 'Orc' });
      const result = await combatData.loadCombatSummary('test-campaign');
      expect(result).toEqual({ round: 5, creatures: [{ name: 'Orc' }], activeCreatureName: 'Orc' });
      expect(combatData.getCombatSummary('test-campaign')).toEqual(result);
    });

    it('sets activeCreatureName to first creature when missing', async () => {
      stubFetchCombatSummary({ round: 1, creatures: [{ name: 'Orc' }, { name: 'Goblin' }] });
      const result = await combatData.loadCombatSummary('test-campaign');
      expect(result.activeCreatureName).toBe('Orc');
    });

    it('returns null when fetch fails', async () => {
      stubFetchCombatSummaryFail();
      const result = await combatData.loadCombatSummary('test-campaign');
      expect(result).toBeNull();
    });

    it('returns null when campaignName is falsy', async () => {
      expect(await combatData.loadCombatSummary(null)).toBeNull();
      expect(await combatData.loadCombatSummary(undefined)).toBeNull();
      expect(await combatData.loadCombatSummary('')).toBeNull();
    });

    it('returns null when API returns no combatSummary', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ otherKey: 'value' }),
        })
      );
      const result = await combatData.loadCombatSummary('test-campaign');
      expect(result).toBeNull();
    });
  });

  describe('loadActiveCreatureName', () => {
    it('fetches and returns the active creature name from the API', async () => {
      stubFetchCombatSummary({ round: 3, activeCreatureName: 'Orc' });
      expect(await combatData.loadActiveCreatureName('test-campaign')).toBe('Orc');
    });

    it('returns null when activeCreatureName is missing from API response', async () => {
      stubFetchCombatSummary({ round: 3, creatures: [{ name: 'Orc' }] });
      // The API response has no activeCreatureName and no top-level activeCreatureName
      // In the real module, getCombatContext also checks data.activeCreatureName
      // but our stub only returns { combatSummary: ... }, so this should be null
      const result = await combatData.loadActiveCreatureName('test-campaign');
      expect(result).toBeNull();
    });

    it('returns null when fetch fails', async () => {
      stubFetchCombatSummaryFail();
      expect(await combatData.loadActiveCreatureName('test-campaign')).toBeNull();
    });

    it('returns null when campaignName is falsy', async () => {
      expect(await combatData.loadActiveCreatureName(null)).toBeNull();
      expect(await combatData.loadActiveCreatureName(undefined)).toBeNull();
      expect(await combatData.loadActiveCreatureName('')).toBeNull();
    });
  });

  describe('loadCurrentCombatRound', () => {
    it('loads combat summary and returns the round number', async () => {
      stubFetchCombatSummary({ round: 4, activeCreatureName: 'Orc' });
      expect(await combatData.loadCurrentCombatRound('test-campaign')).toBe(4);
    });

    it('returns 1 when round is missing from API response', async () => {
      stubFetchCombatSummary({ activeCreatureName: 'Orc' });
      expect(await combatData.loadCurrentCombatRound('test-campaign')).toBe(1);
    });

    it('returns 1 when fetch fails', async () => {
      stubFetchCombatSummaryFail();
      expect(await combatData.loadCurrentCombatRound('test-campaign')).toBe(1);
    });

    it('returns 1 when campaignName is falsy', async () => {
      expect(await combatData.loadCurrentCombatRound(null)).toBe(1);
      expect(await combatData.loadCurrentCombatRound(undefined)).toBe(1);
      expect(await combatData.loadCurrentCombatRound('')).toBe(1);
    });
  });
});
