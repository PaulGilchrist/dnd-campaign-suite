import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as damageUtils from '../rules/combat/damageUtils.js';

describe('combatData', () => {
  let getCombatContextSpy;

  beforeEach(() => {
    localStorage.clear();
    getCombatContextSpy = vi.spyOn(damageUtils, 'getCombatContext');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadCombatSummary', () => {
    it('reads from localStorage when no campaignName', async () => {
      getCombatContextSpy.mockResolvedValue(null);
      localStorage.setItem('combatSummary', JSON.stringify({ round: 3 }));
      const { loadCombatSummary } = await import('./combatData.js');
      const result = await loadCombatSummary(null);
      expect(result).toEqual({ round: 3 });
    });

    it('returns null from API when campaignName but API returns null (no localStorage fallback)', async () => {
      getCombatContextSpy.mockResolvedValue(null);
      localStorage.setItem('combatSummary', JSON.stringify({ round: 2 }));
      const { loadCombatSummary } = await import('./combatData.js');
      const result = await loadCombatSummary('testCampaign');
      expect(result).toBeNull();
    });

    it('writes to localStorage when API returns data', async () => {
      getCombatContextSpy.mockResolvedValue({ round: 5, creatures: [] });
      const { loadCombatSummary } = await import('./combatData.js');
      const result = await loadCombatSummary('testCampaign');
      expect(result).toEqual({ round: 5, creatures: [] });
      expect(localStorage.getItem('combatSummary')).toBe(JSON.stringify({ round: 5, creatures: [] }));
    });

    it('returns null when API call fails', async () => {
      getCombatContextSpy.mockRejectedValue(new Error('network error'));
      localStorage.removeItem('combatSummary');
      const { loadCombatSummary } = await import('./combatData.js');
      const result = await loadCombatSummary('testCampaign');
      expect(result).toBeNull();
    });

    it('returns null when localStorage has no data and no campaignName', async () => {
      getCombatContextSpy.mockResolvedValue(null);
      localStorage.removeItem('combatSummary');
      const { loadCombatSummary } = await import('./combatData.js');
      const result = await loadCombatSummary(null);
      expect(result).toBeNull();
    });
  });

  describe('getCombatSummary', () => {
    it('reads from localStorage', () => {
      localStorage.setItem('combatSummary', JSON.stringify({ round: 4 }));
      const { getCombatSummary } = require('./combatData.js');
      expect(getCombatSummary()).toEqual({ round: 4 });
    });

    it('returns null when no data in localStorage', () => {
      localStorage.removeItem('combatSummary');
      const { getCombatSummary } = require('./combatData.js');
      expect(getCombatSummary()).toBeNull();
    });
  });

  describe('loadActiveCreatureName', () => {
    it('reads from localStorage when no campaignName', async () => {
      getCombatContextSpy.mockResolvedValue(null);
      localStorage.setItem('activeCreatureName', JSON.stringify('Goblin'));
      const { loadActiveCreatureName } = await import('./combatData.js');
      const result = await loadActiveCreatureName(null);
      expect(result).toBe('Goblin');
    });

    it('reads from API and writes to localStorage', async () => {
      getCombatContextSpy.mockResolvedValue({ round: 1, activeCreatureName: 'Orc' });
      const { loadActiveCreatureName } = await import('./combatData.js');
      const result = await loadActiveCreatureName('testCampaign');
      expect(result).toBe('Orc');
      expect(localStorage.getItem('activeCreatureName')).toBe('"Orc"');
    });

    it('returns null when API returns no activeCreatureName', async () => {
      getCombatContextSpy.mockResolvedValue({ round: 1 });
      const { loadActiveCreatureName } = await import('./combatData.js');
      const result = await loadActiveCreatureName('testCampaign');
      expect(result).toBeNull();
    });

    it('falls through to localStorage when API fails', async () => {
      getCombatContextSpy.mockRejectedValue(new Error('network error'));
      localStorage.setItem('activeCreatureName', JSON.stringify('Goblin'));
      const { loadActiveCreatureName } = await import('./combatData.js');
      const result = await loadActiveCreatureName('testCampaign');
      expect(result).toBe('Goblin');
    });
  });

  describe('getActiveCreatureName', () => {
    it('reads from localStorage', () => {
      localStorage.setItem('activeCreatureName', JSON.stringify('Goblin'));
      const { getActiveCreatureName } = require('./combatData.js');
      expect(getActiveCreatureName()).toBe('Goblin');
    });

    it('returns null when no data in localStorage', () => {
      localStorage.removeItem('activeCreatureName');
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
    it('returns round from localStorage', () => {
      localStorage.setItem('combatSummary', JSON.stringify({ round: 3 }));
      const { getCurrentCombatRound } = require('./combatData.js');
      expect(getCurrentCombatRound()).toBe(3);
    });

    it('returns 1 when no data in localStorage', () => {
      localStorage.removeItem('combatSummary');
      const { getCurrentCombatRound } = require('./combatData.js');
      expect(getCurrentCombatRound()).toBe(1);
    });

    it('returns 1 when combatSummary has no round', () => {
      localStorage.setItem('combatSummary', JSON.stringify({ creatures: [] }));
      const { getCurrentCombatRound } = require('./combatData.js');
      expect(getCurrentCombatRound()).toBe(1);
    });
  });
});
