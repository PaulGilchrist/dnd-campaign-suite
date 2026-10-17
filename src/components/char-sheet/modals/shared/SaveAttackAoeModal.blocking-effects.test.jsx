// @maintained-by-ai
// Blocking-effects lane for SaveAttackAoeModal: the component-local trap blocking truth
// table (TRAP_BLOCKING_EFFECTS / trapEffectBlocksAttack applied via buildEligibleTargets,
// SaveAttackAoeModal.jsx:523-541) driven through the REAL CreatureSelectionModal picker
// (no component stub — overlay lane is inert here: no targetName on playerStats).
// The base modal's own trap table is owned by AreaEffectTargetModalBase.targets.test.jsx
// and AOEConditionModal.results.test.jsx; lane split noted in SaveAttackAoeModal.test.jsx.

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// ── Mocked modules (services only — writes/network kept out of the harness) ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [10], modifier: 0, formula: '1d20' })),
  rollExpressionMaximized: vi.fn(() => ({ total: 10, rolls: [10], modifier: 0, formula: '1d20', maximized: true })),
}));

vi.mock('../../../../services/combat/automation/automationExpressions.js', () => ({
  resolveScaling: vi.fn(() => ({})),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
  computeDamageAfterSave: vi.fn((raw, _success, dcSuccess) => {
    if (!_success) return raw;
    return dcSuccess === 'half' ? Math.floor(raw / 2) : 0;
  }),
  computeDamageAfterEvasion: vi.fn((raw, _success, dcSuccess) => {
    return dcSuccess === 'half' ? Math.floor(raw / 2) : raw;
  }),
  computeDamageAfterResistancesWithDetails: vi.fn(({ rawDamage }) => ({ finalDamage: rawDamage })),
  hasEvasionForSave: vi.fn(() => false),
  normalizeSaveType: vi.fn((t) => t),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => null),
}));

vi.mock('../../../../services/automation/common/damageRollback.js', () => ({
  storeSpellLastAttack: vi.fn(),
  addTargetResult: vi.fn(),
}));

// ── Re-import mocked modules ──

import { getRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatSummary } from '../../../../services/encounters/combatData.js';

// ── Fixtures ──

const combatSummary = {
  creatures: [
    { name: 'Goblin A', type: 'npc', currentHp: 5, maxHp: 10 },
    { name: 'Goblin B', type: 'npc', currentHp: 3, maxHp: 10 },
    { name: 'Orc', type: 'npc', currentHp: 7, maxHp: 15 },
    { name: 'Ogre', type: 'npc', currentHp: 20, maxHp: 23 },
    { name: 'Zombie', type: 'npc', currentHp: 11, maxHp: 22 },
    { name: 'Player One', type: 'player', currentHp: 20, maxHp: 30 },
  ],
};

const baseProps = {
  action: { name: 'Fireball', automation: { scaling: { damage: '8d6' } } },
  playerStats: { name: 'Cleric1', level: 12 },
  campaignName: 'test-campaign',
  range: 20,
  damage: '8d6',
  damageType: 'Fire',
  saveType: 'DEX',
  saveDc: 15,
  dcSuccess: 'half',
  onClose: vi.fn(),
};

// campaign targetEffects is the sole trap read on this lane; everything else stays null.
function setTargetEffects(effects) {
  getRuntimeValue.mockImplementation((_scope, key) => (key === 'targetEffects' ? effects : null));
}

function checkboxFor(name) {
  return screen.queryByRole('checkbox', { name: new RegExp(name) });
}

// ── Tests ──

describe('SaveAttackAoeModal - Blocking effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReturnValue(null);
    getCombatSummary.mockReturnValue(combatSummary);
  });

  it('excludes every target trapped by any trap effect; untrapped and non-trap-effect creatures stay selectable', () => {
    // One creature per TRAP_BLOCKING_EFFECTS entry (forcecage/maze/banishment/imprisonment)
    // plus a non-trap effect holder and a free creature as selectable negatives.
    setTargetEffects([
      { effect: 'forcecage', target: 'Goblin A', source: 'Wizard2' },
      { effect: 'maze', target: 'Goblin B', source: 'Wizard2' },
      { effect: 'banishment', target: 'Orc', source: 'Wizard2' },
      { effect: 'imprisonment', target: 'Ogre', source: 'Wizard2' },
      { effect: 'restrained', target: 'Zombie', source: 'Wizard2' },
    ]);

    render(<SaveAttackAoeModal {...baseProps} />);

    expect(checkboxFor('Goblin A')).toBeNull();
    expect(checkboxFor('Goblin B')).toBeNull();
    expect(checkboxFor('Orc')).toBeNull();
    expect(checkboxFor('Ogre')).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
    expect(checkboxFor('Zombie')).toBeInTheDocument();
    expect(checkboxFor('Player One')).toBeInTheDocument();
  });

  it('when the attacker is trapped, only a creature sharing the same trap effect AND source remains selectable', () => {
    // Attacker Cleric1 is forcecaged by Wizard1.
    // Goblin A: same effect + same source → shared cage, targetable.
    // Goblin B: same effect, different source → blocked.
    // Orc: same source, different effect → blocked.
    // Everyone untrapped → blocked while the attacker is trapped.
    setTargetEffects([
      { effect: 'forcecage', target: 'Cleric1', source: 'Wizard1' },
      { effect: 'forcecage', target: 'Goblin A', source: 'Wizard1' },
      { effect: 'forcecage', target: 'Goblin B', source: 'Wizard2' },
      { effect: 'maze', target: 'Orc', source: 'Wizard1' },
    ]);

    render(<SaveAttackAoeModal {...baseProps} />);

    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(checkboxFor('Goblin A')).toBeInTheDocument();
    expect(checkboxFor('Goblin B')).toBeNull();
    expect(checkboxFor('Orc')).toBeNull();
    expect(checkboxFor('Ogre')).toBeNull();
    expect(checkboxFor('Player One')).toBeNull();
  });
});
