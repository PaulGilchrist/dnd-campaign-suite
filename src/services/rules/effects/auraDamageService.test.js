// @maintained-by-ai
// Service-direct lane for auraDamageService.js: internal branch logic that the
// consumer-mock lanes cannot reach.
//
// Regression BUG CLA-170: Holy Nimbus radiant turn-start damage must persist to
// the combat-summary cache + storage queue, never mutate the live React state
// object in place (which React cannot detect), and re-apply on every invocation
// (the orchestrator fires it once per round).
//
// Owned elsewhere, not duplicated here: exact applyDamageToTarget call shapes,
// self-skip, fallback loadCombatSummary, isWithinRange range forwarding —
// applyAuraDamage.test.js (which cites this file for "detached-copy persistence
// + inactive skip"); early-return gates (null summary, non-array creatures,
// damageValue 0/NaN/negative), allyFilter, targetFilter, out-of-range skip,
// per-creature error recovery, event dispatch — expirations_applyAuraDamage.test.js
// via the expirations.js re-export of this same service; dispatcher tick and
// recurrence — turnStartEffects_innerRadiance.test.js and applyTurnStartEffects.test.js;
// distance truth tables — rangeCheck owner lane (#1223).
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

// Faithful-enough fake: decrements currentHp so cache/persistence assertions
// observe real damage arithmetic instead of call bookkeeping.
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
import { getAllyList } from '../../../hooks/useAllySelection.js';
import storage from '../../ui/storage.js';
import { getCombatSummary } from '../../encounters/combatData.js';
import { applyDamageToTarget } from '../combat/applyDamage.js';

const CAMPAIGN = 'test-campaign';

const hpOf = (summary, name) => summary.creatures.find(c => c.name === name).currentHp;

describe('auraDamageService — BUG CLA-170 persistence', () => {
  let paladin;
  let wightSummary;

  beforeEach(() => {
    vi.clearAllMocks();
    storage.set.mockResolvedValue(undefined);
    getAllyList.mockReturnValue(null);
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
    realCache.set(CAMPAIGN, wightSummary);
    getRuntimeValue.mockImplementation((name, key) => {
      if (name === 'ElderPaladin' && key === 'holyNimbusActive') return true;
      return null;
    });
  });

  describe('applyHolyNimbusDamage', () => {
    it('computes proficiency + Charisma (6 + 5 = 11) radiant damage and applies it exactly once to the active target', async () => {
      await applyHolyNimbusDamage('Wight 1', [paladin], CAMPAIGN);

      expect(getRuntimeValue).toHaveBeenCalledWith('ElderPaladin', 'holyNimbusActive', CAMPAIGN);
      expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
      expect(applyDamageToTarget).toHaveBeenCalledWith(
        expect.any(Object), 'Wight 1', 11, ['Radiant'],
        { campaignName: CAMPAIGN, characters: [paladin], ignoreResistance: false, attackerName: 'ElderPaladin' },
      );
    });

    it('replaces the cache with a detached damaged copy and persists that same copy once through the storage queue', async () => {
      const liveStateSummary = wightSummary;

      await applyHolyNimbusDamage('Wight 1', [paladin], CAMPAIGN);

      const cached = getCombatSummary(CAMPAIGN);
      expect(cached).not.toBe(liveStateSummary);
      expect(hpOf(cached, 'Wight 1')).toBe(71);
      expect(hpOf(liveStateSummary, 'Wight 1')).toBe(82);
      expect(storage.set).toHaveBeenCalledTimes(1);
      expect(storage.set).toHaveBeenCalledWith('combatSummary', cached, CAMPAIGN);
    });

    it('re-applies damage on every invocation, building on the already-damaged cache', async () => {
      await applyHolyNimbusDamage('Wight 1', [paladin], CAMPAIGN);
      expect(hpOf(getCombatSummary(CAMPAIGN), 'Wight 1')).toBe(71);

      // Next round: same call against the updated cache — no stored "applied"
      // state may suppress the second tick.
      await applyHolyNimbusDamage('Wight 1', [paladin], CAMPAIGN);

      expect(applyDamageToTarget).toHaveBeenCalledTimes(2);
      expect(hpOf(getCombatSummary(CAMPAIGN), 'Wight 1')).toBe(60);
      expect(hpOf(wightSummary, 'Wight 1')).toBe(82);
    });

    it('does nothing when holyNimbusActive is false', async () => {
      getRuntimeValue.mockReturnValue(null);

      await applyHolyNimbusDamage('Wight 1', [paladin], CAMPAIGN);

      expect(getRuntimeValue).toHaveBeenCalledWith('ElderPaladin', 'holyNimbusActive', CAMPAIGN);
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(getCombatSummary(CAMPAIGN)).toBe(wightSummary);
      expect(storage.set).not.toHaveBeenCalled();
    });

    it('does not damage a target on the caster\'s stored ally list', async () => {
      getAllyList.mockReturnValue(['Wight 1']);

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

      expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
      const cached = getCombatSummary(CAMPAIGN);
      expect(cached).not.toBe(liveStateSummary);
      expect(hpOf(cached, 'Wight 1')).toBe(76);
      expect(hpOf(liveStateSummary, 'Wight 1')).toBe(82);
      expect(storage.set).toHaveBeenCalledTimes(1);
      expect(storage.set).toHaveBeenCalledWith('combatSummary', cached, CAMPAIGN);
    });

    it('skips everything when the aura is inactive', async () => {
      getRuntimeValue.mockReturnValue(null);

      await applyAuraDamage('ElderPaladin', { proficiency: 6 }, CAMPAIGN, [paladin], {
        activeKey: 'innerRadianceActive',
        damageValue: 6,
        range: 10,
      });

      expect(getRuntimeValue).toHaveBeenCalledWith('ElderPaladin', 'innerRadianceActive', CAMPAIGN);
      expect(applyDamageToTarget).not.toHaveBeenCalled();
      expect(getCombatSummary(CAMPAIGN)).toBe(wightSummary);
      expect(storage.set).not.toHaveBeenCalled();
    });
  });
});
