// @maintained-by-ai
/* Lane #405 — Reset button → handleReset state-wipe contract (EncounterBuilder.jsx:395-413).
 * handleReset touches ONLY component-local useState (EncounterBuilder.jsx:184-214) —
 * it never calls save/update/delete endpoints and never writes localStorage. The load
 * precondition uses the management-hook mock below (not the real
 * useEncounterManagement/useSyncedState) precisely so that server isolation is provable:
 * no real network layer exists in this file at all.
 * Runs the REAL header, filter panel, summary panel, monster table, selected panel,
 * PreviewToggle and EncounterModal (#406 pattern — hand-written panel replicas deleted).
 * Owned elsewhere — do NOT duplicate: load hydrate/reconcile (#403 load-encounter),
 * sort/Join dispatch/save-modal commit (#399 additional-interactions), XP bands (#400
 * gameplay-flows), localStorage/filter persistence (#401 helpers), row chrome/clear-all
 * (#406 panel-interactions), generator-apply/header gate/default-no-Reset chrome (#407
 * remaining). Reset-button-absent-when-no-encounter is green in remaining.test.jsx:163;
 * its post-reset counterpart (setCurrentEncounterName(null)) is pinned here. */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Stubbed seams: data hooks, network, heavy stat-block modal. The management mock
// uses real useState so opening/closing the load modal triggers genuine re-renders
// (no getter + forced-render hacks). XP math constants keep this lane independent
// of the #400/#401 bands.
const h = vi.hoisted(() => ({
  loadEncounterData: vi.fn(),
  updateEncounter: vi.fn(),
  saveEncounter: vi.fn(),
  openSaveModal: vi.fn(),
}));

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(),
}));

vi.mock('../../hooks/management/useEncounterManagement.js', async () => {
  const React = await import('react');
  // Named `use...` so rules-of-hooks accepts the internal useState calls.
  function useEncounterManagement() {
    const [modalMode, setModalMode] = React.useState(null);
    return {
      modalOpen: modalMode !== null,
      modalMode,
      encounters: [{ name: 'test-encounter' }],
      loading: false,
      openSaveModal: () => { setModalMode('save'); h.openSaveModal(); },
      openLoadModal: () => setModalMode('load'),
      closeModal: () => setModalMode(null),
      saveEncounter: h.saveEncounter,
      updateEncounter: h.updateEncounter,
      loadEncounterData: h.loadEncounterData,
      deleteEncounterAction: vi.fn(),
      renameEncounterAction: vi.fn(),
    };
  }
  return { default: useEncounterManagement };
});

// viewingMonster lives in the runtime store but is never driven by this lane
// (same local passthrough as remaining.test.jsx).
vi.mock('../../hooks/runtime/useSyncedState.js', async () => {
  const React = await import('react');
  return {
    useSyncedState: (_key, _prop, initial) => React.useState(initial),
  };
});

vi.mock('../../services/encounters/encounterGenerator.js', () => ({
  calculateXPThreshold: vi.fn(() => 100),
  calculateDifficultyMultiplier: vi.fn(() => 1),
}));

vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));

vi.mock('../../services/encounters/encounterToInitiative.js', () => ({
  addMonstersToInitiative: vi.fn(async () => {}),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

import EncounterBuilder from './EncounterBuilder.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';

const CAMPAIGN = 'test-campaign';
const CHARACTERS = [{ name: 'Thorin', level: 5 }, { name: 'Elara', level: 3 }];
const MONSTERS = [
  { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid', environments: ['forest'] },
  { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5, type: 'humanoid', environments: ['hill', 'mountain'] },
  { index: 'dragon', name: 'Young Dragon', xp: 120, challenge_rating: 2, type: 'dragon', environments: ['underground'] },
];

function mountBuilder() {
  // Fresh prop copies per render so mutations never bleed between tests.
  useMonstersData.mockReturnValue({
    monsters: MONSTERS.map((m) => ({ ...m, environments: [...m.environments] })),
    loading: false,
  });
  return render(
    <EncounterBuilder
      campaignName={CAMPAIGN}
      characters={CHARACTERS.map((c) => ({ ...c }))}
      onJoinEncounter={vi.fn()}
    />
  );
}

// Opens the real load modal and loads 'test-encounter' (only as the precondition
// that makes the Reset button appear — hydration itself is owned by #403).
async function loadEncounter(data) {
  h.loadEncounterData.mockResolvedValue(data);
  fireEvent.click(screen.getByRole('button', { name: 'Load encounter' }));
  fireEvent.click(screen.getByRole('button', { name: 'Load test-encounter' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Reset encounter' })).toBeInTheDocument();
  });
}

const summaryValue = (label) => {
  const item = Array.from(document.querySelectorAll('.summary-item'))
    .find((el) => el.querySelector('.summary-label')?.textContent === label);
  return item?.querySelector('.summary-value')?.textContent;
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('EncounterBuilder - Reset wipes state to defaults (handleReset)', () => {
  it('clicking Reset after loading and dirtying the builder restores every field to pristine defaults without touching the server', async () => {
    mountBuilder();
    // effectiveXP matches recomputed value (350 × mult 1) so no reconcile write fires.
    await loadEncounter({
      selectedMonsters: [
        { index: 'goblin', qty: 1 },
        { index: 'orc', qty: 3 },
      ],
      description: 'Ambush at dawn',
      effectiveXP: 350,
    });
    expect(h.loadEncounterData).toHaveBeenCalledWith('test-encounter');
    expect(h.updateEncounter).not.toHaveBeenCalled();

    // Dirty every resettable field: selection, qty, dropdown filters, CR bound,
    // party composition, search, description.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Young Dragon' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Young Dragon' }));
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Type'), { target: { value: 'dragon' } });
    fireEvent.change(screen.getByLabelText('CR Min'), { target: { value: '0.5' } });
    fireEvent.click(screen.getByRole('button', { name: /Add player/ }));
    fireEvent.change(screen.getByLabelText('PC 1'), { target: { value: '20' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Search monsters' }), { target: { value: 'orc' } });
    fireEvent.change(screen.getByPlaceholderText('Describe this encounter...'), { target: { value: 'New description' } });

    // Mutations actually took hold (guards the wipe assertions below from vacuity).
    expect(screen.getByRole('heading', { level: 2, name: /Test Encounter/ })).toBeInTheDocument();
    expect(summaryValue('Total XP')).toBe('590'); // 50 + 300 + 2×120
    expect(screen.getByLabelText('PC 1')).toHaveValue(20);
    expect(screen.getByLabelText('CR Min')).toHaveValue(0.5);

    fireEvent.click(screen.getByRole('button', { name: 'Reset encounter' }));

    // Title + encounter binding wiped (setCurrentEncounterName(null) observable:
    // Reset button gone, Save reverts from "Update" to fresh "Save").
    expect(screen.getByRole('heading', { level: 2, name: 'Encounter Builder' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset encounter' })).toBeNull();
    const saveBtn = screen.getByRole('button', { name: 'Save encounter' });
    expect(saveBtn).toHaveTextContent('Save');
    expect(saveBtn).toHaveAttribute('title', 'Save encounter');

    // Selection wiped: selected panel, Join gate, and Clear All all gone;
    // summary recomputed by the real panel wiring to zeros.
    expect(document.querySelector('.encounter-selected')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Join Encounter' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Clear All/ })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Select Young Dragon' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Select Goblin' })).not.toBeChecked();
    expect(summaryValue('Total XP')).toBe('0');
    expect(summaryValue('Monster Count')).toBe('0');
    expect(summaryValue('Effective XP')).toBe('0');

    // Filters back to defaults; party re-derived from characters (Thorin 5, Elara 3).
    expect(screen.getByLabelText('Difficulty')).toHaveValue('1');
    expect(screen.getByLabelText('Type')).toHaveValue('');
    expect(screen.getByLabelText('Size')).toHaveValue('');
    // CR bounds are number inputs — empty state reads back as null, not ''.
    expect(screen.getByLabelText('CR Min')).toHaveValue(null);
    expect(screen.getByLabelText('CR Max')).toHaveValue(null);
    const levels = document.querySelectorAll('.player-level-input');
    expect(levels).toHaveLength(2);
    expect(levels[0]).toHaveValue(5);
    expect(levels[1]).toHaveValue(3);

    // Search and description wiped.
    expect(screen.getByRole('textbox', { name: 'Search monsters' })).toHaveValue('');
    expect(screen.getByPlaceholderText('Describe this encounter...')).toHaveValue('');

    // Honest boundary: reset is purely local — the only server-ish call across
    // the whole flow is the initial load GET; no writes, no initiative, no log.
    expect(h.updateEncounter).not.toHaveBeenCalled();
    expect(h.saveEncounter).not.toHaveBeenCalled();
    expect(h.loadEncounterData).toHaveBeenCalledTimes(1);
    const { addMonstersToInitiative } = await import('../../services/encounters/encounterToInitiative.js');
    expect(addMonstersToInitiative).not.toHaveBeenCalled();
    const { addEntry } = await import('../../services/ui/logService.js');
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('after reset, Save routes as a brand-new encounter (pendingEncounterData cleared, encounter unbound)', async () => {
    mountBuilder();
    await loadEncounter({
      selectedMonsters: [{ index: 'goblin', qty: 1 }],
      description: 'Old description',
      effectiveXP: 50,
    });

    // In the loaded state a save would update in place (#399); prove the reset
    // severs that binding instead of merely hiding the Reset button.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Goblin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset encounter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save encounter' }));

    expect(screen.getByRole('heading', { name: 'Save Encounter' })).toBeInTheDocument();
    expect(h.openSaveModal).toHaveBeenCalledTimes(1);
    expect(h.updateEncounter).not.toHaveBeenCalled();
    expect(h.saveEncounter).not.toHaveBeenCalled();
    // The save modal is fresh — no stale name carried over from the loaded encounter.
    expect(screen.getByRole('textbox', { name: 'Encounter Name' })).toHaveValue('');
  });
});
