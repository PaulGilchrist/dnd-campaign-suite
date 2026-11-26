// @maintained-by-ai 2026-10-18
/* Lane — builder↔server delete/rename dispatch seam (EncounterBuilder.jsx:435-441,
 * REAL EncounterModal wired at :654-662).
 * OWNED HERE (per lane map #407/#409 — "KEEP those strongest"): the builder-level
 * passthrough at the MANAGEMENT-HOOK seam —
 *   • handleDeleteEncounter: dispatches deleteEncounterAction(raw name) straight
 *     through once the leaf prompt is accepted — the builder adds NO second dialog
 *     (raw-name negative pin; the end-to-end single-confirm COUNT and the formatted
 *     prompt text are owned by delete-confirmation.test.jsx).
 *   • handleRenameEncounter: dispatches renameEncounterAction(oldName, newName)
 *     driven through the REAL pen→form path — no confirm, no delete side-effect.
 *     Deepest-segment rename bytes (through the real hook to encountersService)
 *     are owned by EncounterModal.rename-flow.test.jsx; this lane pins the
 *     hook-seam arguments the builder hands down.
 * NOT mocked-replicated here (#406/#407 pattern — former hand-written panel-replica
 * block AND the pre-fix#38 EncounterModal boundary stub both deleted): REAL filter
 * panel, summary panel, monster table, selected panel, PreviewToggle, EncounterModal
 * and encounterGenerator math run under test. The stub's justification ("rename UI is
 * unreachable in 'load' mode") was voided by Fix#38: the modal pen sets local
 * renameTarget and opens the form under prop mode 'load' (EncounterModal.jsx:12-23,
 * :98-115), so real DOM is mounted here — the stub's invented role="dialog"
 * aria-label="Encounter modal" (never rendered by the real modal) went with it.
 * Owned elsewhere — do NOT duplicate: sort/Join/save-modal commit/thresholds (#399
 * additional-interactions), XP summary (#400 gameplay-flows), localStorage/filter/bands
 * (#401 helpers), load hydrate/reconcile (#403 load-encounter), row chrome/clear-all
 * (#406 panel-interactions), generator-apply/header gate (#407 remaining), reset (#405
 * reset-encounter), delete single-confirm (#410 delete-confirmation), rename
 * reachability + service bytes (EncounterModal.rename-flow.test.jsx), modal internals
 * (EncounterModal.test.jsx). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
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

// NOT stubbed: EncounterModal — Fix#38 made rename reachable under prop mode 'load'
// (pen → local renameTarget → seeded form), so the real leaf is mounted; its
// delete-confirm is the real shared DeleteConfirmModal (confirm/cancel driving the
// leaf dialog is exercised below). MarkdownPreview never
// renders here (fixture rows carry no description) — sibling-lane defensive stub.
vi.mock('../common/MarkdownPreview.jsx', () => ({
  default: ({ text }) => <div data-testid="markdown-preview">{text}</div>,
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
  fireEvent.click(screen.getByRole('button', { name: 'Load' }));
  await waitFor(() => {
    // Real modal surface (EncounterModal.jsx:69): load-mode heading — replaces the
    // deleted stub's invented role="dialog" aria-label="Encounter modal" phantom.
    expect(screen.getByRole('heading', { name: 'Load Encounter' })).toBeInTheDocument();
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

  // Fix#410 (2026-10-22): the builder-side guard `if (window.confirm(...))` at old
  // :424 was REMOVED — it stacked a second raw-name dialog behind the leaf modal's
  // prompt (the leaf owns confirmation — full-stack single-confirm is pinned by
  // EncounterBuilder.delete-confirmation.test.jsx; the leaf's prompt is the shared
  // in-app DeleteConfirmModal since the 2026-11-24 QA backlog). This seam now pins
  // the dispatcher contract, mirroring the rename passthrough below.
  it('dispatches deleteEncounterAction straight through with the raw name once the leaf dialog is confirmed — the builder never adds a second confirm', async () => {
    // REAL modal's trash opens its OWN DeleteConfirmModal; confirming it reaches
    // the builder seam; the pin is WHAT the builder never prompts.
    const confirmSpy = vi.spyOn(window, 'confirm');
    mountBuilder();
    await openLoadModal();

    fireEvent.click(screen.getByRole('button', { name: 'Delete "test-encounter"' }));
    // Only the leaf's dialog exists — the builder stacked nothing on top.
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Yes, Delete Permanently/i }));
    });

    await waitFor(() => {
      expect(h.deleteEncounterAction).toHaveBeenCalledWith('test-encounter');
    });
    expect(h.deleteEncounterAction).toHaveBeenCalledTimes(1);
    // Regression guard at the builder seam (#410 + 2026-11-24 unification): the
    // retired raw-name prompt and any native window.confirm stay retired here.
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(h.renameEncounterAction).not.toHaveBeenCalled();
  });

  it('dispatches renameEncounterAction with old and new names through the REAL pen→form path, unconfirmed and without deleting', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    mountBuilder();
    await openLoadModal();

    // Fix#38 production path: pen sets modal-local renameTarget (:150), the seeded
    // form (New Name pre-filled with the raw name) submits the dispatch (:45-55).
    fireEvent.click(screen.getByRole('button', { name: 'Rename "test-encounter"' }));
    fireEvent.change(screen.getByLabelText('New Name'), { target: { value: 'Renamed Encounter' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    });

    await waitFor(() => {
      expect(h.renameEncounterAction).toHaveBeenCalledWith('test-encounter', 'Renamed Encounter');
    });
    expect(h.deleteEncounterAction).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
