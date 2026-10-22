// @maintained-by-ai
/* Lane — builder↔server delete/rename seam (EncounterBuilder.jsx:415-423, wired at :641-642).
 * OWNED HERE (per lane map #407/#409 — "KEEP those strongest"):
 *   • handleDeleteEncounter: prompts with the raw encounter name and dispatches
 *     deleteEncounterAction ONLY on confirmation (confirm/cancel twins folded it.each).
 *   • handleRenameEncounter: dispatches renameEncounterAction(oldName, newName)
 *     straight through — no second confirm, no delete side-effect.
 * NOT mocked-replicated here (#406/#407 pattern — former hand-written panel-replica
 * block deleted): REAL filter panel, summary panel, monster table, selected panel,
 * PreviewToggle, encountersService and encounterGenerator math run under test.
 * EncounterModal is a minimal BOUNDARY stub, not a replica: it renders the parent's
 * onDelete/onRename contract with the same aria-labels as the real modal and nothing
 * else. Modal internals (its own delete prompt, rename form, Enter-submit, sorting)
 * are owned by EncounterModal.test.jsx. The real modal is deliberately not mounted
 * here: it re-confirms deletes itself (EncounterModal.jsx:55) and its rename UI is
 * unreachable in 'load' mode, which would blur the builder-level pins below.
 * Owned elsewhere — do NOT duplicate: sort/Join/save-modal commit/thresholds (#399
 * additional-interactions), XP summary (#400 gameplay-flows), localStorage/filter/bands
 * (#401 helpers), load hydrate/reconcile (#403 load-encounter), row chrome/clear-all
 * (#406 panel-interactions), generator-apply/header gate (#407 remaining), reset (#405
 * reset-encounter), modal open/close chrome (remaining + EncounterModal.test.jsx). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EncounterBuilder from './EncounterBuilder.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';

const CAMPAIGN = 'test-campaign';

const h = vi.hoisted(() => ({
  deleteEncounterAction: vi.fn(async () => {}),
  renameEncounterAction: vi.fn(async () => {}),
}));

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(),
}));

// Real useState so opening the load modal triggers genuine re-renders
// (reset-encounter pattern — replaces the old getters + forced-click hack).
vi.mock('../../hooks/management/useEncounterManagement.js', async () => {
  const React = await import('react');
  function useEncounterManagement() {
    const [modalMode, setModalMode] = React.useState(null);
    return {
      modalOpen: modalMode !== null,
      modalMode,
      encounters: [{ name: 'test-encounter' }],
      loading: false,
      openSaveModal: () => setModalMode('save'),
      openLoadModal: () => setModalMode('load'),
      closeModal: () => setModalMode(null),
      saveEncounter: vi.fn(),
      updateEncounter: vi.fn(),
      loadEncounterData: vi.fn(),
      deleteEncounterAction: h.deleteEncounterAction,
      renameEncounterAction: h.renameEncounterAction,
    };
  }
  return { default: useEncounterManagement };
});

// Boundary stub of the save/load modal seam: fires the parent's delete/rename
// contract with the same aria-labels the real modal uses. No modal logic here —
// EncounterModal.test.jsx owns the modal's own confirm prompt and rename form.
vi.mock('./EncounterModal.jsx', () => ({
  default: ({ isOpen, mode, encounters, onDelete, onRename }) => {
    if (!isOpen || mode !== 'load') return null;
    return (
      <div role="dialog" aria-label="Encounter modal">
        {encounters.map((enc) => (
          <div key={enc.name}>
            <button type="button" aria-label={`Delete ${enc.name}`} onClick={() => onDelete(enc.name)}>
              Delete
            </button>
            <button type="button" aria-label={`Rename ${enc.name}`} onClick={() => onRename(enc.name, 'Renamed Encounter')}>
              Rename
            </button>
          </div>
        ))}
      </div>
    );
  },
}));

// Heavy modals never opened by this lane; closed at the seam.
vi.mock('./EncounterGeneratorModal.jsx', () => ({ default: () => null }));
vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));

// viewingMonster lives in the runtime store but is never driven here
// (same local passthrough as #405/#407).
vi.mock('../../hooks/runtime/useSyncedState.js', async () => {
  const React = await import('react');
  return {
    useSyncedState: (_key, _prop, initial) => React.useState(initial),
  };
});

// Sever network seams — delete/rename dispatch is the only server-ish concern here
// and it lands on the management-hook spies above, never on fetch/log/initiative.
vi.mock('../../services/encounters/encounterToInitiative.js', () => ({
  addMonstersToInitiative: vi.fn(async () => {}),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

const MONSTERS = [
  { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid', environments: ['forest'] },
  { index: 'orc', name: 'Orc', xp: 100, challenge_rating: 0.5, type: 'humanoid', environments: ['hill'] },
];

function mountBuilder() {
  useMonstersData.mockReturnValue({ monsters: MONSTERS.map((m) => ({ ...m })), loading: false });
  return render(
    <EncounterBuilder
      campaignName={CAMPAIGN}
      characters={[{ name: 'Thorin', level: 5 }, { name: 'Elara', level: 3 }]}
      onJoinEncounter={vi.fn()}
    />
  );
}

async function openLoadModal() {
  fireEvent.click(screen.getByRole('button', { name: 'Load encounter' }));
  await waitFor(() => {
    expect(screen.getByRole('dialog', { name: 'Encounter modal' })).toBeInTheDocument();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('EncounterBuilder - delete/rename server seam', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    { confirmed: true, expectedDispatches: 1 },
    { confirmed: false, expectedDispatches: 0 },
  ])('dispatches deleteEncounterAction $expectedDispatches time(s) when confirm returns $confirmed', async ({ confirmed, expectedDispatches }) => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(confirmed);
    mountBuilder();
    await openLoadModal();

    fireEvent.click(screen.getByRole('button', { name: 'Delete test-encounter' }));

    // Builder prompts with the RAW encounter name (its own guard at :416),
    // then dispatches the raw name to the management hook on confirmation.
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Delete "test-encounter"?');
    expect(h.deleteEncounterAction).toHaveBeenCalledTimes(expectedDispatches);
    if (expectedDispatches === 1) {
      expect(h.deleteEncounterAction).toHaveBeenCalledWith('test-encounter');
    }
    expect(h.renameEncounterAction).not.toHaveBeenCalled();
  });

  it('dispatches renameEncounterAction with old and new names, unconfirmed and without deleting', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    mountBuilder();
    await openLoadModal();

    fireEvent.click(screen.getByRole('button', { name: 'Rename test-encounter' }));

    await waitFor(() => {
      expect(h.renameEncounterAction).toHaveBeenCalledWith('test-encounter', 'Renamed Encounter');
    });
    expect(h.deleteEncounterAction).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
