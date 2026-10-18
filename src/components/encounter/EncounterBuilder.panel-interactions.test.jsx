// @maintained-by-ai
// EncounterBuilder lane: table-row / selected-panel interactions + monster card modal.
// This lane uniquely owns (per lane map): checkbox toggle incl. decrement-to-zero,
// row qty controls visibility, row + selected-panel remove buttons, Clear All,
// monster card modal open/close via the REAL viewingMonster runtime-store payloads,
// and the empty-description initial state.
// Owned elsewhere — do NOT duplicate: sort/Join/save/thresholds (#399
// additional-interactions), XP summary recomputation (#400 gameplay-flows),
// localStorage/filter/bands (#401 helpers), load hydration/reconcile (#403
// load-encounter), reset (#405 reset-encounter), delete/rename
// (uncovered-handlers), modal-null render (rendering).
// Runs the REAL filter/summary/table/selected panels + PreviewToggle; only the
// heavy modals are stubbed at the seam. The former hand-written panel-replica
// mocks were deleted — they re-implemented panel logic inside the test and could
// never fail when the real panels broke. Predecessor lanes interactions /
// modal-flows / modal-interactions were deleted (#402/#404/#405), so all former
// citations to them are retired here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(),
}));

vi.mock('../../hooks/management/useEncounterManagement.js', () => ({
  default: vi.fn(),
}));

// Heavy modals stubbed: EncounterModal/GeneratorModal stay closed in this lane;
// MonsterCardModal is opened but only its open/close seam matters — the stat block
// itself is covered by the MonsterCardModal.* lanes.
vi.mock('./EncounterModal.jsx', () => ({ default: () => null }));
vi.mock('./EncounterGeneratorModal.jsx', () => ({ default: () => null }));
vi.mock('./MonsterCardModal.jsx', () => ({
  default: ({ monster, onClose }) => (
    <div role="dialog" aria-label={`Monster card: ${monster.name}`}>
      <span>{monster.name}</span>
      <button type="button" aria-label="Close monster card" onClick={onClose}>Close</button>
    </div>
  ),
}));

// Sever server persistence (shared store Map so useSyncedState's store reads stay
// consistent across renders); the setRuntimeValue spy pins viewingMonster bytes.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  const store = new Map();
  return {
    getStore: vi.fn(() => store),
    setRuntimeValue: vi.fn(),
    listeners: new Map(),
  };
});
vi.mock('../../services/encounters/encounterToInitiative.js', () => ({
  addMonstersToInitiative: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

import EncounterBuilder from './EncounterBuilder.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import useEncounterManagement from '../../hooks/management/useEncounterManagement.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const CAMPAIGN = 'test-campaign';

const GOBLIN = { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid', environments: ['forest'] };
const ORC = { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5, type: 'humanoid', environments: ['hill', 'mountain'] };
const MONSTERS = [GOBLIN, ORC, { index: 'dragon', name: 'Young Dragon', xp: 120, challenge_rating: 2, type: 'dragon', environments: ['underground'] }];

function mountBuilder() {
  // Fresh deep-copied props per render so mutations never bleed between tests.
  const freshMonsters = MONSTERS.map((m) => ({ ...m, environments: [...m.environments] }));
  useMonstersData.mockReturnValue({ monsters: freshMonsters, loading: false });
  useEncounterManagement.mockReturnValue({
    modalOpen: false,
    modalMode: null,
    encounters: [],
    loading: false,
    openSaveModal: vi.fn(),
    openLoadModal: vi.fn(),
    closeModal: vi.fn(),
    saveEncounter: vi.fn(),
    updateEncounter: vi.fn(),
    loadEncounterData: vi.fn(),
    deleteEncounterAction: vi.fn(),
    renameEncounterAction: vi.fn(),
  });
  return render(
    <EncounterBuilder campaignName={CAMPAIGN} characters={[{ name: 'Thorin', level: 5 }, { name: 'Elara', level: 3 }]} onJoinEncounter={vi.fn()} />
  );
}

const rowFor = (container, name) =>
  Array.from(container.querySelectorAll('tbody tr'))
    .find((tr) => tr.querySelector('.col-name').textContent === name);

const selectedTitle = () => {
  const panel = document.querySelector('.encounter-selected');
  return panel ? panel.querySelector('.encounter-selected-title').textContent : null;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('EncounterBuilder - panel interactions', () => {
  it('drives row qty controls: unselected shows em-dash, select reveals qty 1, + raises, decrements to zero deselect', () => {
    const { container } = mountBuilder();
    const checkbox = screen.getByRole('checkbox', { name: 'Select Goblin' });
    const qtyCell = () => rowFor(container, 'Goblin').querySelector('.col-qty');

    // Unselected row: em-dash placeholder, no qty controls, no selected panel.
    expect(checkbox.checked).toBe(false);
    expect(qtyCell().querySelector('.qty-value').textContent).toBe('\u2014');
    expect(qtyCell().querySelector('.qty-btn')).toBeNull();
    expect(selectedTitle()).toBeNull();

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
    expect(qtyCell().querySelector('.qty-value').textContent).toBe('1');
    expect(qtyCell().querySelectorAll('.qty-btn')).toHaveLength(2);
    expect(selectedTitle()).toBe('Selected Monsters (1)');

    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Goblin' }));
    expect(qtyCell().querySelector('.qty-value').textContent).toBe('2');
    expect(selectedTitle()).toBe('Selected Monsters (2)');

    // 2 → 1 → 0: qty hits zero and the monster deselects, row chrome reverts.
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity of Goblin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Decrease quantity of Goblin' }));
    expect(checkbox.checked).toBe(false);
    expect(qtyCell().querySelector('.qty-value').textContent).toBe('\u2014');
    expect(qtyCell().querySelector('.qty-btn')).toBeNull();
    expect(selectedTitle()).toBeNull();
  });

  it('removes monsters via the row remove button and the selected-panel remove button, leaving other selections intact', () => {
    const { container } = mountBuilder();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Goblin' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Orc' }));
    expect(selectedTitle()).toBe('Selected Monsters (2)');

    // Row remove button drops Goblin; Orc survives in the selected panel.
    const table = within(container.querySelector('.encounter-monster-table-section'));
    fireEvent.click(table.getByRole('button', { name: 'Remove Goblin' }));
    expect(within(container.querySelector('.encounter-selected')).queryByText('Goblin')).toBeNull();
    expect(within(container.querySelector('.encounter-selected')).getByText('Orc')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Goblin' }).checked).toBe(false);
    // Row stays listed, its remove button unmounts with the zero qty.
    expect(rowFor(container, 'Goblin').querySelector('.remove-btn')).toBeNull();

    // Selected-panel remove button clears Orc; panel unmounts, row remains in table.
    fireEvent.click(within(container.querySelector('.encounter-selected')).getByRole('button', { name: 'Remove Orc' }));
    expect(selectedTitle()).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Select Orc' }).checked).toBe(false);
    expect(rowFor(container, 'Orc')).toBeInTheDocument();
  });

  it('Clear All appears only with a selection and removes every selected monster', () => {
    mountBuilder();
    expect(screen.queryByRole('button', { name: 'Clear All' })).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Goblin' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Orc' }));
    expect(selectedTitle()).toBe('Selected Monsters (2)');

    fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
    expect(screen.queryByRole('button', { name: 'Clear All' })).toBeNull();
    expect(selectedTitle()).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Select Goblin' }).checked).toBe(false);
    expect(screen.getByRole('checkbox', { name: 'Select Orc' }).checked).toBe(false);
  });

  it('opens the monster card modal from the row and selected panel with the exact viewingMonster payload, and closes it', () => {
    const { container } = mountBuilder();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Goblin' }));

    // Row details button writes the full bestiary object to the synced store slot.
    const table = within(container.querySelector('.encounter-monster-table-section'));
    fireEvent.click(table.getByRole('button', { name: 'View details for Goblin' }));
    expect(screen.getByRole('dialog', { name: 'Monster card: Goblin' })).toBeInTheDocument();
    expect(setRuntimeValue).toHaveBeenCalledWith('campaign', 'encounter-viewingMonster', GOBLIN, CAMPAIGN);

    fireEvent.click(screen.getByRole('button', { name: 'Close monster card' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(setRuntimeValue).toHaveBeenLastCalledWith('campaign', 'encounter-viewingMonster', null, CAMPAIGN);

    // Selected-panel View button drives the same store slot but passes the SELECTED
    // entry — same bestiary bytes plus the live qty.
    fireEvent.click(within(container.querySelector('.encounter-selected')).getByRole('button', { name: 'View details for Goblin' }));
    expect(screen.getByRole('dialog', { name: 'Monster card: Goblin' })).toBeInTheDocument();
    expect(setRuntimeValue).toHaveBeenLastCalledWith('campaign', 'encounter-viewingMonster', { ...GOBLIN, qty: 1 }, CAMPAIGN);

    fireEvent.click(screen.getByRole('button', { name: 'Close monster card' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(setRuntimeValue).toHaveBeenLastCalledWith('campaign', 'encounter-viewingMonster', null, CAMPAIGN);
  });

  it('starts with an empty description', () => {
    mountBuilder();
    expect(screen.getByLabelText('Description')).toHaveValue('');
  });
});
