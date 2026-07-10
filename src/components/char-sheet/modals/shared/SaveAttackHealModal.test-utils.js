// Shared test utilities for SaveAttackHealModal tests

export const baseProps = {
  combatSummary: {
    creatures: [
      { name: 'Goblin A', type: 'npc' },
      { name: 'Goblin B', type: 'npc' },
      { name: 'Player One', type: 'player', currentHitPoints: 100 },
    ],
  },
  attackerName: 'Cleric1',
  attackerPos: { gridX: 1, gridY: 1 },
  saveDc: 10,
  campaignName: 'test-campaign',
  mapData: null,
  featureName: 'Divine Smite',
  saveType: 'CON',
  rangeFeet: 30,
  damageExpression: '4d6',
  damageType: 'Radiant',
  healExpression: '2d8',
  onClose: vi.fn(),
};

export function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

export function getCheckboxByName(name) {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  for (const cb of checkboxes) {
    const label = cb.closest('label');
    if (label && label.textContent.includes(name)) {
      return cb;
    }
  }
  throw new Error(`Checkbox for "${name}" not found`);
}
