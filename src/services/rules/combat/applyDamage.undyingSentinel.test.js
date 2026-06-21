// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { postLogEntry } from '../../shared/logPoster.js';

const campaignName = 'TestCampaign';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
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

vi.mock('../../shared/logPoster.js', () => ({
  postLogEntry: vi.fn(),
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
    it('heals to 1 + (3 x paladin level) when dropping to 0 HP', () => {
      const paladin = createPaladin('GloryPaladin', { level: 15, maxHp: 150 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 150,
      }));

      const result = applyDamageToTarget(
        cs, 'GloryPaladin', 10, ['Slashing'], campaignName,
        [makeCharacter('GloryPaladin', { level: 15, maxHp: 150, features: [{ name: 'Undying Sentinel' }] })],
      );

      expect(result.intercepted).toBe(true);
      expect(result.finalDamage).toBe(0);
      expect(result.newHp).toBe(46); // 1 + (3 * 15)
    });

    it('caps healing at max HP', () => {
      const paladin = createPaladin('GloryPaladin', { level: 20, maxHp: 50 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 5,
        hitPoints: 50,
      }));

      const result = applyDamageToTarget(
        cs, 'GloryPaladin', 5, ['Slashing'], campaignName,
        [makeCharacter('GloryPaladin', { level: 20, maxHp: 50, features: [{ name: 'Undying Sentinel' }] })],
      );

      expect(result.intercepted).toBe(true);
      expect(result.newHp).toBe(50); // capped at maxHp, not 61
    });

    it('does not trigger when HP is still above 0', () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 5,
        hitPoints: 150,
      }));

      const result = applyDamageToTarget(
        cs, 'GloryPaladin', 3, ['Slashing'], campaignName,
        [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })],
      );

      expect(result.finalDamage).toBe(3);
      expect(result.newHp).toBe(2);
    });

    it('does not trigger when damage is absorbed by Arcane Ward', () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 150,
        arcaneWardActive: true,
        arcaneWardHp: 20,
      }));

      const result = applyDamageToTarget(
        cs, 'GloryPaladin', 10, ['Slashing'], campaignName,
        [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })],
      );

      expect(result.finalDamage).toBe(10);
      expect(result.newHp).toBe(10); // HP unchanged, ward absorbed the damage
    });

    it('does not trigger if feature is not present on the character', () => {
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

      const result = applyDamageToTarget(
        cs, 'Fighter', 5, ['Slashing'], campaignName,
        [makeCharacter('Fighter', { level: 15, maxHp: 120, features: [{ name: 'Extra Attack' }], className: 'Fighter', classLevel: 15 })],
      );

      expect(result.finalDamage).toBe(5);
      expect(result.newHp).toBe(0);
    });
  });

  describe('per-long-rest tracking', () => {
    it('does not trigger if already used this long rest', () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 150,
        undyingSentinelUsed: true,
      }));

      const result = applyDamageToTarget(
        cs, 'GloryPaladin', 10, ['Slashing'], campaignName,
        [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })],
      );

      expect(result.finalDamage).toBe(10);
      expect(result.newHp).toBe(0);
    });

    it('marks feature as used when triggering', () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 150,
      }));

      applyDamageToTarget(
        cs, 'GloryPaladin', 10, ['Slashing'], campaignName,
        [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })],
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'GloryPaladin', 'undyingSentinelUsed', true, campaignName,
      );
    });
  });

  describe('side effects', () => {
    it('resets death saves and death failures when triggering', () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 150,
      }));

      applyDamageToTarget(
        cs, 'GloryPaladin', 10, ['Slashing'], campaignName,
        [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })],
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'GloryPaladin', 'deathSaves', [false, false, false], campaignName,
      );
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'GloryPaladin', 'deathFailures', [false, false, false], campaignName,
      );
    });

    it('removes unconscious condition when triggering', () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 150,
        activeConditions: ['unconscious', 'blinded'],
      }));

      applyDamageToTarget(
        cs, 'GloryPaladin', 10, ['Slashing'], campaignName,
        [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })],
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'GloryPaladin', 'activeConditions', ['blinded'], campaignName,
      );
    });

    it('logs a heal entry when triggering', () => {
      const paladin = createPaladin('GloryPaladin', { level: 15 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 150,
      }));

      applyDamageToTarget(
        cs, 'GloryPaladin', 10, ['Slashing'], campaignName,
        [makeCharacter('GloryPaladin', { level: 15, features: [{ name: 'Undying Sentinel' }] })],
      );

      expect(postLogEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'heal',
        targetName: 'GloryPaladin',
        abilityName: 'Undying Sentinel',
        isHealing: true,
      }));
    });
  });

  describe('scaling', () => {
    it('scales healing with paladin level', () => {
      const paladin = createPaladin('GloryPaladin', { level: 20, maxHp: 200 });
      const cs = makeCombatSummary([paladin]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 5,
        hitPoints: 200,
      }));

      const result = applyDamageToTarget(
        cs, 'GloryPaladin', 5, ['Slashing'], campaignName,
        [makeCharacter('GloryPaladin', { level: 20, maxHp: 200, features: [{ name: 'Undying Sentinel' }] })],
      );

      expect(result.intercepted).toBe(true);
      expect(result.newHp).toBe(61); // 1 + (3 * 20)
      expect(result.finalDamage).toBe(0);
    });
  });
});

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
        allFeatures: [{ name: 'Boon Of Recovery' }, { name: 'Other Feature' }],
        equipment: [],
      },
    });
  }

  describe('trigger conditions', () => {
    it('heals to 1 + half max HP when dropping to 0 HP', () => {
      const char = createCharacterWithBoon('BoonChar', { level: 20, maxHp: 180 });
      const cs = makeCombatSummary([char]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 180,
      }));

      const result = applyDamageToTarget(
        cs, 'BoonChar', 10, ['Slashing'], campaignName,
        [makeCharacter('BoonChar', {
          level: 20, maxHp: 180,
          features: [{ name: 'Boon Of Recovery' }],
          className: 'Paladin', classLevel: 20,
        })],
      );

      expect(result.intercepted).toBe(true);
      expect(result.finalDamage).toBe(0);
      expect(result.newHp).toBe(91); // 1 + floor(180/2)
    });

    it('does not trigger if already used this long rest', () => {
      const char = createCharacterWithBoon('BoonChar', { level: 20 });
      const cs = makeCombatSummary([char]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 180,
        boonOfRecoveryLastStandUsed: true,
      }));

      const result = applyDamageToTarget(
        cs, 'BoonChar', 10, ['Slashing'], campaignName,
        [makeCharacter('BoonChar', {
          level: 20, maxHp: 180,
          features: [{ name: 'Boon Of Recovery' }],
          className: 'Paladin', classLevel: 20,
        })],
      );

      expect(result.finalDamage).toBe(10);
      expect(result.newHp).toBe(0);
    });

    it('does not trigger if feature is not present', () => {
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

      const result = applyDamageToTarget(
        cs, 'Fighter', 10, ['Slashing'], campaignName,
        [makeCharacter('Fighter', {
          level: 20, maxHp: 200,
          features: [{ name: 'Extra Attack' }],
          className: 'Fighter', classLevel: 20,
        })],
      );

      expect(result.finalDamage).toBe(10);
      expect(result.newHp).toBe(0);
    });
  });

  describe('side effects', () => {
    it('resets death saves and removes unconscious condition when triggering', () => {
      const char = createCharacterWithBoon('BoonChar', { level: 20 });
      const cs = makeCombatSummary([char]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 180,
        activeConditions: ['unconscious'],
      }));

      applyDamageToTarget(
        cs, 'BoonChar', 10, ['Slashing'], campaignName,
        [makeCharacter('BoonChar', {
          level: 20, maxHp: 180,
          features: [{ name: 'Boon Of Recovery' }],
          className: 'Paladin', classLevel: 20,
        })],
      );

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

    it('marks feature as used when triggering', () => {
      const char = createCharacterWithBoon('BoonChar', { level: 20 });
      const cs = makeCombatSummary([char]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 180,
      }));

      applyDamageToTarget(
        cs, 'BoonChar', 10, ['Slashing'], campaignName,
        [makeCharacter('BoonChar', {
          level: 20, maxHp: 180,
          features: [{ name: 'Boon Of Recovery' }],
          className: 'Paladin', classLevel: 20,
        })],
      );

      expect(setRuntimeValue).toHaveBeenCalledWith(
        'BoonChar', 'boonOfRecoveryLastStandUsed', true, campaignName,
      );
    });
  });
});

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
    it('sets HP to 1 when dropping to 0 HP', () => {
      const orc = createOrc('OrcPlayer', { maxHp: 100 });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 100,
      }));

      const result = applyDamageToTarget(
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

    it('does not trigger if already used this long rest', () => {
      const orc = createOrc('OrcPlayer2', { maxHp: 100 });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 100,
        relentlessEnduranceUsed: true,
      }));

      const result = applyDamageToTarget(
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

    it('does not trigger if character does not have the trait', () => {
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

      const result = applyDamageToTarget(
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
    it('resets death saves and death failures when triggering', () => {
      const orc = createOrc('OrcPlayer3', { maxHp: 100 });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 100,
      }));

      applyDamageToTarget(
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

    it('removes unconscious condition when triggering', () => {
      const orc = createOrc('OrcPlayer5', { maxHp: 100 });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 100,
        activeConditions: ['unconscious', 'blinded'],
      }));

      applyDamageToTarget(
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

    it('marks feature as used when triggering', () => {
      const orc = createOrc('OrcPlayer4', { maxHp: 100 });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 100,
      }));

      applyDamageToTarget(
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

    it('logs a heal entry when triggering', () => {
      const orc = createOrc('OrcPlayer6', { maxHp: 100 });
      const cs = makeCombatSummary([orc]);

      getRuntimeValue.mockImplementation(defaultGetRuntimeValue({
        currentHitPoints: 10,
        hitPoints: 100,
      }));

      applyDamageToTarget(
        cs, 'OrcPlayer6', 10, ['Slashing'], campaignName,
        [makeCharacter('OrcPlayer6', {
          level: 1, maxHp: 100,
          features: [{ name: 'Relentless Endurance' }],
          className: 'Rogue', classLevel: 1,
        })],
      );

      expect(postLogEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
        type: 'heal',
        targetName: 'OrcPlayer6',
        abilityName: 'Relentless Endurance',
        isHealing: true,
      }));
    });
  });
});
