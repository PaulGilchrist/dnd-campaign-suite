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
    level = 1,
    maxHp = 100,
    features = [],
    className = 'Rogue',
    classLevel = 1,
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
    if (key === 'hitPoints') return 100;
    if (key === 'holyAuraSaveDc') return undefined;
    if (key === 'lastMetamagicDamage') return undefined;
    if (key === 'targetEffects') return [];
    if (key === 'tempHp') return 0;
    if (key === 'resistanceUsedThisTurn') return undefined;
    if (key === 'stealthAttackCost') return undefined;
    return undefined;
  });
}

describe('applyDamageToTarget — Relentless Endurance (Orc race trait)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockImplementation(defaultGetRuntimeValue());
  });

  function createOrc(name, opts = {}) {
    const { maxHp = 100 } = opts;
    return makeCreature(name, {
      level: 1,
      computedStats: {
        name,
        level: 1,
        hitPoints: { max: maxHp },
        class: { name: 'Rogue', class_levels: [{ level: 1 }] },
        allFeatures: [{ name: 'Relentless Endurance' }, { name: 'Darkvision' }],
        equipment: [],
      },
    });
  }

  describe('trigger conditions', () => {
    it('sets HP to 1 when dropping to 0 HP', async () => {
      const orc = createOrc('OrcPlayer', { maxHp: 100 });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 100,
      }));

      const result = await applyDamageToTarget(
        cs, 'OrcPlayer', 10, ['Slashing'], campaignName,
        [makeCharacter('OrcPlayer', {
          level: 1, maxHp: 100,
          features: [{ name: 'Relentless Endurance' }],
          className: 'Rogue', classLevel: 1,
        })],
      );

      expect(result.intercepted).toBe(true);
      expect(result.finalDamage).toBe(0);
      expect(result.newHp).toBe(1);
    });

    it('does not trigger if already used this long rest', async () => {
      const orc = createOrc('OrcPlayer2', { maxHp: 100 });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 100,
        relentlessEnduranceUsed: true,
      }));

      const result = await applyDamageToTarget(
        cs, 'OrcPlayer2', 10, ['Slashing'], campaignName,
        [makeCharacter('OrcPlayer2', {
          level: 1, maxHp: 100,
          features: [{ name: 'Relentless Endurance' }],
          className: 'Rogue', classLevel: 1,
        })],
      );

      expect(result.finalDamage).toBe(10);
      expect(result.newHp).toBe(0);
    });

    it('does not trigger if character does not have the trait', async () => {
      const elf = makeCreature('ElfPlayer', {
        level: 1,
        computedStats: {
          name: 'ElfPlayer',
          level: 1,
          hitPoints: { max: 80 },
          class: { name: 'Rogue', class_levels: [{ level: 1 }] },
          allFeatures: [{ name: 'Darkvision' }, { name: 'Fey Ancestry' }],
          equipment: [],
        },
      });
      const cs = makeCombatSummary([elf]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 80,
      }));

      const result = await applyDamageToTarget(
        cs, 'ElfPlayer', 10, ['Slashing'], campaignName,
        [makeCharacter('ElfPlayer', {
          level: 1, maxHp: 80,
          features: [{ name: 'Darkvision' }, { name: 'Fey Ancestry' }],
          className: 'Rogue', classLevel: 1,
        })],
      );

      expect(result.finalDamage).toBe(10);
      expect(result.newHp).toBe(0);
    });
  });

  describe('side effects', () => {
    it('resets death saves and death failures when triggering', async () => {
      const orc = createOrc('OrcPlayer3', { maxHp: 100 });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 100,
      }));

      await applyDamageToTarget(
        cs, 'OrcPlayer3', 10, ['Slashing'], campaignName,
        [makeCharacter('OrcPlayer3', {
          level: 1, maxHp: 100,
          features: [{ name: 'Relentless Endurance' }],
          className: 'Rogue', classLevel: 1,
        })],
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'OrcPlayer3', 'deathSaves', [false, false, false], campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'OrcPlayer3', 'deathFailures', [false, false, false], campaignName,
      );
    });

    it('removes unconscious condition when triggering', async () => {
      const orc = createOrc('OrcPlayer5', { maxHp: 100 });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 100,
        activeConditions: ['unconscious', 'blinded'],
      }));

      await applyDamageToTarget(
        cs, 'OrcPlayer5', 10, ['Slashing'], campaignName,
        [makeCharacter('OrcPlayer5', {
          level: 1, maxHp: 100,
          features: [{ name: 'Relentless Endurance' }],
          className: 'Rogue', classLevel: 1,
        })],
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'OrcPlayer5', 'activeConditions', ['blinded'], campaignName,
      );
    });

    it('marks feature as used when triggering', async () => {
      const orc = createOrc('OrcPlayer4', { maxHp: 100 });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 100,
      }));

      await applyDamageToTarget(
        cs, 'OrcPlayer4', 10, ['Slashing'], campaignName,
        [makeCharacter('OrcPlayer4', {
          level: 1, maxHp: 100,
          features: [{ name: 'Relentless Endurance' }],
          className: 'Rogue', classLevel: 1,
        })],
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'OrcPlayer4', 'relentlessEnduranceUsed', true, campaignName,
      );
    });

    it('logs a heal entry when triggering', async () => {
      const orc = createOrc('OrcPlayer6', { maxHp: 100 });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 100,
      }));

      await applyDamageToTarget(
        cs, 'OrcPlayer6', 10, ['Slashing'], campaignName,
        [makeCharacter('OrcPlayer6', {
          level: 1, maxHp: 100,
          features: [{ name: 'Relentless Endurance' }],
          className: 'Rogue', classLevel: 1,
        })],
      );

      expect(addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'hp_change',
        targetName: 'OrcPlayer6',
        sourceName: 'Relentless Endurance',
      }));
    });
  });

  describe('edge cases', () => {
    it('returns intercepted false when allFeatures is null', async () => {
      const orc = makeCreature('OrcNullFeatures', {
        level: 1,
        computedStats: {
          name: 'OrcNullFeatures',
          level: 1,
          hitPoints: { max: 100 },
          class: { name: 'Rogue', class_levels: [{ level: 1 }] },
          allFeatures: null,
          equipment: [],
        },
      });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 100,
      }));

      const result = await applyDamageToTarget(
        cs, 'OrcNullFeatures', 10, ['Slashing'], campaignName,
        [makeCharacter('OrcNullFeatures', {
          level: 1, maxHp: 100,
          features: null,
          className: 'Rogue', classLevel: 1,
        })],
      );

      expect(result.finalDamage).toBe(10);
      expect(result.newHp).toBe(0);
    });

    it('throws when hitPoints is null from runtime', async () => {
      const orc = createOrc('OrcNoHitPoints', { maxHp: 100 });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: null,
      }));

      await expect(applyDamageToTarget(
        cs, 'OrcNoHitPoints', 10, ['Slashing'], campaignName,
        [makeCharacter('OrcNoHitPoints', {
          level: 1, maxHp: 100,
          features: [{ name: 'Relentless Endurance' }],
          className: 'Rogue', classLevel: 1,
        })],
      )).rejects.toThrow('Relentless Endurance: hitPoints not found for OrcNoHitPoints');
    });

    it('adds damageSequenceId to reTriggeredSequenceIds when Relentless Endurance intercepts', async () => {
      const orc = createOrc('OrcSeqId', { maxHp: 100 });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 100,
      }));

      const result = await applyDamageToTarget(cs, 'OrcSeqId', 10, ['Slashing'], campaignName, [makeCharacter('OrcSeqId', { level: 1, maxHp: 100, features: [{ name: 'Relentless Endurance' }], className: 'Rogue', classLevel: 1, })], { ignoreResistance: false, attackerName: null, suppressHpLog: false, ...{ damageSequenceId: 'seq-123' } },);

      expect(result.intercepted).toBe(true);
      expect(result.newHp).toBe(1);
    });
  });
});
