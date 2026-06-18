import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as damageUtils from '../rules/combat/damageUtils.js';
import * as combatDataModule from './combatData.js';

describe('combatData', () => {
  let getCombatContextSpy;

  beforeEach(() => {
    localStorage.clear();
    getCombatContextSpy = vi.spyOn(damageUtils, 'getCombatContext');
    // Clear the combat summary cache
    combatDataModule.setCombatSummaryCache(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadCombatSummary', () => {
    it('returns null when no campaignName', async () => {
      getCombatContextSpy.mockResolvedValue(null);
      const { loadCombatSummary } = await import('./combatData.js');
      const result = await loadCombatSummary(null);
      expect(result).toBeNull();
    });

    it('returns null from API when campaignName but API returns null', async () => {
      getCombatContextSpy.mockResolvedValue(null);
      const { loadCombatSummary } = await import('./combatData.js');
      const result = await loadCombatSummary('testCampaign');
      expect(result).toBeNull();
    });

    it('returns data from API and updates cache when campaignName provided', async () => {
      getCombatContextSpy.mockResolvedValue({ round: 5, creatures: [] });
      const { loadCombatSummary, setCombatSummaryCache, getCombatSummary } = await import('./combatData.js');
      const result = await loadCombatSummary('testCampaign');
      expect(result).toEqual({ round: 5, creatures: [] });
      // Verify cache was updated
      expect(getCombatSummary()).toEqual({ round: 5, creatures: [] });
      // Verify NO localStorage write
      expect(localStorage.getItem('combatSummary')).toBeNull();
    });

    it('returns null when API call fails', async () => {
      getCombatContextSpy.mockRejectedValue(new Error('network error'));
      const { loadCombatSummary } = await import('./combatData.js');
      const result = await loadCombatSummary('testCampaign');
      expect(result).toBeNull();
    });

    it('returns null when no campaignName provided', async () => {
      getCombatContextSpy.mockResolvedValue(null);
      const { loadCombatSummary } = await import('./combatData.js');
      const result = await loadCombatSummary(null);
      expect(result).toBeNull();
    });
  });

  describe('getCombatSummary', () => {
    it('returns cached value when set via loadCombatSummary', async () => {
      getCombatContextSpy.mockResolvedValue({ round: 4 });
      const { loadCombatSummary, getCombatSummary } = await import('./combatData.js');
      await loadCombatSummary('testCampaign');
      expect(getCombatSummary()).toEqual({ round: 4 });
    });

    it('returns null when no cache set', () => {
      const { getCombatSummary } = require('./combatData.js');
      expect(getCombatSummary()).toBeNull();
    });
  });

  describe('loadActiveCreatureName', () => {
    it('returns null when no campaignName', async () => {
      getCombatContextSpy.mockResolvedValue(null);
      const { loadActiveCreatureName } = await import('./combatData.js');
      const result = await loadActiveCreatureName(null);
      expect(result).toBeNull();
    });

    it('reads from API when campaignName provided', async () => {
      getCombatContextSpy.mockResolvedValue({ round: 1, activeCreatureName: 'Orc' });
      const { loadActiveCreatureName } = await import('./combatData.js');
      const result = await loadActiveCreatureName('testCampaign');
      expect(result).toBe('Orc');
      // Verify NO localStorage write
      expect(localStorage.getItem('activeCreatureName')).toBeNull();
    });

    it('returns null when API returns no activeCreatureName', async () => {
      getCombatContextSpy.mockResolvedValue({ round: 1 });
      const { loadActiveCreatureName } = await import('./combatData.js');
      const result = await loadActiveCreatureName('testCampaign');
      expect(result).toBeNull();
    });

    it('returns null when API fails', async () => {
      getCombatContextSpy.mockRejectedValue(new Error('network error'));
      const { loadActiveCreatureName } = await import('./combatData.js');
      const result = await loadActiveCreatureName('testCampaign');
      expect(result).toBeNull();
    });
  });

  describe('getActiveCreatureName', () => {
    it('returns cached active creature name', async () => {
      getCombatContextSpy.mockResolvedValue({ round: 1, activeCreatureName: 'Goblin' });
      const { loadCombatSummary, getActiveCreatureName } = await import('./combatData.js');
      await loadCombatSummary('testCampaign');
      expect(getActiveCreatureName()).toBe('Goblin');
    });

    it('returns null when no cache set', () => {
      const { getActiveCreatureName } = require('./combatData.js');
      expect(getActiveCreatureName()).toBeNull();
    });
  });

  describe('loadCurrentCombatRound', () => {
    it('returns round from combatSummary', async () => {
      getCombatContextSpy.mockResolvedValue({ round: 5 });
      const { loadCurrentCombatRound } = await import('./combatData.js');
      const result = await loadCurrentCombatRound('testCampaign');
      expect(result).toBe(5);
    });

    it('returns 1 when no round in combatSummary', async () => {
      getCombatContextSpy.mockResolvedValue({});
      const { loadCurrentCombatRound } = await import('./combatData.js');
      const result = await loadCurrentCombatRound('testCampaign');
      expect(result).toBe(1);
    });

    it('returns 1 when API returns null', async () => {
      getCombatContextSpy.mockResolvedValue(null);
      const { loadCurrentCombatRound } = await import('./combatData.js');
      const result = await loadCurrentCombatRound('testCampaign');
      expect(result).toBe(1);
    });
  });

  describe('getCurrentCombatRound', () => {
    it('returns round from cache', async () => {
      getCombatContextSpy.mockResolvedValue({ round: 3 });
      const { loadCombatSummary, getCurrentCombatRound } = await import('./combatData.js');
      await loadCombatSummary('testCampaign');
      expect(getCurrentCombatRound()).toBe(3);
    });

    it('returns 1 when no cache set', () => {
      const { getCurrentCombatRound } = require('./combatData.js');
      expect(getCurrentCombatRound()).toBe(1);
    });

    it('returns 1 when combatSummary has no round', async () => {
      getCombatContextSpy.mockResolvedValue({ creatures: [] });
      const { loadCombatSummary, getCurrentCombatRound } = await import('./combatData.js');
      await loadCombatSummary('testCampaign');
      expect(getCurrentCombatRound()).toBe(1);
    });
  });
});
