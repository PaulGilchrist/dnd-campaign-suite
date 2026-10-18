// @maintained-by-ai
// EncounterBuilder lane: residual interaction wiring NOT owned by sibling files.
// This lane uniquely owns: the Join-button selection gate (visibility only — the Join
// dispatch with exact log/initiative payloads is #399 additional-interactions), the
// generator modal open → Apply → close wiring (handleApplySuggestion + showGenerator
// seam), and selected-monster preservation in the table when filters exclude them.
// Owned elsewhere — do NOT duplicate: row qty/remove/Clear All/monster-card byte
// canon (#406 panel-interactions), sort/Join dispatch/save-modal commit/thresholds
// (#399 additional-interactions — its save flow subsumes the old openSaveModal spy
// test here), XP summary (#400 gameplay-flows), localStorage/filter/bands (#401
// helpers), load hydrate/reconcile (#403 load-encounter), reset (#405 reset-encounter),
// delete/rename confirmations (uncovered-handlers), modal-null render (rendering),
// PreviewToggle edit/onChange behavior (PreviewToggle.test.jsx — subsumes the old
// mocked-textarea description test here).
// Runs the REAL filter/summary/table/selected panels, PreviewToggle, and pure
// encounterGenerator/encountersService math; only hooks, network, and heavy modals
// are stubbed at the seam. The former hand-written panel-replica mock block was
// deleted (#406 pattern) — it re-implemented panel logic inside the test and could
// never fail when the real panels broke.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(),
}));

vi.mock('../../hooks/management/useEncounterManagement.js', () => ({
  default: vi.fn(),
}));

// viewingMonster lives in the runtime store but is never driven by this lane;
// local passthrough state is enough (same pattern as additional-interactions).
vi.mock('../../hooks/runtime/useSyncedState.js', async () => {
  const React = await import('react');
  return {
    useSyncedState: (_key, _prop, initial) => React.useState(initial),
  };
});

// Sever network seams (never invoked with exact payloads in this lane).
vi.mock('../../services/encounters/encounterToInitiative.js', () => ({
  addMonstersToInitiative: vi.fn(async () => {}),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

// Heavy modals stubbed: EncounterModal/MonsterCardModal never open here; the
// generator stub exposes the only two seams this component wires — Apply and Close.
vi.mock('./EncounterModal.jsx', () => ({ default: () => null }));
vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));
vi.mock('./EncounterGeneratorModal.jsx', () => ({
  default: ({ onApply, onClose }) => (
    <div role="dialog" aria-label="Encounter generator">
      <button
        type="button"
        onClick={() => onApply([{ index: 'suggested-goblin', name: 'Suggested Goblin', xp: 50, challenge_rating: 0.25 }])}
      >
        Apply Suggestion
      </button>
      <button type="button" aria-label="Close generator" onClick={onClose}>Close</button>
    </div>
  ),
}));

import EncounterBuilder from './EncounterBuilder.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import useEncounterManagement from '../../hooks/management/useEncounterManagement.js';

const CAMPAIGN = 'test-campaign';

const GOBLIN = { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid', environments: ['forest'] };
const ORC = { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5, type: 'humanoid', environments: ['hill', 'mountain'] };
const MONSTERS = [GOBLIN, ORC, { index: 'dragon', name: 'Young Dragon', xp: 120, challenge_rating: 2, type: 'dragon', environments: ['underground'] }];
const CHARACTERS = [{ name: 'Thorin', level: 5 }, { name: 'Elara', level: 3 }];

function mountBuilder({ characters = CHARACTERS } = {}) {
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
    loadEncounterData: vi.fn(async () => null),
    deleteEncounterAction: vi.fn(async () => {}),
    renameEncounterAction: vi.fn(async () => {}),
  });
  return render(
    <EncounterBuilder
      campaignName={CAMPAIGN}
      characters={characters ? characters.map((c) => ({ ...c })) : characters}
      onJoinEncounter={vi.fn()}
    />
  );
}

const rowFor = (container, name) =>
  Array.from(container.querySelectorAll('tbody tr'))
    .find((tr) => tr.querySelector('.col-name')?.textContent === name);

const selectedTitle = () => {
  const panel = document.querySelector('.encounter-selected');
  return panel ? panel.querySelector('.encounter-selected-title').textContent : null;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('EncounterBuilder - residual interactions', () => {
  it('shows the Join Encounter button only while monsters are selected', () => {
    mountBuilder();
    expect(screen.queryByRole('button', { name: 'Join Encounter' })).toBeNull();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Goblin' }));
    expect(screen.getByRole('button', { name: 'Join Encounter' })).toBeInTheDocument();

    // Deselect back to zero — the gate closes again.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Goblin' }));
    expect(screen.queryByRole('button', { name: 'Join Encounter' })).toBeNull();
  });

  it('Generate opens the generator modal, Apply loads the suggested roster, Close dismisses the modal', () => {
    mountBuilder();
    expect(screen.queryByRole('dialog', { name: 'Encounter generator' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Generate encounter' }));
    expect(screen.getByRole('dialog', { name: 'Encounter generator' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Apply Suggestion' }));
    expect(selectedTitle()).toBe('Selected Monsters (1)');
    expect(screen.getByText('Suggested Goblin')).toBeInTheDocument();

    // Close only unmounts the generator — the applied roster survives.
    fireEvent.click(screen.getByRole('button', { name: 'Close generator' }));
    expect(screen.queryByRole('dialog', { name: 'Encounter generator' })).toBeNull();
    expect(selectedTitle()).toBe('Selected Monsters (1)');
  });

  it('keeps a selected monster in the table when the type filter excludes it, dropping only unmatched unselected rows', () => {
    const { container } = mountBuilder();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Goblin' }));

    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'dragon' } });

    // Selected Goblin is force-listed despite failing the dragon-type filter.
    const goblinRow = rowFor(container, 'Goblin');
    expect(goblinRow).toBeTruthy();
    expect(goblinRow.querySelector('.monster-checkbox').checked).toBe(true);
    expect(rowFor(container, 'Young Dragon')).toBeTruthy();
    // Unselected Orc fails the filter and is correctly dropped.
    expect(rowFor(container, 'Orc')).toBeUndefined();
  });

  it('renders default header chrome: title, Save/Load/Generate actions, no Reset, and the party summary', () => {
    mountBuilder();

    expect(screen.getByRole('heading', { level: 2, name: 'Encounter Builder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save encounter' })).toHaveTextContent('Save');
    expect(screen.getByRole('button', { name: 'Load encounter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate encounter' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset encounter' })).toBeNull();

    const party = document.querySelector('.party-summary');
    expect(party).toBeTruthy();
    expect(within(party).getByText('Thorin')).toBeInTheDocument();
    expect(within(party).getByText('Lv5')).toBeInTheDocument();
    expect(within(party).getByText('Elara')).toBeInTheDocument();
    expect(within(party).getByText('Lv3')).toBeInTheDocument();
  });

  it.each([
    ['empty', []],
    ['null', null],
  ])('shows the no-characters notice when characters is %s', (_label, characters) => {
    mountBuilder({ characters });
    expect(screen.getByText(/No characters in this campaign/)).toBeInTheDocument();
    expect(document.querySelectorAll('.party-member-tag')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Save encounter' })).toBeInTheDocument();
  });
});
