// @maintained-by-ai
// EncounterBuilder lane: interactions NOT owned by sibling files.
// Owned elsewhere (do NOT duplicate here):
//   - panel-interactions.test.jsx  — checkbox toggle, qty +/-, remove, clear all,
//     monster card modal open/close, description starts empty
//   - remaining.test.jsx           — Join button visibility (gate only), generator
//     modal open → Apply → close, selected-row preservation under the type filter,
//     default header chrome incl. no-Reset and party summary display
//     (its openSaveModal spy, Clear All and description-editing pins retired:
//     save flow subsumed by THIS lane @fix#263, Clear All by panel-interactions
//     @#406, description editing by PreviewToggle.test.jsx)
//   - load-encounter.test.jsx      — handleLoadEncounter resolution + XP reconcile
//   - reset-encounter.test.jsx     — handleReset
//   - uncovered-handlers.test.jsx  — delete/rename builder dispatch passthrough at
//     the management-hook seam, UNCONFIRMED since fix#410 (renames never confirmed;
//     the real delete confirm lives in the leaf — single-confirm count owned by
//     delete-confirmation.test.jsx, rename reachability/service bytes by
//     EncounterModal.rename-flow.test.jsx)
//   - EncounterMonsterTable.test.jsx / EncounterFilterPanel.test.jsx — child-level
//     header onSort calls and panel player-callback calls (no builder state wiring)
// This file uniquely covers:
//   1. Table sort state machine (handleSort) with observable row order in the REAL table
//   2. Join Encounter dispatch (log payload + addMonstersToInitiative + cleanup)
//   3. Save → modal commit → saveEncounter payload, then edit-in-place → updateEncounter
//   4. Party add / level change / remove → target threshold recomputation end-to-end
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EncounterBuilder from './EncounterBuilder.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';
import { addMonstersToInitiative } from '../../services/encounters/encounterToInitiative.js';
import { addEntry } from '../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(),
}));

// Boundary mock of the management hook: real modal-reachability (openSaveModal /
// closeModal flip modalOpen so the REAL EncounterModal is exercised), all persistence
// operations are spies asserted with exact payloads.
const manageSpies = vi.hoisted(() => ({ saveEncounter: vi.fn(), updateEncounter: vi.fn() }));

vi.mock('../../hooks/management/useEncounterManagement.js', async () => {
  const React = await import('react');
  return {
    default: vi.fn(() => {
      const [modalOpen, setModalOpen] = React.useState(false);
      const [modalMode, setModalMode] = React.useState('save');
      return {
        modalOpen,
        modalMode,
        encounters: [],
        loading: false,
        openSaveModal: () => { setModalMode('save'); setModalOpen(true); },
        openLoadModal: vi.fn(),
        closeModal: () => setModalOpen(false),
        saveEncounter: manageSpies.saveEncounter,
        updateEncounter: manageSpies.updateEncounter,
        loadEncounterData: vi.fn(async () => null),
        deleteEncounterAction: vi.fn(async () => {}),
        renameEncounterAction: vi.fn(async () => {}),
      };
    }),
  };
});

vi.mock('../../services/encounters/encounterToInitiative.js', () => ({
  addMonstersToInitiative: vi.fn(async () => {}),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

// viewingMonster lives in the runtime store; passthrough state is enough here.
vi.mock('../../hooks/runtime/useSyncedState.js', async () => {
  const React = await import('react');
  return {
    useSyncedState: (_key, _runtimeKey, initial) => React.useState(initial),
  };
});

// Heavy stat-block modal — never opened by this lane; keep the module graph light.
vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));

const sortMonsters = [
  { index: 'aurelia', name: 'Aurelia', xp: 700, challenge_rating: 3, type: 'dragon', environments: ['mountain'] },
  { index: 'bog-troll', name: 'Bog Troll', xp: 100, challenge_rating: 0.5, type: 'giant', environments: ['swamp'] },
  { index: 'cinder-wolf', name: 'Cinder Wolf', xp: 200, challenge_rating: 1, type: 'beast', environments: ['forest'] },
];

const joinMonsters = [
  { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid', environments: ['forest'] },
  { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5, type: 'humanoid', environments: ['hill'] },
];

function makeCharacters() {
  return [
    { name: 'Thorin', level: 5 },
    { name: 'Elara', level: 3 },
  ];
}

function mountBuilder({ monsters = joinMonsters, characters = makeCharacters() } = {}) {
  // Deep-copy so mutations never bleed between tests.
  const freshMonsters = monsters.map(m => ({ ...m, environments: [...(m.environments || [])] }));
  useMonstersData.mockReturnValue({ monsters: freshMonsters, loading: false });
  const onJoinEncounter = vi.fn();
  const utils = render(
    <EncounterBuilder campaignName={CAMPAIGN} characters={characters} onJoinEncounter={onJoinEncounter} />
  );
  return { ...utils, onJoinEncounter };
}

const rowNames = (container) =>
  Array.from(container.querySelectorAll('tbody tr td.col-name')).map(td => td.textContent);

const thresholdText = (container) =>
  container.querySelector('.threshold-display strong').textContent;

beforeEach(() => {
  manageSpies.saveEncounter = vi.fn(async () => {});
  manageSpies.updateEncounter = vi.fn(async () => {});
  addMonstersToInitiative.mockClear();
  addEntry.mockClear();  // Deterministic filter persistence across tests (localStorage is mocked in setup.js).
  localStorage.removeItem('encounterFilter-2024');
});

describe('EncounterBuilder - additional interactions', () => {
  it('reorders monster rows when sortable headers are clicked (field switch and direction toggle)', () => {
    const { container } = mountBuilder({ monsters: sortMonsters });

    // Default: name ascending.
    expect(rowNames(container)).toEqual(['Aurelia', 'Bog Troll', 'Cinder Wolf']);

    // Same field again → name descending.
    fireEvent.click(screen.getByRole('button', { name: 'Sort by monster name' }));
    expect(rowNames(container)).toEqual(['Cinder Wolf', 'Bog Troll', 'Aurelia']);

    // Different field → switches to CR ascending (order differs from name order).
    fireEvent.click(screen.getByRole('button', { name: 'Sort by challenge rating' }));
    expect(rowNames(container)).toEqual(['Bog Troll', 'Cinder Wolf', 'Aurelia']);

    // Same CR field again → CR descending.
    fireEvent.click(screen.getByRole('button', { name: 'Sort by challenge rating' }));
    expect(rowNames(container)).toEqual(['Aurelia', 'Cinder Wolf', 'Bog Troll']);
  });

  it('Join Encounter logs the roster, adds it to initiative, clears selection, and notifies the app', async () => {
    const { onJoinEncounter } = mountBuilder();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Goblin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Goblin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Join Encounter' }));

    // Exact campaign log payload (qty propagated). The joined row is written
    // only AFTER the board accepts the creatures (join success first).
    await waitFor(() => {
      expect(addEntry).toHaveBeenCalledWith('test-campaign', {
        type: 'encounter',
        action: 'joined',
        encounterName: 'Encounter Builder',
        monsters: ['2x Goblin'],
      });
    });

    // Exact initiative dispatch: full selected monster objects, party, campaign.
    expect(addMonstersToInitiative).toHaveBeenCalledTimes(1);
    expect(addMonstersToInitiative).toHaveBeenCalledWith(
      [{ index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid', environments: ['forest'], qty: 2 }],
      [{ name: 'Thorin', level: 5 }, { name: 'Elara', level: 3 }],
      'test-campaign'
    );

    // Selection cleared and app notified.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Join Encounter' })).not.toBeInTheDocument();
    });
    expect(onJoinEncounter).toHaveBeenCalledTimes(1);
  });

  it('saves a new encounter from the modal with an exact payload, then updates it in place', async () => {
    mountBuilder();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Goblin' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase quantity of Goblin' }));
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Ambush at dawn' } });

    // First save: no current name → real save modal opens.
    fireEvent.click(screen.getByRole('button', { name: 'Save encounter' }));
    expect(screen.getByRole('heading', { name: 'Save Encounter' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Encounter Name'), { target: { value: 'crag-mole-lair' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    // Stripped refs + description + effectiveXP (2x goblin = 100 XP, party of 2 → ×1.5).
    await waitFor(() => {
      expect(manageSpies.saveEncounter).toHaveBeenCalledTimes(1);
    });
    expect(manageSpies.saveEncounter).toHaveBeenCalledWith('crag-mole-lair', {
      selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }],
      description: 'Ambush at dawn',
      effectiveXP: 150,
    });

    // Title formatted from the name; modal closed; button became Update.
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Crag Mole Lair/ })).toBeInTheDocument();
    });
    expect(screen.queryByLabelText('Encounter Name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save encounter' })).toHaveTextContent('Update');

    // Edit-in-place: second save updates directly — no modal, no new saveEncounter —
    // but the update lane gates the PUT behind a named native overwrite confirm.
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Ambush at dawn (revised)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save encounter' }));

    expect(confirmSpy).toHaveBeenCalledWith('Overwrite encounter "Crag Mole Lair"? This replaces the saved encounter.');
    await waitFor(() => {
      expect(manageSpies.updateEncounter).toHaveBeenCalledTimes(1);
    });
    expect(manageSpies.updateEncounter).toHaveBeenCalledWith('crag-mole-lair', {
      selectedMonsters: [{ index: 'goblin', name: 'Goblin', qty: 2 }],
      description: 'Ambush at dawn (revised)',
      effectiveXP: 150,
    });
    expect(manageSpies.saveEncounter).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Encounter Name')).not.toBeInTheDocument();
  });

  it('recomputes the target XP threshold when players are added, leveled, and removed', () => {
    // config.xpThresholds at default difficulty (Medium): Lv5=500, Lv3=150.
    const { container } = mountBuilder({
      monsters: [],
      characters: [{ name: 'Thorin', level: 5 }, { name: 'Elara', level: 3 }],
    });
    expect(thresholdText(container)).toBe('650 XP');

    // Add player defaults to Lv1 (+50 XP).
    fireEvent.click(screen.getByRole('button', { name: 'Add player' }));
    expect(screen.getByLabelText('PC 3')).toHaveValue(1);
    expect(thresholdText(container)).toBe('700 XP');

    // Level up PC 3 to 5 (+500, -50).
    fireEvent.change(screen.getByLabelText('PC 3'), { target: { value: '5' } });
    expect(thresholdText(container)).toBe('1,150 XP');

    // Remove PC 1 (Lv5) → 150 + 500.
    fireEvent.click(screen.getByRole('button', { name: 'Remove player 1' }));
    expect(thresholdText(container)).toBe('650 XP');
    expect(screen.queryByLabelText('PC 3')).not.toBeInTheDocument();
  });
});
