// @maintained-by-ai
/* Lane — FULL-STACK rename reachability for defect #410 (fix#38 2026-10-22).
 * REAL EncounterBuilder + REAL EncounterModal + REAL useEncounterManagement mounted
 * together: the pre-fix dead link lived BETWEEN the two files (pen at
 * EncounterModal.jsx:145 set modal-local renameTarget, the :95 gate demanded prop
 * mode==='rename', and useEncounterManagement ever sets only 'save' | 'load'), so
 * handleRenameEncounter (EncounterBuilder.jsx:432, straight dispatcher) was
 * unreachable from any click. OWNED HERE: pen click → seeded rename form (reachable
 * end-to-end), submit dispatches encountersService.renameEncounter('test-campaign',
 * old, new) with EXACT raw bytes at the deepest seam, the list refreshes (second
 * loadEncounters call) and shows the new formatted name with fresh action buttons,
 * and (2026-10-24 QA backlog) rename SUCCESS now CLOSES the modal — delete-lane
 * parity (d4da4ebc1), proven by overlay unmount through the REAL hook's closeModal —
 * and rename NEVER
 * confirms (fix#36 leaf-ownership sibling parity: delete confirms once at :58,
 * rename does not confirm at all).
 * Boundary mocks only: useMonstersData fixture, heavy modals closed at the seam,
 * MarkdownPreview stub, useSyncedState useState-passthrough, network severed at the
 * encountersService export seam (real formatEncounterName preserved through it) and
 * at logService/encounterToInitiative. Modal internals owned by
 * EncounterModal.test.jsx; builder delete single-confirm by
 * EncounterBuilder.delete-confirmation.test.jsx. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import EncounterBuilder from './EncounterBuilder.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';

const CAMPAIGN = 'test-campaign';

const h = vi.hoisted(() => ({
  // Mutable fake disk: loadEncounters serves a clone; rename mutates the row so the
  // refresh-after-rename pin proves the list reflects the dispatch, not a fixture echo.
  store: [
    { name: 'goblin-ambush', effectiveXP: 100, savedAt: '2024-01-01T00:00:00Z' },
    { name: 'dragon-lair', effectiveXP: 1500, savedAt: '2024-01-02T00:00:00Z' },
  ],
  loadEncounters: null,
  renameEncounter: null,
  saveEncounter: null,
  loadEncounter: null,
  updateEncounter: null,
  deleteEncounter: null,
}));

vi.mock('../../services/encounters/encountersService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual, // real formatEncounterName runs through the seam (display names formatted)
    loadEncounters: (...args) => h.loadEncounters(...args),
    saveEncounter: (...args) => h.saveEncounter(...args),
    loadEncounter: (...args) => h.loadEncounter(...args),
    updateEncounter: (...args) => h.updateEncounter(...args),
    deleteEncounter: (...args) => h.deleteEncounter(...args),
    renameEncounter: (...args) => h.renameEncounter(...args),
  };
});

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(),
}));

// NOT stubbed: EncounterModal AND useEncounterManagement — the fix is the modal's
// local-state gate opening under the hook's real 'load' mode; mocking either would
// re-mask the #410 prod gap.
vi.mock('./EncounterGeneratorModal.jsx', () => ({ default: () => null }));
vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));
vi.mock('../common/MarkdownPreview.jsx', () => ({
  default: ({ text }) => <div data-testid="markdown-preview">{text}</div>,
}));

vi.mock('../../hooks/runtime/useSyncedState.js', async () => {
  const React = await import('react');
  return {
    useSyncedState: (_key, _prop, initial) => React.useState(initial),
  };
});

vi.mock('../../services/encounters/encounterToInitiative.js', () => ({
  addMonstersToInitiative: vi.fn(async () => {}),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(async () => {}),
}));

const MONSTERS = [
  { index: 'goblin', name: 'Goblin', xp: 50, challenge_rating: 0.25, type: 'humanoid', environments: ['forest'] },
];

function mountBuilder() {
  useMonstersData.mockReturnValue({ monsters: MONSTERS.map((m) => ({ ...m })), loading: false });
  return render(
    <EncounterBuilder
      campaignName={CAMPAIGN}
      characters={[{ name: 'Thorin', level: 5 }]}
      onJoinEncounter={vi.fn()}
    />
  );
}

async function openLoadModal() {
  fireEvent.click(screen.getByRole('button', { name: 'Load encounter' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Rename "goblin-ambush"' })).toBeInTheDocument();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  h.store = [
    { name: 'goblin-ambush', effectiveXP: 100, savedAt: '2024-01-01T00:00:00Z' },
    { name: 'dragon-lair', effectiveXP: 1500, savedAt: '2024-01-02T00:00:00Z' },
  ];
  h.loadEncounters = vi.fn(async (_campaignName) => ({
    encounters: h.store.map((enc) => ({ ...enc })),
  }));
  h.renameEncounter = vi.fn(async (_campaignName, oldName, newName) => {
    const row = h.store.find((enc) => enc.name === oldName);
    if (row) row.name = newName;
    return { success: true };
  });
  h.saveEncounter = vi.fn(async () => ({}));
  h.loadEncounter = vi.fn(async () => ({}));
  h.updateEncounter = vi.fn(async () => ({}));
  h.deleteEncounter = vi.fn(async () => ({}));
});

describe('EncounterBuilder + REAL EncounterModal — rename reachable end-to-end (fix#38)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('pen click in the production load modal opens the rename form (pre-fix: form absent, dispatch unreachable)', async () => {
    mountBuilder();
    await openLoadModal();

    fireEvent.click(screen.getByRole('button', { name: 'Rename "dragon-lair"' }));

    expect(screen.getByRole('heading', { name: 'Rename Encounter' })).toBeInTheDocument();
    expect(screen.getByLabelText('New Name')).toHaveValue('dragon-lair');
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    // Deepest seam untouched so far; no dialog (rename lane never confirms).
    expect(h.renameEncounter).not.toHaveBeenCalled();
    expect(screen.queryByText('New name is required')).not.toBeInTheDocument();
  });

  it('rename click-through dispatches renameEncounter("test-campaign", old, new) exact raw bytes, refreshes the list once, and CLOSES the modal (delete-lane parity)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { container } = mountBuilder();
    await openLoadModal();
    const loadsAtOpen = h.loadEncounters.mock.calls.length; // openLoadModal's fetch

    fireEvent.click(screen.getByRole('button', { name: 'Rename "goblin-ambush"' }));
    fireEvent.change(screen.getByLabelText('New Name'), { target: { value: 'Goblin Remix' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    });

    // Exact campaign-scoped bytes through builder.handleRenameEncounter → hook.
    expect(h.renameEncounter).toHaveBeenCalledTimes(1);
    expect(h.renameEncounter).toHaveBeenCalledWith('test-campaign', 'goblin-ambush', 'Goblin Remix');
    // No confirm anywhere on the rename lane (fix#36 sibling parity — straight dispatch).
    expect(confirmSpy).not.toHaveBeenCalled();
    // List refreshed by the hook's loadEncounterList exactly once after the rename.
    expect(h.loadEncounters).toHaveBeenCalledTimes(loadsAtOpen + 1);
    // 2026-10-24 QA backlog: rename success now mirrors the delete lane (d4da4ebc1) —
    // closeModal() unmounts the overlay, so no stale modal intercepts page clicks.
    expect(container.querySelector('.encounter-modal-overlay')).not.toBeInTheDocument();

    // Re-opening Load lists the encounter under its NEW name with fresh row actions.
    fireEvent.click(screen.getByRole('button', { name: 'Load encounter' }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Rename "Goblin Remix"' })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Load "Goblin Remix"' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete "Goblin Remix"' })).toBeInTheDocument();
    expect(screen.queryByText('Goblin Ambush')).not.toBeInTheDocument();
    expect(screen.getByText('Dragon Lair')).toBeInTheDocument();
  });

  it('blank rename never reaches the service seam — form stays open with inline error', async () => {
    mountBuilder();
    await openLoadModal();

    fireEvent.click(screen.getByRole('button', { name: 'Rename "goblin-ambush"' }));
    fireEvent.change(screen.getByLabelText('New Name'), { target: { value: '   ' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    });

    expect(screen.getByText('New name is required')).toBeInTheDocument();
    expect(h.renameEncounter).not.toHaveBeenCalled();
    expect(screen.getByLabelText('New Name')).toBeInTheDocument();
  });

  // Backlog 2026-10-28-U: 1-service/0-wrapper rename canon (c5d784d1f/186a4e9f4
  // save-404 pattern). Service is mocked at the export seam, so its own log
  // (pinned by encountersService.test.js) never fires here — a dup-name reject
  // must produce ZERO app console.error lines end-to-end through the REAL hook
  // and REAL modal (was two: hook `Failed to rename encounter:` + modal).
  it('failed rename (dup-name 400) renders the leaf-inline error, keeps the modal open, and BOTH wrappers log nothing', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    h.renameEncounter = vi.fn(async () => {
      throw new Error('An encounter with this name already exists');
    });
    const { container } = mountBuilder();
    await openLoadModal();

    fireEvent.click(screen.getByRole('button', { name: 'Rename "goblin-ambush"' }));
    fireEvent.change(screen.getByLabelText('New Name'), { target: { value: 'dragon-lair' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    });

    // User surface unchanged: inline error, modal open for retry, rows untouched.
    const err = container.querySelector('.encounter-modal-error');
    expect(err).toBeInTheDocument();
    expect(err).toHaveTextContent('An encounter with this name already exists');
    expect(screen.getByLabelText('New Name')).toBeInTheDocument();
    expect(h.loadEncounters).toHaveBeenCalledTimes(1); // no list reload on failure
    // Single-layer logging: neither the hook nor the modal wrapper console.errored.
    expect(errSpy).not.toHaveBeenCalled();
  });
});
