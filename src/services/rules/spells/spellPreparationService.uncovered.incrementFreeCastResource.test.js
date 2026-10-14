import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Static mocks
// ---------------------------------------------------------------------------

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
  const setRuntimeValue = vi.fn();
  const getRuntimeValue = vi.fn(() => undefined);
  const clearRuntimeState = vi.fn();
  return { setRuntimeValue, getRuntimeValue, clearRuntimeState };
});

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../../services/combat/concentration/concentrationService.js', () => ({
  breakConcentration: vi.fn(),
  addConcentration: vi.fn(),
  cleanupConcentrationEffects: vi.fn(),
}));

vi.mock('../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('./metamagicRules.js', () => ({
  isPsionicSpell: vi.fn(() => false),
  hasPsionicSorcery: vi.fn(() => false),
}));

// ---------------------------------------------------------------------------
// Test-data factories
// ---------------------------------------------------------------------------

function makePlayerStats(overrides = {}) {
  return {
    name: 'TestWizard',
    class: { name: 'Wizard' },
    abilities: [{ name: 'Intelligence', bonus: 5 }],
    proficiency: 4,
    spellAbilities: {
      spellCastingAbility: 'Intelligence',
      toHit: 9,
      saveDc: 17,
      modifier: 5,
    },
    automation: { actions: [], bonusActions: [], specialActions: [], passives: [] },
    hitPoints: 100,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { incrementFreeCastResource } from './spellPreparationService.js';

import { getRuntimeValue, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ---------------------------------------------------------------------------
// incrementFreeCastResource — uses_expression level matching
// ---------------------------------------------------------------------------

describe('incrementFreeCastResource — uses_expression level matching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('increments freeCastCount when featureLevel matches and count < usesMax', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Level Feature',
          spell: 'level 3',
          uses_expression: true,
          usesMax: 2,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Level_Feature_freeCastCount') return 1;
      return undefined;
    });

    incrementFreeCastResource('TestWizard', 'SomeSpell', 3, playerStats, 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Level_Feature_freeCastCount', 2, 'test-campaign');
  });

  it('does not increment when count is already at usesMax', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Level Feature',
          spell: 'level 3',
          uses_expression: true,
          usesMax: 2,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Level_Feature_freeCastCount') return 2;
      return undefined;
    });

    incrementFreeCastResource('TestWizard', 'SomeSpell', 3, playerStats, 'test-campaign');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('handles featureLevel === null branch (spell name matching) in increment', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Spell Feature',
          spell: 'Fireball',
          uses_expression: true,
          usesMax: 3,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Spell_Feature_freeCastCount') return 1;
      return undefined;
    });

    incrementFreeCastResource('TestWizard', 'Fireball', 3, playerStats, 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Spell_Feature_freeCastCount', 2, 'test-campaign');
  });

  it('handles recharge branch in increment with uses_expression', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Recharge Feature',
          spell: 'Fireball',
          uses_expression: true,
          usesMax: 2,
          uses: 2,
          recharge: true,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Recharge_Feature_freeCastCount') return 1;
      return undefined;
    });

    incrementFreeCastResource('TestWizard', 'Fireball', 3, playerStats, 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Recharge_Feature_freeCastCount', 2, 'test-campaign');
  });

  it('skips to next action when featureLevel does not match spellLevel (line 399 continue)', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [
          {
            type: 'free_spell',
            name: 'Level 3 Feature',
            spell: 'level 3',
            uses_expression: true,
            usesMax: 2,
          },
          {
            type: 'free_spell',
            name: 'Recharge Feature',
            spell: 'Fireball',
            uses: 2,
            recharge: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Recharge_Feature_freeCastCount') return 1;
      return undefined;
    });

    incrementFreeCastResource('TestWizard', 'Fireball', 5, playerStats, 'test-campaign');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Recharge_Feature_freeCastCount', 2, 'test-campaign');
  });
});
