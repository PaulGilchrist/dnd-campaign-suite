// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';

const campaignName = 'TestCampaign';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../ui/utils.js', () => ({ default: { guid: vi.fn(() => 'test-guid-001') } }));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

// Suppress CustomEvent dispatch in tests — produce a real Event
const OriginalCustomEvent = window.CustomEvent;
beforeEach(() => {
  window.CustomEvent = function (type) { return new Event(type); };
});
afterAll(() => {
  window.CustomEvent = OriginalCustomEvent;
});

// Prevent unhandled fetch rejections in tests
globalThis.fetch = vi.fn(() => new Promise(() => {}));

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

function makeCreature(name, extra = {}) {
  return {
    name,
    type: 'player',
    maxHp: 30,
    currentHp: 30,
    resistances: [],
    immunities: [],
    conditions: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function makeCharacter(name, opts = {}) {
  const {
    level = 20,
    maxHp = 180,
    features = [],
    className = 'Paladin',
    classLevel = 20,
  } = opts;
  return {
    name,
    computedStats: {
      name,
      level,
      hitPoints: { max: maxHp },
      class: { name: className, class_levels: [{ level: classLevel }] },
      allFeatures: features,
      equipment: [],
    },
  };
}

/**
 * Returns a default getRuntimeValue implementation that provides sensible
 * defaults for the keys the tested code paths read.  Each test can layer
 * specific overrides on top by calling the returned function with a map
 * of { key: value } pairs.
 */
function defaultGetRuntimeValue(overrides = {}) {
  return vi.fn((charName, key, _campaign) => {
    const keyOverride = overrides[key];
    if (keyOverride !== undefined) return keyOverride;
    if (key === 'activeConditions') return [];
    if (key === 'activeBuffs') return [];
    if (key === 'arcaneWardActive') return undefined;
    if (key === 'undyingSentinelUsed' || key === 'relentlessEnduranceUsed' || key === 'boonOfRecoveryLastStandUsed') return false;
    if (key === 'currentHitPoints') return 10;
    if (key === 'hitPoints') return 180;
    if (key === 'holyAuraSaveDc') return undefined;
    if (key === 'lastMetamagicDamage') return undefined;
    if (key === 'targetEffects') return [];
    if (key === 'tempHp') return 0;
    if (key === 'resistanceUsedThisTurn') return undefined;
    if (key === 'stealthAttackCost') return undefined;
    return undefined;
  });
}

describe('applyDamageToTarget — Boon of Recovery (Last Stand)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation(defaultGetRuntimeValue());
  });

  function createCharacterWithBoon(name, opts = {}) {
    const { level = 20, maxHp = 180 } = opts;
    return makeCreature(name, {
      level,
      computedStats: {
        name,
        level,
        hitPoints: { max: maxHp },
        class: { name: 'Paladin', class_levels: [{ level }] },
        allFeatures: [{ name: 'Last Stand' }, { name: 'Other Feature' }],
        equipment: [],
      },
    });
  }

  describe('trigger conditions', () => {
    it('heals to 1 + half max HP when dropping to 0 HP', async () => {
      const char = createCharacterWithBoon('BoonChar', { level: 20, maxHp: 180 });
      const cs = makeCombatSummary([char]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 180,
      }));

      const result = await applyDamageToTarget(cs, 'BoonChar', 10, ['Slashing'], { campaignName, characters: [makeCharacter('BoonChar', { level: 20, maxHp: 180, features: [{ name: 'Last Stand' }], className: 'Paladin', classLevel: 20, })] });

      expect(result.intercepted).toBe(true);
      expect(result.finalDamage).toBe(0);
      expect(result.newHp).toBe(91); // 1 + floor(180/2)
    });

    it('does not trigger if already used this long rest', async () => {
      const char = createCharacterWithBoon('BoonChar', { level: 20 });
      const cs = makeCombatSummary([char]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 180,
        boonOfRecoveryLastStandUsed: true,
      }));

      const result = await applyDamageToTarget(cs, 'BoonChar', 10, ['Slashing'], { campaignName, characters: [makeCharacter('BoonChar', { level: 20, maxHp: 180, features: [{ name: 'Last Stand' }], className: 'Paladin', classLevel: 20, })] });

      expect(result.finalDamage).toBe(10);
      expect(result.newHp).toBe(0);
    });

    it('does not trigger if feature is not present', async () => {
      const fighter = makeCreature('Fighter', {
        level: 20,
        computedStats: {
          name: 'Fighter',
          level: 20,
          hitPoints: { max: 200 },
          class: { name: 'Fighter', class_levels: [{ level: 20 }] },
          allFeatures: [{ name: 'Extra Attack' }],
          equipment: [],
        },
      });
      const cs = makeCombatSummary([fighter]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 200,
      }));

      const result = await applyDamageToTarget(cs, 'Fighter', 10, ['Slashing'], { campaignName, characters: [makeCharacter('Fighter', { level: 20, maxHp: 200, features: [{ name: 'Extra Attack' }], className: 'Fighter', classLevel: 20, })] });

      expect(result.finalDamage).toBe(10);
      expect(result.newHp).toBe(0);
    });
  });

  describe('side effects', () => {
    it('resets death saves and removes unconscious condition when triggering', async () => {
      const char = createCharacterWithBoon('BoonChar', { level: 20 });
      const cs = makeCombatSummary([char]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 180,
        activeConditions: ['unconscious'],
      }));

      await applyDamageToTarget(cs, 'BoonChar', 10, ['Slashing'], { campaignName, characters: [makeCharacter('BoonChar', { level: 20, maxHp: 180, features: [{ name: 'Last Stand' }], className: 'Paladin', classLevel: 20, })] });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'BoonChar', 'deathSaves', [false, false, false], campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'BoonChar', 'deathFailures', [false, false, false], campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'BoonChar', 'activeConditions', [], campaignName,
      );
    });

    it('marks feature as used when triggering', async () => {
      const char = createCharacterWithBoon('BoonChar', { level: 20 });
      const cs = makeCombatSummary([char]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 180,
      }));

      await applyDamageToTarget(cs, 'BoonChar', 10, ['Slashing'], { campaignName, characters: [makeCharacter('BoonChar', { level: 20, maxHp: 180, features: [{ name: 'Last Stand' }], className: 'Paladin', classLevel: 20, })] });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'BoonChar', 'boonOfRecoveryLastStandUsed', true, campaignName,
      );
    });
  });

  describe('edge cases', () => {
    it('throws when hitPoints is null from runtime', async () => {
      const char = createCharacterWithBoon('BoonChar', { level: 20 });
      const cs = makeCombatSummary([char]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: null,
      }));

      await expect(applyDamageToTarget(cs, 'BoonChar', 10, ['Slashing'], { campaignName, characters: [makeCharacter('BoonChar', { level: 20, maxHp: 180, features: [{ name: 'Last Stand' }], className: 'Paladin', classLevel: 20, })] })).rejects.toThrow('Last Stand: hitPoints not found for BoonChar');
    });
  });
});
