// @maintained-by-ai
// Open Hand Technique — addled lane only.
// Owns: instant addled option (no save listener, popup copy, store write, log roll)
// and the noOpportunityAttacks → Addled condition producer contract.
// Owned elsewhere: pendingRiderChoice clearing + null-target popup (sibling
// openHandTechniqueHandler.test.js), riderCannotOpportunityAttack consumption
// (conditionEffects tests), registry internals (targetEffectDefinitions.test.js).

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

// Runtime router for the save-path: targetEffects store, character roster for
// findOpenHandTargetStats, per-creature condition reads.
function routeRuntimeValues(characters = [{ name: 'Goblin', computedStats: { saveModifiers: [] } }]) {
  getRuntimeValue.mockImplementation((scope, key, campaign) => {
    if (scope === 'campaign' && key === 'targetEffects') return [];
    if (scope === 'characters' && key === 'characters' && campaign === campaignName) return characters;
    return undefined;
  });
}

// ── Tests: addled option (instant, skip the save) ─────────────────────

describe('openHandTechniqueHandler.addled effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies addled instantly without a save listener, writing the exact targetEffect and popup copy', async () => {
    const action = makeAction({
      options: [{ name: 'Disarm', effect: 'addled', saveType: 'STR' }],
    });
    getRuntimeValue.mockReturnValue([]);

    const result = await applyOpenHandTechnique({
        action, playerStats: makePlayerStats(), campaignName, targetName: 'Goblin', selectedOptionName: 'Disarm', saveDc: 13,
      });

    expect(createSaveListener).not.toHaveBeenCalled();
    expect(result.type).toBe('popup');
    expect(result.payload.type).toBe('automation_info');
    expect(result.payload.description).toBe('Disarm — Goblin cannot make Opportunity Attacks until the start of its next turn.');
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
      {
        target: 'Goblin',
        source: 'Open Hand Technique',
        option: 'Disarm',
        effect: 'addled',
        value: null,
        duration: 'until_start_of_next_turn',
        noOpportunityAttacks: false,
        saveType: 'STR',
        condition: null,
      },
    ], campaignName);
  });

  it('logs a save-damage roll entry for addled effect', async () => {
    const action = makeAction({
      options: [{ name: 'Disarm', effect: 'addled', saveType: 'STR' }],
    });
    getRuntimeValue.mockReturnValue([]);

    await applyOpenHandTechnique({
        action, playerStats: makePlayerStats(), campaignName, targetName: 'Goblin', selectedOptionName: 'Disarm', saveDc: 13,
      });

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
      description: 'Open Hand Technique — Disarm: Goblin cannot make Opportunity Attacks until the start of its next turn.',
    });
  });
});

// ── Tests: noOpportunityAttacks flag → Addled condition (save path) ──

describe('openHandTechniqueHandler.noOpportunityAttacks effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes the noOpportunityAttacks targetEffect and applies the Addled condition when the save fails', async () => {
    const action = makeAction({
      options: [{ name: 'Disarm', effect: 'disarm', noOpportunityAttacks: true, saveType: 'STR' }],
    });
    createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 }) });
    const combatContext = { creatures: [{ name: 'Goblin' }] };
    getCombatContext.mockResolvedValue(combatContext);
    routeRuntimeValues();

    await applyOpenHandTechnique({
        action, playerStats: makePlayerStats(), campaignName, targetName: 'Goblin', selectedOptionName: 'Disarm', saveDc: 13,
      });

    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', [
      {
        target: 'Goblin',
        source: 'Open Hand Technique',
        option: 'Disarm',
        effect: 'disarm',
        value: null,
        duration: 'until_start_of_next_turn',
        noOpportunityAttacks: true,
        saveType: 'STR',
        condition: null,
      },
    ], campaignName);

    expect(addCondition).toHaveBeenCalledWith({
      combatSummary: combatContext,
      creatureName: 'Goblin',
      conditionDef: { key: 'addled', label: 'Addled' },
      dc: 13,
      ability: 'STR',
      getRuntimeValue,
      setRuntimeValue,
      campaignName,
      playerStats: { saveModifiers: [] },
    });
  });

  it('does not apply the Addled condition when noOpportunityAttacks is false', async () => {
    const action = makeAction({
      options: [{ name: 'Knock Prone', effect: 'prone', noOpportunityAttacks: false, saveType: 'DEX' }],
    });
    createSaveListener.mockReturnValue({ promise: Promise.resolve({ success: false, total: 8, roll: 5, saveBonus: 3 }) });
    routeRuntimeValues();

    await applyOpenHandTechnique({
        action, playerStats: makePlayerStats(), campaignName, targetName: 'Goblin', selectedOptionName: 'Knock Prone', saveDc: 13,
      });

    expect(addCondition).not.toHaveBeenCalledWith(
      expect.objectContaining({
        creatureName: 'Goblin',
        conditionDef: { key: 'addled', label: 'Addled' },
        campaignName,
      }),
    );
    expect(setRuntimeValue).toHaveBeenCalledWith(
      'campaign',
      'targetEffects',
      expect.arrayContaining([
        expect.objectContaining({
          target: 'Goblin',
          effect: 'prone',
          noOpportunityAttacks: false,
        }),
      ]),
      campaignName,
    );
  });
});
