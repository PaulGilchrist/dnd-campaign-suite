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

import { isFreeCastAuthorized } from './spellPreparationService.js';

import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

// ---------------------------------------------------------------------------
// isFreeCastAuthorized — skips non-free_spell types in actions loop
// ---------------------------------------------------------------------------

describe('isFreeCastAuthorized — type filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('skips non-free_spell types in actions loop', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [
          {
            type: 'other_type',
            name: 'Other Feature',
            spell: 'Fireball',
          },
          {
            type: 'free_spell',
            name: 'Free Feature',
            spell: 'Fireball',
            uses: 1,
            recharge: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Free_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('skips non-free_spell types in bonusActions loop', async () => {
    const playerStats = makePlayerStats({
      automation: {
        bonusActions: [
          {
            type: 'other_type',
            name: 'Other Feature',
            spell: 'Fireball',
          },
          {
            type: 'free_spell',
            name: 'Free Feature',
            spell: 'Fireball',
            uses: 1,
            recharge: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Free_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });

  it('skips non-free_spell types in specialActions loop', async () => {
    const playerStats = makePlayerStats({
      automation: {
        specialActions: [
          {
            type: 'other_type',
            name: 'Other Feature',
            spell: 'Fireball',
          },
          {
            type: 'free_spell',
            name: 'Free Feature',
            spell: 'Fireball',
            uses: 1,
            recharge: true,
          },
        ],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Free_Feature_freeCastCount') return 1;
      return undefined;
    });

    const authorized = await isFreeCastAuthorized('TestWizard', 'Fireball', 3, playerStats, 'camp');
    expect(authorized).toBe(true);
  });
});
