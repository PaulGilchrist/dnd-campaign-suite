// @improved-by-ai
// Regression tests for BUG CLA-170: Holy Nimbus radiant turn-start damage must
// persist to the combat summary cache + server and re-apply on every round,
// without mutating the live React state object in place (which React cannot detect).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => null),
}));

vi.mock('../../ui/utils.js', () => ({
  default: {
    getName: vi.fn((val) => String(val)),
  },
}));

vi.mock('../../ui/storage.js', () => ({
  default: {
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

const realCache = new Map();

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn((campaignName) => realCache.get(campaignName) ?? null),
  loadCombatSummary: vi.fn().mockResolvedValue(null),
  setCombatSummaryCache: vi.fn((summary, campaignName) => {
    if (summary === null) {
      realCache.delete(campaignName);
    } else {
      realCache.set(campaignName, summary);
    }
  }),
}));

vi.mock('../combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn().mockResolvedValue(true),
}));

vi.mock('../combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn((summary, targetName, damageValue) => {
    const creature = summary.creatures.find(c => c.name === targetName);
    if (creature) {
      creature.currentHp = Math.max(0, (creature.currentHp ?? 0) - damageValue);
    }
  }),
}));

import { applyAuraDamage, applyHolyNimbusDamage } from './auraDamageService.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import storage from '../../ui/storage.js';
import { getCombatSummary, setCombatSummaryCache } from '../../encounters/combatData.js';
import { applyDamageToTarget } from '../combat/applyDamage.js';

const CAMPAIGN = 'test-campaign';

function seedCache(summary) {
  realCache.set(CAMPAIGN, summary);
}

describe('auraDamageService — BUG CLA-170 persistence', () => {
  let paladin;
  let wightSummary;

  beforeEach(() => {
    vi.clearAllMocks();
    storage.set.mockResolvedValue(undefined);
    paladin = {
      name: 'ElderPaladin',
      computedStats: {
        proficiency: 6,
        abilities: [{ name: 'Charisma', bonus: 5 }],
      },
    };
    wightSummary = {
      round: 1,
      creatures: [
        { name: 'ElderPaladin', type: 'player', currentHp: 180, maxHp: 180 },
        { name: 'Wight 1', type: 'npc', currentHp: 82, maxHp: 82 },
      ],
    };
    seedCache(wightSummary);
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'ElderPaladin' && key === 'holyNimbusActive') return true;
      return null;
    });
  });

  describe('applyHolyNimbusDamage', () => {
    it('computes CHA + PB radiant damage and applies it to the active enemy', async () => {
      await applyHolyNimbusDamage('Wight 1', [paladin], CAMPAIGN);

      expect(applyDamageToTarget).toHaveBeenCalledWith(expect.any(Object), 'Wight 1', 11, ['Radiant'], CAMPAIGN, [paladin], { ignoreResistance: false, attackerName: 'ElderPaladin' },);
    });

    it('replaces the combat summary cache with the damaged copy (detached from live state)', async () => {
      const liveStateSummary = wightSummary;
      await applyHolyNimbusDamage('Wight 1', [paladin], CAMPAIGN);

      expect(setCombatSummaryCache).toHaveBeenCalled();
      const newCache = getCombatSummary(CAMPAIGN);
      expect(newCache).not.toBe(liveStateSummary);
      expect(newCache.creatures.find(c => c.name === 'Wight 1').currentHp).toBe(71);
      expect(liveStateSummary.creatures.find(c => c.name === 'Wight 1').currentHp).toBe(82);
    });

    it('persists the damaged summary once through the storage queue (no direct fetch)', async () => {
      await applyHolyNimbusDamage('Wight 1', [paladin], CAMPAIGN);

      const persistedCall = storage.set.mock.calls.find(c => c[0] === 'combatSummary');
      expect(persistedCall).toBeDefined();
      expect(persistedCall[1].creatures.find(c => c.name === 'Wight 1').currentHp).toBe(71);
    });

    it('re-applies radiant damage when called again on a later round', async () => {
      await applyHolyNimbusDamage('Wight 1', [paladin], CAMPAIGN);
      expect(getCombatSummary(CAMPAIGN).creatures.find(c => c.name === 'Wight 1').currentHp).toBe(71);

      seedCache({ ...getCombatSummary(CAMPAIGN), round: 2 });
      await applyHolyNimbusDamage('Wight 1', [paladin], CAMPAIGN);

      expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
      expect(getCombatSummary(CAMPAIGN).creatures.find(c => c.name === 'Wight 1').currentHp).toBe(60);
    });

    it('does nothing when holyNimbusActive is false', async () => {
      getRuntimeValue.mockReturnValue(null);
      await applyHolyNimbusDamage('Wight 1', [paladin], CAMPAIGN);

      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
    });
  });

  describe('applyAuraDamage', () => {
    it('replaces the cache with a detached damaged copy and persists it', async () => {
      getRuntimeValue.mockImplementation((name, key) => {
        if (key === 'innerRadianceActive') return true;
        return null;
      });
      const liveStateSummary = wightSummary;

      await applyAuraDamage('ElderPaladin', { proficiency: 6 }, CAMPAIGN, [paladin], {
        activeKey: 'innerRadianceActive',
        damageValue: 6,
        range: 10,
        damageType: 'Radiant',
      });

      const newCache = getCombatSummary(CAMPAIGN);
      expect(newCache).not.toBe(liveStateSummary);
      expect(newCache.creatures.find(c => c.name === 'Wight 1').currentHp).toBe(76);
      expect(liveStateSummary.creatures.find(c => c.name === 'Wight 1').currentHp).toBe(82);
      const persistedCall = storage.set.mock.calls.find(c => c[0] === 'combatSummary');
      expect(persistedCall[1].creatures.find(c => c.name === 'Wight 1').currentHp).toBe(76);
    });

    it('skips everything when the aura is inactive', async () => {
      getRuntimeValue.mockReturnValue(null);
      await applyAuraDamage('ElderPaladin', { proficiency: 6 }, CAMPAIGN, [paladin], {
        activeKey: 'innerRadianceActive',
        damageValue: 6,
        range: 10,
      });

      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(storage.set).not.toHaveBeenCalled();
    });
  });
});
