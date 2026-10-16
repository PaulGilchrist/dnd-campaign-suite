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

export function makeAction(automationOverrides = {}, overrides = {}) {
  return {
    name: "Otto's Irresistible Dance",
    automation: { type: 'ottos_dance', saveType: 'WIS', saveDc: 15, ...automationOverrides },
    ...overrides,
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

/**
 * Wire the mocked collaborators for one full cast of Otto's Irresistible
 * Dance: combat context, save DC, resolved Goblin target, runtime store
 * reads, and a save listener resolving with `saveResult`.
 */
export function setupCast({
  getCombatContext,
  buildSaveDc,
  resolveTarget,
  getRuntimeValue,
  createSaveListener,
  dc = 15,
  saveResult = { success: false },
  promptId = 'otto-prompt',
  combatContext = baseCombatContext,
  activeConditions = [],
  targetEffects = [],
  activeConditionMeta = {},
}) {
  getCombatContext.mockResolvedValue(combatContext);
  buildSaveDc.mockReturnValue(dc);
  resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  getRuntimeValue.mockImplementation((_caster, key) => {
    if (key === 'activeConditions') return activeConditions;
    if (key === 'targetEffects') return targetEffects;
    if (key === 'activeConditionMeta') return activeConditionMeta;
    return [];
  });
  createSaveListener.mockReturnValue({ promptId, promise: Promise.resolve(saveResult) });
}
