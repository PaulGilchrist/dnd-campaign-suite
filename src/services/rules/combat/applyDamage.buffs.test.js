// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks BEFORE imports (hoisted by vitest) ───────────────────

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

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

vi.mock('../../automation/handlers/spells/tashasLaughterHandler.js', () => ({
  processTashasLaughterRepeatSave: vi.fn(),
  handle: vi.fn(),
}));

vi.mock('./rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 30),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ─────────────────────────────────────────────────────

import {
  applyDamageToTarget,
} from './applyDamage.js';

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ── Helpers ─────────────────────────────────────────────────────

function makeCombatSummary(creatures) {
  return { round: 1, creatures };
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
    template: [],
    concentration: null,
    saveBonuses: {},
    ...extra,
  };
}

function createPlayerCharacter(name, extra = {}) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      ...extra.computedExtra,
    },
    ...extra,
  };
}

function createMinimalCharacter(name) {
  return {
    name,
    computedStats: {
      resistances: [],
      immunities: [],
      class_levels: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
    },
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe('applyDamageToTarget — buff resistance merging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      if (subKey === 'currentHitPoints') return 30;
      return undefined;
    });
  });

  it('merges resistanceTypes from activeBuffs for player', async () => {
    getRuntimeValue
      .mockReturnValueOnce(null) // lastAttack read
      .mockReturnValueOnce([{ resistanceTypes: ['fire'], resistanceTypes2: ['cold'] }])
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const player = createPlayerCreature('Wizard');
    const cs = makeCombatSummary([player]);
    const result = await applyDamageToTarget(cs, 'Wizard', 10, ['Fire'], { campaignName: 'TestCampaign', characters: [createMinimalCharacter('Wizard')] });
    expect(result.finalDamage).toBe(5);
  });

  it('deduplicates resistanceTypes from multiple buffs', async () => {
    getRuntimeValue
      .mockReturnValueOnce(null) // lastAttack read
      .mockReturnValueOnce([
        { resistanceTypes: ['fire'] },
        { resistanceTypes: ['fire', 'cold'] },
      ])
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const player = createPlayerCreature('Wizard');
    const cs = makeCombatSummary([player]);
    const result = await applyDamageToTarget(cs, 'Wizard', 10, ['Fire'], { campaignName: 'TestCampaign', characters: [createMinimalCharacter('Wizard')] });
    expect(result.finalDamage).toBe(5);
  });

  it('handles non-array and null activeBuffs gracefully, combines base resistances with buffs', async () => {
    getRuntimeValue
      .mockReturnValueOnce(null) // lastAttack read
      .mockReturnValueOnce('not-an-array')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const player1 = createPlayerCreature('Wizard');
    const cs1 = makeCombatSummary([player1]);
    const result1 = await applyDamageToTarget(cs1, 'Wizard', 10, ['Fire'], { campaignName: 'TestCampaign', characters: [createMinimalCharacter('Wizard')] });
    expect(result1.finalDamage).toBe(10);

    getRuntimeValue
      .mockReturnValueOnce(null) // lastAttack read
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const player2 = createPlayerCreature('Wizard2');
    const cs2 = makeCombatSummary([player2]);
    const result2 = await applyDamageToTarget(cs2, 'Wizard2', 10, ['Fire'], { campaignName: 'TestCampaign', characters: [createMinimalCharacter('Wizard2')] });
    expect(result2.finalDamage).toBe(10);

    getRuntimeValue
      .mockReturnValueOnce(null) // lastAttack read
      .mockReturnValueOnce([{ resistanceTypes: ['cold'] }])
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(30)
      .mockReturnValueOnce([])
      .mockReturnValueOnce([]);
    const player3 = createPlayerCreature('Paladin');
    const characters = [createPlayerCharacter('Paladin', {
      computedExtra: { resistances: ['fire'] },
    })];
    const cs3 = makeCombatSummary([player3]);
    const result3 = await applyDamageToTarget(cs3, 'Paladin', 10, ['Cold'], { campaignName: 'TestCampaign', characters: characters });
    expect(result3.finalDamage).toBe(5);
  });

  it('does not apply buff merging for NPCs', async () => {
    const npc = {
      name: 'Goblin',
      type: 'player',
      maxHp: 10,
      currentHp: 10,
      resistances: [],
      immunities: [],
      conditions: [],
      template: [],
      concentration: null,
      saveBonuses: {},
    };
    const cs = makeCombatSummary([npc]);
    getRuntimeValue.mockReset();
    getRuntimeValue.mockImplementation((key, subKey) => {
      if (subKey === 'activeBuffs') return [];
      if (subKey === 'arcaneWardActive') return undefined;
      if (subKey === 'arcaneWardHp') return 0;
      if (subKey === 'lastMetamagicDamage') return undefined;
      if (subKey === 'currentHitPoints') return 10;
      if (subKey === 'activeConditions') return [];
      return undefined;
    });
    await applyDamageToTarget(cs, 'Goblin', 5, ['Slashing'], { campaignName: 'TestCampaign', characters: [createMinimalCharacter('Goblin')] });
    expect(getRuntimeValue).toHaveBeenCalledWith('Goblin', 'activeBuffs', 'TestCampaign');
  });
});

describe('applyDamageToTarget — Projected Ward', () => {
  beforeEach(() => vi.clearAllMocks());

  function createWizardCharacter(name, extra = {}) {
    return {
      name,
      computedStats: {
        resistances: [],
        immunities: [],
        class_levels: [],
        equipment: [],
        characterAdvancement: [],
        allFeatures: [],
        automation: {
          reactions: [
            { type: 'projected_ward', name: 'Projected Ward', range: 30, reaction: true },
          ],
        },
        ...extra.computedExtra,
      },
      ...extra,
    };
  }

  function stubWizardRuntime(wizardName, currentHp, wardActive, wardHp, conditions = []) {
    getRuntimeValue.mockReset();
    getRuntimeValue
      .mockImplementation((target, key, _campaignName) => {
        if (key === 'activeBuffs') return [];
        if (key === 'currentHitPoints') return currentHp;
        if (key === 'activeConditions') return conditions;
        if (key === 'lastMetamagicDamage') return undefined;
        if (target === wizardName) {
          if (key === 'arcaneWardActive') return wardActive;
          if (key === 'arcaneWardHp') return wardHp;
        }
        return undefined;
      });
  }

  it('does not auto-absorb with Projected Ward (absorption via reaction click), absorbs self-damage first', async () => {
    const wizardName = 'Diviner';
    const allyName = 'Rogue';

    const wizardCreature = createPlayerCreature(wizardName);
    wizardCreature.position = { gridX: 1, gridY: 1 };

    const allyCreature = createPlayerCreature(allyName);
    allyCreature.position = { gridX: 3, gridY: 3 };

    stubWizardRuntime('Diviner', 20, true, 15, []);

    const cs = makeCombatSummary([wizardCreature, allyCreature]);
    const characters = [
      createWizardCharacter(wizardName),
      createPlayerCharacter(allyName),
    ];

    const result = await applyDamageToTarget(cs, allyName, 10, ['Fire'], { campaignName: 'TestCampaign', characters: characters });

    expect(result.newHp).toBe(10);
    expect(setRuntimeValue).not.toHaveBeenCalledWith(wizardName, 'arcaneWardHp', expect.any(Number), 'TestCampaign');

    const wizardCreature2 = createPlayerCreature(wizardName);
    wizardCreature2.position = { gridX: 1, gridY: 1 };

    stubWizardRuntime('Diviner', 20, true, 15, []);

    const cs2 = makeCombatSummary([wizardCreature2]);
    const characters2 = [
      createWizardCharacter(wizardName),
    ];

    const result2 = await applyDamageToTarget(cs2, wizardName, 10, ['Fire'], { campaignName: 'TestCampaign', characters: characters2 });

    expect(result2.newHp).toBe(20);
    expect(setRuntimeValue).toHaveBeenCalledWith(wizardName, 'arcaneWardHp', 5, 'TestCampaign');
  });
});
