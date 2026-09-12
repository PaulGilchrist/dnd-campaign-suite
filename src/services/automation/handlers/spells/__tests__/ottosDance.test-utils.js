/**
 * Shared test fixtures and helper functions for ottosDanceHandler tests.
 */

export function makePlayerStats(overrides = {}) {
  return {
    name: 'TestCaster',
    level: 10,
    proficiency: 4,
    abilities: [{ name: 'Charisma', bonus: 3 }],
    ...overrides,
  };
}

export function makeAction(automation = {}) {
  return {
    name: "Otto's Irresistible Dance",
    automation: { type: 'ottos_dance', saveType: 'WIS', saveDc: 15, ...automation },
  };
}

export function makeActionNoAutomation() {
  return {
    name: "Otto's Irresistible Dance",
  };
}

export const baseCombatContext = {
  creatures: [
    { name: 'Goblin', type: 'monster', currentHp: 5, maxHp: 7 },
    { name: 'Orc', type: 'monster', currentHp: 15, maxHp: 22 },
    { name: 'TestCaster', gridX: 5, gridY: 10 },
  ],
  players: [{ name: 'TestCaster', gridX: 5, gridY: 10 }],
  placedItems: [],
};

export function createFailedSaveSetup({ getCombatContext, buildSaveDc, resolveTarget, getRuntimeValue, createSaveListener, existingConditions = [], existingEffects = [], existingMeta = {} }) {
  return function failedSaveSetup() {
    getCombatContext.mockResolvedValue(baseCombatContext);
    buildSaveDc.mockReturnValue(15);
    resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    getRuntimeValue.mockImplementation((_caster, key, _camp) => {
      if (key === 'activeConditions') return existingConditions;
      if (key === 'targetEffects') return existingEffects;
      if (key === 'activeConditionMeta') return existingMeta;
      return [];
    });
    createSaveListener.mockReturnValue({
      promptId: 'otto-fail',
      promise: Promise.resolve({ success: false }),
    });
  };
}

export function createSuccessfulSaveSetup(getCombatContext, buildSaveDc, resolveTarget, getRuntimeValue, createSaveListener) {
  return function successfulSaveSetup() {
    getCombatContext.mockResolvedValue(baseCombatContext);
    buildSaveDc.mockReturnValue(20);
    resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
    getRuntimeValue.mockReturnValue([]);
    createSaveListener.mockReturnValue({
      promptId: 'otto-success-save',
      promise: Promise.resolve({ success: true }),
    });
  };
}
