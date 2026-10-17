// @maintained-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackAoeModal from './SaveAttackAoeModal.jsx';

// Picker-lane tests use the REAL CreatureSelectionModal: SaveAttackAoeModal
// never passes campaignName/attackerName to it, so its overlay-lookup effect
// early-returns and it renders deterministically without map/network mocks.
// AreaEffectTargetModalBase is never mounted on this lane (no 'overlay-'
// targetName) — its lane lives in SaveAttackAoeModal.overlay.test.jsx.

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
    const confirmBtn = screen.getByRole('button', { name: /Fireball \(1\)/ });
    expect(confirmBtn).not.toBeDisabled();

    fireEvent.click(checkboxFor('Goblin A'));
    expect(checkboxFor('Goblin A')).not.toBeChecked();
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
});
