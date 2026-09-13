// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { addEntry } from '../../ui/logService.js';

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
    level = 15,
    maxHp = 150,
    features = [],
    className = 'Paladin',
    classLevel = 15,
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
    if (key === 'hitPoints') return 150;
    if (key === 'holyAuraSaveDc') return undefined;
    if (key === 'lastMetamagicDamage') return undefined;
    if (key === 'targetEffects') return [];
    if (key === 'tempHp') return 0;
    if (key === 'resistanceUsedThisTurn') return undefined;
    if (key === 'stealthAttackCost') return undefined;
    return undefined;
  });
}

describe('applyDamageToTarget — Undying Sentinel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation(defaultGetRuntimeValue());
  });

  function createPaladin(name, opts = {}) {
    const { level = 15, maxHp = 150 } = opts;
    return makeCreature(name, {
      level,
      computedStats: {
        name,
        level,
        hitPoints: { max: maxHp },
        class: { name: 'Paladin', class_levels: [{ level }] },
        allFeatures: [{ name: 'Undying Sentinel' }, { name: 'Other Feature' }],
        equipment: [],
      },
    });
  }

  describe('trigger conditions', () => {
    it('heals to 1 + (3 x paladin level) when dropping to 0 HP', async () => {
      const paladin = createPaladin('GloryPaladin', { level: 15, maxHp: 150 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 150,
      }));

      const result = await applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], { campaignName, characters: [makeCharacter('GloryPaladin', { level: 15, maxHp: 150, features: [{ name: 'Undying Sentinel' }] })] });

      expect(result.intercepted).toBe(true);
      expect(result.finalDamage).toBe(0);
      expect(result.newHp).toBe(46); // 1 + (3 * 15)
    });

    it('caps healing at max HP', async () => {
      const paladin = createPaladin('GloryPaladin', { level: 20, maxHp: 50 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 5,
        hitPoints: 50,
      }));

      const result = await applyDamageToTarget(cs, 'GloryPaladin', 5, ['Slashing'], { campaignName, characters: [makeCharacter('GloryPaladin', { level: 20, maxHp: 50, features: [{ name: 'Undying Sentinel' }] })] });

      expect(result.intercepted).toBe(true);
      expect(result.newHp).toBe(50); // capped at maxHp, not 61
    });

    it('does not trigger when HP is still above 0', async () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 5,
        hitPoints: 150,
      }));

      const result = await applyDamageToTarget(cs, 'GloryPaladin', 3, ['Slashing'], { campaignName, characters: [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })] });

      expect(result.finalDamage).toBe(3);
      expect(result.newHp).toBe(2);
    });

    it('does not trigger when damage is absorbed by Arcane Ward', async () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 150,
        arcaneWardActive: true,
        arcaneWardHp: 20,
      }));

      const result = await applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], { campaignName, characters: [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })] });

      expect(result.finalDamage).toBe(10);
      expect(result.newHp).toBe(10); // HP unchanged, ward absorbed the damage
    });

    it('does not trigger if feature is not present on the character', async () => {
      const fighter = makeCreature('Fighter', {
        level: 15,
        computedStats: {
          name: 'Fighter',
          level: 15,
          hitPoints: { max: 120 },
          class: { name: 'Fighter', class_levels: [{ level: 15 }] },
          allFeatures: [{ name: 'Extra Attack' }],
          equipment: [],
        },
      });
      const cs = makeCombatSummary([fighter]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 5,
        hitPoints: 120,
      }));

      const result = await applyDamageToTarget(cs, 'Fighter', 5, ['Slashing'], { campaignName, characters: [makeCharacter('Fighter', { level: 15, maxHp: 120, features: [{ name: 'Extra Attack' }], className: 'Fighter', classLevel: 15 })] });

      expect(result.finalDamage).toBe(5);
      expect(result.newHp).toBe(0);
    });
  });

  describe('per-long-rest tracking', () => {
    it('does not trigger if already used this long rest', async () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 150,
        undyingSentinelUsed: true,
      }));

      const result = await applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], { campaignName, characters: [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })] });

      expect(result.finalDamage).toBe(10);
      expect(result.newHp).toBe(0);
    });

    it('marks feature as used when triggering', async () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 150,
      }));

      await applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], { campaignName, characters: [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })] });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'GloryPaladin', 'undyingSentinelUsed', true, campaignName,
      );
    });
  });

  describe('side effects', () => {
    it('resets death saves and death failures when triggering', async () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 150,
      }));

      await applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], { campaignName, characters: [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })] });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'GloryPaladin', 'deathSaves', [false, false, false], campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'GloryPaladin', 'deathFailures', [false, false, false], campaignName,
      );
    });

    it('removes unconscious condition when triggering', async () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 150,
        activeConditions: ['unconscious', 'blinded'],
      }));

      await applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], { campaignName, characters: [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })] });

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'GloryPaladin', 'activeConditions', ['blinded'], campaignName,
      );
    });

    it('logs a heal entry when triggering', async () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 150,
      }));

      await applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], { campaignName, characters: [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })] });

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'healing',
        targetName: 'GloryPaladin',
        sourceName: 'Undying Sentinel',
        isHealing: true,
      }));
    });
  });

  describe('scaling', () => {
    it('scales healing with paladin level', async () => {
      const paladin = createPaladin('GloryPaladin', { level: 20, maxHp: 200 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 5,
        hitPoints: 200,
      }));

      const result = await applyDamageToTarget(cs, 'GloryPaladin', 5, ['Slashing'], { campaignName, characters: [makeCharacter('GloryPaladin', { level: 20, maxHp: 200, features: [{ name: 'Undying Sentinel' }] })] });

      expect(result.intercepted).toBe(true);
      expect(result.newHp).toBe(61); // 1 + (3 * 20)
      expect(result.finalDamage).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('throws when hitPoints is null from runtime', async () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: null,
      }));

      await expect(applyDamageToTarget(cs, 'GloryPaladin', 10, ['Slashing'], { campaignName, characters: [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })] })).rejects.toThrow('Undying Sentinel: hitPoints not found for GloryPaladin');
    });
  });
});
