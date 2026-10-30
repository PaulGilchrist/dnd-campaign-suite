// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// Picker-lane tests use the REAL CreatureSelectionModal. SaveAttackAoeModal
// DOES pass campaignName/attackerName/rangeFt (overlay auto-select wiring), but
// every lookup seam resolves empty here: the mocked combatSummary has no
// 'overlay-' targetName (getCurrentOverlayTarget → null) and the mocked
// getRuntimeValue has no active map (getTargetMapStatuses → null), so the
// effect auto-selects nothing and the picker still renders deterministically
// without map/network mocks. The armed-overlay auto-select face is pinned in
// SaveAttackAoeModal.overlay-auto-select.test.jsx.
// AreaEffectTargetModalBase is never mounted on this lane (no 'overlay-'
// targetName) — its lane lives in SaveAttackAoeModal.overlay.test.jsx.
// maxTargets: SaveAttackAoeModal never passes it to the picker mount
// (SaveAttackAoeModal.jsx:2014-2027), so the cap guard is intentionally NOT
// pinned here — pinning it would require fabricating a prop the host never
// sends. It lives in CreatureSelectionModal.test.jsx:268/:283.
// Confirm-click payload resolution also lives outside this lane (damage-
// resolution / blocking-effects); here we pin the picker UI contract only.

// ── Mocked modules (data seams only) ──

vi.mock('../../../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin A', type: 'npc', currentHp: 5, maxHp: 10, resistances: [], immunities: [] },
      { name: 'Goblin B', type: 'npc', currentHp: 3, maxHp: 10, resistances: [], immunities: [] },
      { name: 'Player One', type: 'player', currentHp: 20, maxHp: 30 },
    ],
  })),
  setCombatSummaryCache: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => null),
}));

// ── Re-import mocked modules ──

import * as allySelection from '../../../../hooks/useAllySelection.js';

// ── Test fixtures ──

const mockAction = {
  name: 'Fireball',
  automation: {
    scaling: { damage: '8d6' },
  },
};

const baseProps = {
  action: mockAction,
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

function makeProps(overrides) {
  return { ...baseProps, ...overrides };
}

function rowFor(name) {
  return [...document.querySelectorAll('.secondary-target-row')]
    .find(row => row.textContent.includes(name));
}

function checkboxFor(name) {
  return rowFor(name).querySelector('input[type="checkbox"]');
}

// ── Tests ──

describe('SaveAttackAoeModal - CreatureSelectionModal picker lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the picker with action title, save copy, damage note, and one row per combatant', () => {
    render(<SaveAttackAoeModal {...makeProps({ saveType: 'CON', saveDc: 18 })} />);

    expect(screen.getByText('Fireball')).toBeInTheDocument();
    expect(document.querySelector('.sp-header .fa-bomb')).toBeInTheDocument();
    // buildPickerCopy: head + default half-damage note.
    expect(screen.getByText('CON')).toBeInTheDocument();
    expect(screen.getByText(/saving throw \(DC 18\)/)).toBeInTheDocument();
    expect(screen.getByText(/On a failed save, target takes 8d6 Fire damage\. On a successful save, target takes half damage\./)).toBeInTheDocument();
    // Every combatant selectable; confirm starts disabled with a zero count.
    for (const name of ['Goblin A', 'Goblin B', 'Player One']) {
      expect(rowFor(name)).toBeInTheDocument();
      expect(checkboxFor(name)).not.toBeChecked();
    }
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /Fireball \(0\)/ })).toBeDisabled();
  });

  it('tracks selection in the confirm button and Skip closes the modal', () => {
    const onClose = vi.fn();
    render(<SaveAttackAoeModal {...makeProps({ onClose })} />);

    fireEvent.click(checkboxFor('Goblin A'));
    expect(checkboxFor('Goblin A')).toBeChecked();
    // Real modal stamps the highlight class on the selected row (CreatureSelectionModal.jsx:96).
    expect(rowFor('Goblin A').className).toContain('secondary-target-selected');
    expect(rowFor('Goblin B').className).not.toContain('secondary-target-selected');
    const confirmBtn = screen.getByRole('button', { name: /Fireball \(1\)/ });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(checkboxFor('Goblin A'));
    expect(checkboxFor('Goblin A')).not.toBeChecked();
    expect(rowFor('Goblin A').className).not.toContain('secondary-target-selected');
    expect(screen.getByRole('button', { name: /Fireball \(0\)/ })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('badges careful-protected allies and heighten radios only when the metamagics are armed', () => {
    allySelection.getAllyList.mockReturnValue(['Goblin A']);

    // Disarmed face: no badges, no radios — byte-inert default.
    const { unmount } = render(<SaveAttackAoeModal {...makeProps()} />);
    expect(screen.queryByText(/Careful Spell protected/)).not.toBeInTheDocument();
    expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(0);
    unmount();

    render(<SaveAttackAoeModal {...makeProps({ metamagicCareful: true, metamagicHeighten: true })} />);
    expect(allySelection.getAllyList).toHaveBeenCalledWith('Cleric1');
    expect(rowFor('Goblin A').textContent).toContain('Careful Spell protected');
    expect(rowFor('Goblin B').textContent).not.toContain('Careful Spell protected');
    expect(rowFor('Player One').textContent).not.toContain('Careful Spell protected');
    expect(document.querySelectorAll('input[name="heightenTarget"]')).toHaveLength(3);
  });

  it('threads heighten selection through the host state into the real modal radio group', () => {
    render(<SaveAttackAoeModal {...makeProps({ metamagicHeighten: true })} />);

    // Host threads heightenTarget/setHeightenTarget (SaveAttackAoeModal.jsx:2025-2026):
    // clicking Goblin B's radio marks ONLY that row's radio checked via host state.
    expect(rowFor('Goblin B').textContent).toContain('Heighten');
    fireEvent.click(rowFor('Goblin B').querySelector('input[type="radio"]'));
    expect(rowFor('Goblin B').querySelector('input[type="radio"]')).toBeChecked();
    expect(rowFor('Goblin A').querySelector('input[type="radio"]')).not.toBeChecked();
    expect(rowFor('Player One').querySelector('input[type="radio"]')).not.toBeChecked();

    // Choosing a different target moves the single heighten stamp (radio semantics
    // plus host state — no second radio may stay checked).
    fireEvent.click(rowFor('Goblin A').querySelector('input[type="radio"]'));
    expect(rowFor('Goblin A').querySelector('input[type="radio"]')).toBeChecked();
    expect(rowFor('Goblin B').querySelector('input[type="radio"]')).not.toBeChecked();
  });
});
