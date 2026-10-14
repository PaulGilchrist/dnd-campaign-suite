import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Static mocks — the service heavily depends on runtime state, combat data,
// concentration, storage, and logging.  We mock at the module boundary.
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
// incrementFreeCastResource — Mystic Arcanum
// ---------------------------------------------------------------------------

describe('incrementFreeCastResource — Mystic Arcanum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('increments arcanum resource when count is below max', async () => {
    const playerStats = makePlayerStats({
      class: { arcanums: ['Teleport'] },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'mysticArcanumLevel6') return 0;
      return undefined;
    });

    incrementFreeCastResource('TestWizard', 'Teleport', 6, playerStats, 'camp');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'mysticArcanumLevel6', 1, 'camp');
  });

  it('does not increment when arcanum resource is already at max', async () => {
    const playerStats = makePlayerStats({
      class: { arcanums: ['Teleport'] },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'mysticArcanumLevel6') return 1;
      return undefined;
    });

    incrementFreeCastResource('TestWizard', 'Teleport', 6, playerStats, 'camp');

    expect(setRuntimeValue).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// incrementFreeCastResource — Free spell actions
// ---------------------------------------------------------------------------

describe('incrementFreeCastResource — free spell actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('increments free cast count for actions with uses_expression and usesMax', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Test Feature',
          spell: 'level 3',
          uses_expression: true,
          usesMax: 2,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Test_Feature_freeCastCount') return 1;
      return undefined;
    });

    incrementFreeCastResource('TestWizard', 'SomeSpell', 3, playerStats, 'camp');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Test_Feature_freeCastCount', 2, 'camp');
  });

  it('rolls back the perSpellTracking per-spell free-cast counter (FT-070)', async () => {
    const playerStats = makePlayerStats({
      automation: {
        actions: [{
          type: 'free_spell',
          name: 'Test Feature',
          spell: 'Fireball',
          uses: 1,
          recharge: 'long_rest',
          perSpellTracking: true,
        }],
      },
    });
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Test_Feature_Fireball_freeCastCount') return 0;
      return undefined;
    });

    incrementFreeCastResource('TestWizard', 'Fireball', 3, playerStats, 'camp');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Test_Feature_Fireball_freeCastCount', 1, 'camp');
  });
});

// ---------------------------------------------------------------------------
// incrementFreeCastResource — Natural Recovery / Bewitching / Signature
// ---------------------------------------------------------------------------

describe('incrementFreeCastResource — Natural Recovery / Bewitching / Signature', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('handles Natural Recovery free cast reset', async () => {
    const playerStats = makePlayerStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'naturalRecoveryFreeCast') return ['Fireball'];
      return undefined;
    });

    incrementFreeCastResource('TestWizard', 'Fireball', 3, playerStats, 'camp');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'naturalRecoveryFreeCast', null, 'camp');
    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'naturalRecoveryFreeCastUsed', false, 'camp');
  });

  it('handles Bewitching Magic free cast reset', async () => {
    const playerStats = makePlayerStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Bewitching_Magic_freeCast') return true;
      return undefined;
    });

    incrementFreeCastResource('TestWizard', 'Misty Step', 3, playerStats, 'camp');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Bewitching_Magic_freeCast', null, 'camp');
  });

  it('handles Signature Spells used flag reset', async () => {
    const playerStats = makePlayerStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === 'SignatureSpells_selection') return ['Teleportation Circle'];
      return undefined;
    });

    incrementFreeCastResource('TestWizard', 'Teleportation Circle', 3, playerStats, 'camp');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'SignatureSpells_Teleportation_Circle_used', false, 'camp');
  });

  it('handles Divination Savant used flag reset', async () => {
    const playerStats = makePlayerStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Divination_Savant_selection') return ['Warding Bond'];
      return undefined;
    });

    incrementFreeCastResource('TestWizard', 'Warding Bond', 2, playerStats, 'camp');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', '_Divination_Savant_Warding_Bond_used', false, 'camp');
  });
});

// ---------------------------------------------------------------------------
// incrementFreeCastResource — Favored Enemy
// ---------------------------------------------------------------------------

describe('incrementFreeCastResource — Favored Enemy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(undefined);
  });

  it('increments favored enemy uses', async () => {
    const playerStats = makePlayerStats();
    getRuntimeValue.mockImplementation((_key1, key2) => {
      if (key2 === '_Favored_Enemy_freeCastCount') return 2;
      return undefined;
    });

    incrementFreeCastResource('TestWizard', 'Fireball', 3, playerStats, 'camp');

    expect(setRuntimeValue).toHaveBeenCalledWith('TestWizard', 'favoredEnemyUses', 3, 'camp');
  });
});
