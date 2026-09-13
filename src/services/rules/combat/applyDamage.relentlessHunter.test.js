import { describe, it, expect, vi, beforeEach } from 'vitest';

import { applyDamageToTarget } from './applyDamage.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { sendConcentrationPrompt } from '../../combat/conditions/savePromptService.js';
import { rollConcentrationSave } from '../../combat/concentration/concentrationRules.js';
import { addEntry } from '../../ui/logService.js';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
  getStore: vi.fn(() => ({ keys: () => [] })),
}));

vi.mock('../../dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn() } }));

vi.mock('../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
  sendConcentrationPrompt: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationRules.js', () => ({
  rollConcentrationSave: vi.fn(),
}));

vi.mock('../../combat/concentration/concentrationService.js', () => ({
  cleanupConcentrationEffects: vi.fn(),
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

global.fetch = vi.fn(() => new Promise(() => {}));

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

function createRangerCharacter(name, level, withRelentlessHunter) {
  return {
    name,
    level,
    computedStats: {
      resistances: [],
      immunities: [],
      equipment: [],
      characterAdvancement: [],
      allFeatures: [],
      automation: { passives: [] },
      class: {
        name: 'Ranger',
        level,
        class_levels: [
          { level, features: withRelentlessHunter ? [{ name: 'Relentless Hunter' }] : [] },
        ],
      },
    },
  };
}

function stubPlayerRuntime(currentHp) {
  getRuntimeValue.mockReset();
  getRuntimeValue.mockImplementation((_charName, key) => {
    if (key === 'activeBuffs') return [];
    if (key === 'arcaneWardActive') return false;
    if (key === 'arcaneWardHp') return 0;
    if (key === 'lastMetamagicDamage') return undefined;
    if (key === 'currentHitPoints') return currentHp;
    if (key === 'activeConditions') return [];
    if (key === 'holyAuraSaveDc') return undefined;
    if (key === 'stealthAttackCost') return undefined;
    if (key === 'targetEffects') return [];
    if (key === 'tempHp') return 0;
    if (key === 'resistanceUsedThisTurn') return undefined;
    return undefined;
  });
}

describe('CLA-289 Relentless Hunter — PC concentration exemption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch.mockReset();
  });

  it('sends a concentration prompt for a lv13 Ranger concentrating a non-Hunter\'s-Mark spell', async () => {
    const creature = createPlayerCreature('FeyRanger', { concentration: { spell: 'Spirit Guardians', dc: 10 } });
    const cs = makeCombatSummary([creature]);
    stubPlayerRuntime(30);

    await applyDamageToTarget(cs, 'FeyRanger', 17, ['Slashing'], { campaignName: 'TestCampaign', characters: [ createRangerCharacter('FeyRanger', 13, true), ] });

    expect(sendConcentrationPrompt).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      targetName: 'FeyRanger',
      spellName: 'Spirit Guardians',
    }));
  });

  it('does NOT prompt for a lv13 Ranger concentrating Hunter\'s Mark and logs the exemption', async () => {
    const creature = createPlayerCreature('FeyRanger', { concentration: { spell: "Hunter's Mark", dc: 10 } });
    const cs = makeCombatSummary([creature]);
    stubPlayerRuntime(30);

    await applyDamageToTarget(cs, 'FeyRanger', 17, ['Slashing'], { campaignName: 'TestCampaign', characters: [ createRangerCharacter('FeyRanger', 13, true), ] });

    expect(sendConcentrationPrompt).not.toHaveBeenCalled();
    expect(creature.concentration).not.toBeNull();
    expect(addEntry).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      type: 'condition',
      action: 'maintained',
      characterName: 'FeyRanger',
      condition: 'Concentration on Hunter\'s Mark',
      sourceName: 'Relentless Hunter',
    }));
  });

  it('prompts for a Ranger without the Relentless Hunter feature even on Hunter\'s Mark', async () => {
    const creature = createPlayerCreature('FeyRanger', { concentration: { spell: "Hunter's Mark", dc: 10 } });
    const cs = makeCombatSummary([creature]);
    stubPlayerRuntime(30);

    await applyDamageToTarget(cs, 'FeyRanger', 17, ['Slashing'], { campaignName: 'TestCampaign', characters: [ createRangerCharacter('FeyRanger', 12, false), ] });

    expect(sendConcentrationPrompt).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      targetName: 'FeyRanger',
      spellName: "Hunter's Mark",
    }));
  });

  it('prompts for non-Ranger PCs concentrating Hunter\'s Mark', async () => {
    const creature = createPlayerCreature('HexWarlock', { concentration: { spell: 'Hex', dc: 10 } });
    const cs = makeCombatSummary([creature]);
    stubPlayerRuntime(30);

    await applyDamageToTarget(cs, 'HexWarlock', 11, ['Necrotic'], { campaignName: 'TestCampaign', characters: [ { name: 'HexWarlock', level: 14, computedStats: { resistances: [], immunities: [], class_levels: [], class: { name: 'Warlock', class_levels: [] } } }, ] });

    expect(sendConcentrationPrompt).toHaveBeenCalledWith('TestCampaign', expect.objectContaining({
      targetName: 'HexWarlock',
      spellName: 'Hex',
    }));
    expect(rollConcentrationSave).not.toHaveBeenCalled();
  });
});
