// @maintained-by-ai 2026-11-27
// ── Scope (ally-modal lane, 2026-11-27 audit-trim) ──────────────────────────
// The ally-facing surface of the GM monster card modal: the footer "Allies
// (N)" badge (MonsterCardBody.jsx mc-footer) and the AllySelectionModal it
// mounts (MonsterCardModal.jsx handleAllyModalOpen/Confirm/Cancel,
// resolveCurrentAllies). Pins:
//   - resolveCurrentAllies both arms: stored list vs default [monsterName]
//   - badge click mounts the modal populated from getCombatSummary (rows
//     rendered) with currentAllies pre-checked through the open handler
//   - confirm writes setRuntimeValue('selectedAllies', …) AND logs the
//     'Ally Selection' ability_use entry (repo rule: every automation logs),
//     then closes; cancel is a zero-write close witness.
// NOT this lane: AllySelectionModal internals — row/Player/NPC/HP% display,
// bulk actions, confirm-gate, Escape/backdrop → AllySelectionModal.test.jsx
// and .dismiss.test.jsx; stat-block render, dice chips, legendary
// ally-prerequisite gate → the sibling MonsterCardModal.* lanes.
// Trim 2026-11-27 (6 → 5): "passes combat summary creatures" (bare
// getCombatSummary toHaveBeenCalled, never contradicted on output) folded
// into the open test as rendered-row assertions; confirm/cancel upgraded to
// accessible exact-name queries, full-shape log pin, and zero-write
// witnesses; no-op waitFor on synchronous handler writes dropped; dead
// __set* mock setters and the _setPopupHtml phantom export purged.

import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => String(html || '')),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({
    attackAdvantageCount: 0,
    attackDisadvantageCount: 0,
    abilityCheckDisadvantage: false,
    autoFailSaves: [],
    saveDisadvantage: [],
    cannotAct: false,
    speedZero: false,
    concentrationBroken: false,
    targetAdvantageCount: 0,
    targetDisadvantageCount: 0,
    targetAdvantageIfWithin5ft: false,
    targetDisadvantageIfBeyond5ft: false,
    autoCritWithin5ft: false,
    resistantToAll: false,
    poisonImmune: false,
    saveAdvantage: [],
    saveAdvantageCount: 0,
    saveDisadvantageCount: 0,
    autoReroll: false,
    autoRerollCondition: null,
    autoRerollBonus: null,
    strSaveReplace: false,
    strCheckReplace: false,
    reliableTalent: false,
    tacticalMind: false,
    tacticalMindBonus: null,
  })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(() => ({ name: 'Goblin', conditions: [] })),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => {
    if (typeof range === 'number') return range;
    if (range === 'touch') return 8;
    if (!range) return null;
    const m = range.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 30;
  }),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn((_abilities, _abilityKey) => 0),
}));

// Producer-shaped: the open handler maps {name, type, currentHp, maxHp} off
// combatSummary.creatures (MonsterCardModal.jsx handleAllyModalOpen).
vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin', type: 'npc', currentHp: 7, maxHp: 7 },
      { name: 'Player A', type: 'player', currentHp: 10, maxHp: 10 },
      { name: 'Player B', type: 'player', currentHp: 8, maxHp: 8 },
    ],
  })),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  let _selectedAllies = null;

  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'selectedAllies') return _selectedAllies;
    return null;
  });

  return {
    useRuntimeValue: mockUseRuntimeValue,
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(() => null),
    __setSelectedAllies(val) { _selectedAllies = val; },
  };
});

// ── Re-import mocked modules for test assertions ───────────────────────────

import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - ally badge + AllySelectionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRuntimeState.__setSelectedAllies(null);
  });

  const openAllyModal = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Allies (1)' }));
  };

  it('defaults the ally badge to the monster alone (count 1) when no allies are stored', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByRole('button', { name: 'Allies (1)' })).toBeInTheDocument();
  });

  it('ally badge count reflects the stored selectedAllies list', () => {
    useRuntimeState.__setSelectedAllies(['Goblin', 'Player A']);
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByRole('button', { name: 'Allies (2)' })).toBeInTheDocument();
  });

  it('badge click mounts the ally modal populated from the combat summary, with current allies pre-checked', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);

    const badge = screen.getByRole('button', { name: 'Allies (1)' });
    expect(badge).toHaveAttribute('title', 'Manage allies');
    fireEvent.click(badge);

    // Modal header (AllySelectionModal default title, exact copy).
    expect(screen.getByText('Select Allies')).toBeInTheDocument();

    // Rows rendered from the getCombatSummary-mapped creatures — the only
    // way these names reach the modal is handleAllyModalOpen's mapping.
    expect(screen.getByRole('checkbox', { name: 'Select Goblin' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Player A' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Player B' })).toBeInTheDocument();
    // currentHp/maxHp survive the mapping: Goblin is non-player → HP% shown
    // (7/7 → 100%; players render no HP chip).
    expect(within(screen.getByRole('checkbox', { name: 'Select Goblin' }).closest('label')).getByText('(100% HP)')).toBeInTheDocument();
    expect(within(screen.getByRole('checkbox', { name: 'Select Player A' }).closest('label')).queryByText('(100% HP)')).not.toBeInTheDocument();

    // resolveCurrentAllies default [monsterName] threads through the
    // currentAllies prop: the Goblin row arrives pre-checked.
    expect(screen.getByRole('checkbox', { name: 'Select Goblin' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Player A' })).not.toBeChecked();
  });

  it('confirm writes selectedAllies, logs the Ally Selection ability use, and closes the modal', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    openAllyModal();

    // Goblin arrives pre-checked (default [monsterName]); add Player A.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Player A' }));

    const confirmBtn = screen.getByRole('button', { name: 'Confirm Allies (2)' });
    expect(confirmBtn).toBeEnabled();
    fireEvent.click(confirmBtn);

    // Handler body is synchronous through both writes — no waitFor needed.
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Goblin',
      'selectedAllies',
      ['Goblin', 'Player A'],
      'test-campaign'
    );
    expect(addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'ability_use',
      characterName: 'Goblin',
      abilityName: 'Ally Selection',
      description: 'Goblin selected allies: Goblin, Player A',
      timestamp: expect.any(Number),
    });
    expect(screen.queryByText('Select Allies')).not.toBeInTheDocument();
  });

  it('cancel closes the modal with zero writes', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    openAllyModal();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Select Allies')).not.toBeInTheDocument();
    // Zero-action witness: dismissing the draft never persists or logs.
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
