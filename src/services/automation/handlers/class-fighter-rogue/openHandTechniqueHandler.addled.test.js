// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockImplementation(() => Promise.resolve({ creatures: [{ name: 'Goblin' }] })),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../automation/common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/conditionSaveService.js', () => ({
  addCondition: vi.fn(),
}));

vi.mock('../../../../services/ui/utils.js', () => ({
  default: {
    getName: (fullName) => fullName || 'Unknown',
  },
}));

// ── Imports ────────────────────────────────────────────────────

import { applyOpenHandTechnique } from './openHandTechniqueHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../ui/logService.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';
import { addCondition } from '../../../../services/combat/conditions/conditionSaveService.js';
import { createSaveListener } from '../../../automation/common/savePrompt.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'test-campaign';

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestMonk',
    level: 5,
    proficiencyBonus: 3,
    proficiency: 3,
    abilities: [
      { name: 'Strength', bonus: 2 },
      { name: 'Wisdom', bonus: 1 },
    ],
    ...overrides,
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Open Hand Technique',
    automation: {
      type: 'open_hand',
      ...automation,
    },
  };
}

// ── Tests: addled effect path ──────────────────────────────────

describe('openHandTechniqueHandler.addled effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies addled effect without save listener when option.effect is addled', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Disarm', effect: 'addled', saveType: 'STR' }],
    });
    getRuntimeValue.mockReturnValue([]);

    const result = await applyOpenHandTechnique(
      action, ps, campaignName, 'Goblin', 'Disarm', 13,
    );

    expect(createSaveListener).not.toHaveBeenCalled();
    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('cannot make Opportunity Attacks');
    expect(result.payload.description).toContain('until the start of its next turn');
  });

  it('logs an ability_use entry for addled effect', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Disarm', effect: 'addled', saveType: 'STR' }],
    });
    getRuntimeValue.mockReturnValue([]);

    await applyOpenHandTechnique(
      action, ps, campaignName, 'Goblin', 'Disarm', 13,
    );

    const logEntry = addEntry.mock.calls.find(
      (c) => c[1]?.type === 'roll' && c[1]?.targetName === 'Goblin',
    );
    expect(logEntry).toBeDefined();
    expect(logEntry[1]).toMatchObject({
      type: 'roll',
      name: 'Open Hand Technique',
      characterName: 'TestMonk',
      rollType: 'save-damage',
      targetName: 'Goblin',
      saveDc: 13,
      description: expect.stringContaining('cannot make Opportunity Attacks'),
    });
  });

  it('clears pendingRiderChoice before applying addled effect', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Disarm', effect: 'addled', saveType: 'STR' }],
    });
    getRuntimeValue.mockReturnValue([]);

    await applyOpenHandTechnique(
      action, ps, campaignName, 'Goblin', 'Disarm', 13,
    );

    expect(setRuntimeValue).toHaveBeenCalledWith('TestMonk', 'pendingRiderChoice', null, campaignName);
  });

  it('calls getCombatContext for addled effect path', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Disarm', effect: 'addled', saveType: 'STR' }],
    });
    getRuntimeValue.mockReturnValue([]);

    await applyOpenHandTechnique(
      action, ps, campaignName, 'Goblin', 'Disarm', 13,
    );

    expect(getCombatContext).toHaveBeenCalledWith(campaignName);
  });
});

// ── Tests: applyOpenHandEffect with noOpportunityAttacks ───────

describe('openHandTechniqueHandler.noOpportunityAttacks effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies addled condition when option.noOpportunityAttacks is true', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Disarm', effect: 'disarm', noOpportunityAttacks: true, saveType: 'STR' }],
    });
    const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
    vi.mocked(createSaveListener).mockReturnValue({ promise: savePromise });
    getRuntimeValue.mockReturnValue([]);
    const characters = [{ name: 'Goblin', computedStats: { saveModifiers: [] } }];
    getRuntimeValue.mockImplementation((scope, key, campaign) => {
      if (scope === 'campaign' && key === 'targetEffects') return [];
      if (scope === 'characters' && key === 'characters' && campaign === campaignName) return characters;
      if (scope === 'Goblin' && key === 'activeConditions') return [];
      if (scope === 'Goblin' && key === 'activeConditionMeta') return {};
      return undefined;
    });

    await applyOpenHandTechnique(
      action, ps, campaignName, 'Goblin', 'Disarm', 13,
    );

    expect(addCondition).toHaveBeenCalledWith(
      expect.objectContaining({
        combatSummary: expect.any(Object),
        creatureName: 'Goblin',
        conditionDef: { key: 'addled', label: 'Addled' },
        dc: 13,
        ability: 'STR',
        getRuntimeValue,
        setRuntimeValue,
        campaignName,
        playerStats: expect.any(Object),
      }),
    );
  });

  it('does not apply addled condition when noOpportunityAttacks is false', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Knock Prone', effect: 'prone', noOpportunityAttacks: false, saveType: 'DEX' }],
    });
    const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
    vi.mocked(createSaveListener).mockReturnValue({ promise: savePromise });
    const characters = [{ name: 'Goblin', computedStats: { saveModifiers: [] } }];
    getRuntimeValue.mockImplementation((scope, key, campaign) => {
      if (scope === 'campaign' && key === 'targetEffects') return [];
      if (scope === 'characters' && key === 'characters' && campaign === campaignName) return characters;
      if (scope === 'Goblin' && key === 'activeConditions') return [];
      if (scope === 'Goblin' && key === 'activeConditionMeta') return {};
      return undefined;
    });

    await applyOpenHandTechnique(
      action, ps, campaignName, 'Goblin', 'Knock Prone', 13,
    );

    expect(addCondition).not.toHaveBeenCalledWith(
      expect.objectContaining({
        combatSummary: expect.any(Object),
        creatureName: 'Goblin',
        conditionDef: { key: 'addled', label: 'Addled' },
        campaignName,
      }),
    );
  });

  it('builds effect with noOpportunityAttacks flag in targetEffects', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Disarm', effect: 'disarm', noOpportunityAttacks: true, saveType: 'STR' }],
    });
    const savePromise = Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 });
    vi.mocked(createSaveListener).mockReturnValue({ promise: savePromise });
    const characters = [{ name: 'Goblin', computedStats: { saveModifiers: [] } }];
    getRuntimeValue.mockImplementation((scope, key, campaign) => {
      if (scope === 'campaign' && key === 'targetEffects') return [];
      if (scope === 'characters' && key === 'characters' && campaign === campaignName) return characters;
      if (scope === 'Goblin' && key === 'activeConditions') return [];
      if (scope === 'Goblin' && key === 'activeConditionMeta') return {};
      return undefined;
    });

    await applyOpenHandTechnique(
      action, ps, campaignName, 'Goblin', 'Disarm', 13,
    );

    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({
          target: 'Goblin',
          effect: 'disarm',
          noOpportunityAttacks: true,
          saveType: 'STR',
        }),
      ]),
      campaignName,
    );
  });
});

// ── Tests: applyOpenHandEffect with null target ────────────────

describe('openHandTechniqueHandler.applyOpenHandEffect null target', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early without side effects when targetName is null', async () => {
    const ps = makePlayerStats();
    const action = makeAction({
      options: [{ name: 'Knock Prone', effect: 'prone', saveType: 'DEX' }],
    });

    const result = await applyOpenHandTechnique(
      action, ps, campaignName, null, 'Knock Prone', 13,
    );

    expect(result.type).toBe('popup');
    expect(result.payload.description).toContain('No target selected');
  });
});
