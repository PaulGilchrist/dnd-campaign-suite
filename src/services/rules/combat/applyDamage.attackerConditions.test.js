// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { processTashasLaughterRepeatSave } from '../../automation/handlers/spells/tashasLaughterHandler.js';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

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

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn().mockResolvedValue(undefined),
  handle: vi.fn(),
}));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

vi.mock('../../rules/features/silenceService.js', () => ({
  isCreatureInSilenceZone: vi.fn(() => false),
}));

vi.mock('../../combat/automation/automationPassives.js', () => ({
  getDamageReduction: vi.fn(() => null),
  getDamageResistances: vi.fn(() => []),
}));

// ── Globals ─────────────────────────────────────────────────────

global.fetch = vi.fn(() => new Promise(() => {}));

// ── Helpers ─────────────────────────────────────────────────────

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
}

function createNpcCreature(name, maxHp, currentHp, extra = {}) {
  return {
    name,
    type: 'monster',
    maxHp,
    currentHp,
    resistances: [],
    immunities: [],
    conditions: [],
    template: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function createMinimalCharacter(name, extra = {}) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: { passives: [] },
      ...extra.computedExtra,
    },
    ...extra,
  };
}

function stubNpcRuntime(currentHp, conditions = [], extraOverrides = {}) {
  getRuntimeValue.mockReset();
  getRuntimeValue
    .mockImplementation((_charName, key, _campaignName) => {
      if (extraOverrides[key] !== undefined) return extraOverrides[key];
      if (key === 'activeBuffs') return [];
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return currentHp;
      if (key === 'activeConditions') return conditions;
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') return undefined;
      if (key === 'targetEffects') return [];
      if (key === 'tempHp') return 0;
      if (key === 'resistanceUsedThisTurn') return undefined;
      return undefined;
    });
}

function createPlayerCreature(name, extra = {}) {
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

// ── Tests ───────────────────────────────────────────────────────

describe('Tasha\'s Hideous Laughter — damage-triggered repeat save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
    processTashasLaughterRepeatSave.mockResolvedValue(undefined);
  });

  it('triggers repeat WIS save with Advantage when incapacitated creature takes damage', () => {
    const barbarian = createNpcCreature('Barbarian', 20, 20, {
      conditions: ['incapacitated'],
    });
    const cs = makeCombatSummary([barbarian]);

    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((_charName, key, _campaignName) => {
      if (key === 'activeBuffs') return [];
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') return [];
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') return undefined;
      if (key === 'targetEffects') return [{ target: 'Barbarian', effect: 'tashas_laughter_repeat_save', source: 'Bard', dc: 13 }];
      if (key === 'tempHp') return 0;
      if (key === 'resistanceUsedThisTurn') return undefined;
      return undefined;
    });

    applyDamageToTarget(cs, 'Barbarian', 5, ['Slashing'], 'TestCampaign', [
      createMinimalCharacter('Barbarian'),
    ]);

    expect(processTashasLaughterRepeatSave).toHaveBeenCalledWith(
      'Bard', 'Barbarian', 13, 'TestCampaign',
    );
  });

  it('does not trigger when creature lacks incapacitated condition', () => {
    const goblin = createNpcCreature('Goblin', 10, 10, {
      conditions: ['frightened'],
    });
    const cs = makeCombatSummary([goblin]);
    stubNpcRuntime(10);
    applyDamageToTarget(cs, 'Goblin', 5, ['Slashing'], 'TestCampaign', [
      createMinimalCharacter('Goblin'),
    ]);
    expect(processTashasLaughterRepeatSave).not.toHaveBeenCalled();
  });

  it('does not trigger when incapacitated creature lacks the target effect', () => {
    const barbarian = createNpcCreature('Barbarian', 20, 20, {
      conditions: ['incapacitated'],
    });
    const cs = makeCombatSummary([barbarian]);
    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((_charName, key, _campaignName) => {
      if (key === 'activeBuffs') return [];
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') return [];
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') return undefined;
      if (key === 'targetEffects') return [];
      if (key === 'tempHp') return 0;
      if (key === 'resistanceUsedThisTurn') return undefined;
      return undefined;
    });
    applyDamageToTarget(cs, 'Barbarian', 5, ['Slashing'], 'TestCampaign', [
      createMinimalCharacter('Barbarian'),
    ]);
    expect(processTashasLaughterRepeatSave).not.toHaveBeenCalled();
  });

  it('does not trigger when creature is immune to damage (wardDamage is 0)', () => {
    const skeleton = createNpcCreature('Skeleton', 20, 20, {
      immunities: ['slashing'],
      conditions: ['incapacitated'],
    });
    const cs = makeCombatSummary([skeleton]);
    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((_charName, key, _campaignName) => {
      if (key === 'activeBuffs') return [];
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') return [];
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') return undefined;
      if (key === 'targetEffects') return [{ target: 'Skeleton', effect: 'tashas_laughter_repeat_save', source: 'Bard', dc: 13 }];
      if (key === 'tempHp') return 0;
      if (key === 'resistanceUsedThisTurn') return undefined;
      return undefined;
    });
    applyDamageToTarget(cs, 'Skeleton', 10, ['Slashing'], 'TestCampaign', [
      createMinimalCharacter('Skeleton'),
    ]);
    expect(processTashasLaughterRepeatSave).not.toHaveBeenCalled();
  });

  it('does not trigger for player creatures', () => {
    const player = createPlayerCreature('Barbarian');
    const cs = makeCombatSummary([player]);
    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((_charName, key, _campaignName) => {
      if (key === 'activeBuffs') return [];
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') return ['incapacitated'];
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') return undefined;
      if (key === 'tempHp') return 0;
      if (key === 'resistanceUsedThisTurn') return undefined;
      return undefined;
    });
    applyDamageToTarget(cs, 'Barbarian', 5, ['Slashing'], 'TestCampaign', [
      createMinimalCharacter('Barbarian'),
    ]);
    expect(processTashasLaughterRepeatSave).not.toHaveBeenCalled();
  });
});

describe('Psychic Veil — attacker condition removal on hit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  it('removes Psychic Veil buff and Invisible condition when attacker hits with damage', () => {
    const goblin = createNpcCreature('Goblin', 10, 10);
    const player = createPlayerCreature('Warlock', { currentHp: 20 });
    player.currentHp = 20;
    const cs = makeCombatSummary([goblin, player]);

    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((charName, key, _campaignName) => {
      if (key === 'activeBuffs') {
        if (charName === 'Warlock') return [{ name: 'Psychic Veil' }];
        return [];
      }
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') {
        if (charName === 'Warlock') return ['invisible'];
        return [];
      }
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') return undefined;
      if (key === 'tempHp') return 0;
      return undefined;
    });

    applyDamageToTarget(cs, 'Goblin', 5, ['Psychic'], 'TestCampaign', [
      createMinimalCharacter('Warlock'),
      createMinimalCharacter('Goblin'),
    ], false, 'Warlock');

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Warlock', 'activeConditions', [], 'TestCampaign',
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'Warlock', 'activeBuffs', [], 'TestCampaign',
    );
  });

  it('does not remove Psychic Veil when no damage is dealt (immune)', () => {
    const skeleton = createNpcCreature('Skeleton', 10, 10, { immunities: ['psychic'] });
    const player = createPlayerCreature('Warlock', { currentHp: 20 });
    player.currentHp = 20;
    const cs = makeCombatSummary([skeleton, player]);
    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((charName, key, _campaignName) => {
      if (key === 'activeBuffs') { if (charName === 'Warlock') return [{ name: 'Psychic Veil' }]; return []; }
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') { if (charName === 'Warlock') return ['invisible']; return []; }
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') return undefined;
      if (key === 'tempHp') return 0;
      return undefined;
    });
    applyDamageToTarget(cs, 'Skeleton', 5, ['Psychic'], 'TestCampaign', [createMinimalCharacter('Warlock'), createMinimalCharacter('Skeleton')], false, 'Warlock');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Warlock', 'activeConditions', expect.any(Array), 'TestCampaign');
  });

  it('does not remove Psychic Veil when attacker lacks the buff', () => {
    const goblin = createNpcCreature('Goblin', 10, 10);
    const player = createPlayerCreature('Fighter', { currentHp: 20 });
    player.currentHp = 20;
    const cs = makeCombatSummary([goblin, player]);
    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((charName, key, _campaignName) => {
      if (key === 'activeBuffs') { if (charName === 'Fighter') return [{ name: 'Shield' }]; return []; }
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') { if (charName === 'Fighter') return ['invisible']; return []; }
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') return undefined;
      if (key === 'tempHp') return 0;
      return undefined;
    });
    applyDamageToTarget(cs, 'Goblin', 5, ['Slashing'], 'TestCampaign', [createMinimalCharacter('Fighter'), createMinimalCharacter('Goblin')], false, 'Fighter');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Fighter', 'activeConditions', expect.any(Array), 'TestCampaign');
  });
});

describe('Supreme Sneak — preserve Invisible condition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  it('preserves Invisible when attacker has stealthAttackCost active and no Psychic Veil', () => {
    const goblin = createNpcCreature('Goblin', 10, 10);
    const rogue = createPlayerCreature('Rogue', { currentHp: 20 });
    rogue.currentHp = 20;
    const cs = makeCombatSummary([goblin, rogue]);

    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((charName, key, _campaignName) => {
      if (key === 'activeBuffs') { if (charName === 'Rogue') return [{ name: 'Shield' }]; return []; }
      if (key === 'arcaneWardActive') return false;
      if (key === 'arcaneWardHp') return 0;
      if (key === 'lastMetamagicDamage') return undefined;
      if (key === 'currentHitPoints') return 20;
      if (key === 'activeConditions') { if (charName === 'Rogue') return ['invisible']; return []; }
      if (key === 'holyAuraSaveDc') return undefined;
      if (key === 'stealthAttackCost') { if (charName === 'Rogue') return 1; return undefined; }
      if (key === 'tempHp') return 0;
      return undefined;
    });

    applyDamageToTarget(cs, 'Goblin', 5, ['Psychic'], 'TestCampaign', [createMinimalCharacter('Rogue'), createMinimalCharacter('Goblin')], false, 'Rogue');
    expect(setRuntimeValue).not.toHaveBeenCalledWith('Rogue', 'activeConditions', expect.any(Array), 'TestCampaign');
  });
});
