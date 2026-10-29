// @maintained-by-ai
/* Lane — rename-success toast at the builder seam (backlog 2026-10-28-T: EB rename
 * success was the only silent lane — save/update/load/404 all toast).
 * OWNED HERE (toast.test.jsx cannot reach the rename UI: its EncounterModal stub
 * never renders the rename form, and uncovered-handlers.test.jsx pins the
 * dispatch args, not the feedback):
 *   • success: resolved renameEncounterAction → non-error toast `Encounter renamed`
 *     in the builder's .encounter-toast chrome, modal closes, refreshed list shows
 *     the NEW name.
 *   • failure: rejected renameEncounterAction → NO success toast (the leaf modal
 *     owns the inline error — its copy is not re-pinned here).
 *   • cancel (×) and empty-name legs: zero network (renameEncounterAction never
 *     fires) AND zero toast — inline `New name is required` stays modal-local.
 * Driven through the REAL EncounterModal pen→form path (Fix#38: pen sets modal-local
 * renameTarget under prop mode 'load'). Mock shape mirrors uncovered-handlers:
 * real useState so open/close re-renders are genuine. Owned elsewhere — do NOT
 * duplicate: dispatch args + no-confirm (uncovered-handlers), service bytes
 * (EncounterModal.rename-flow), save/load/update toasts (toast.test.jsx). */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EncounterBuilder from './EncounterBuilder.jsx';
import { useMonstersData } from '../../hooks/ui/useMonstersData.js';

const CAMPAIGN = 'test-campaign';

const h = vi.hoisted(() => ({
  renameEncounterAction: vi.fn(async () => {}),
}));

vi.mock('../../hooks/ui/useMonstersData.js', () => ({
  useMonstersData: vi.fn(),
}));

// Real useState so opening/closing the load modal triggers genuine re-renders
// (uncovered-handlers pattern); the list re-reads a rename so the refresh leg is
// observable in the DOM.
vi.mock('../../hooks/management/useEncounterManagement.js', async () => {
  const React = await import('react');
  function useEncounterManagement() {
    const [modalMode, setModalMode] = React.useState(null);
    const [names, setNames] = React.useState(['test-encounter']);
    const [loading, setLoading] = React.useState(false);
    const reload = async () => {
      setLoading(true);
      await Promise.resolve();
      setLoading(false);
    };
    return {
      modalOpen: modalMode !== null,
      modalMode,
      get encounters() {
        return names.map((name) => ({ name }));
      },
      loading,
      openSaveModal: () => setModalMode('save'),
      openLoadModal: () => {
        setModalMode('load');
        reload();
      },
      closeModal: () => setModalMode(null),
      saveEncounter: vi.fn(),
      updateEncounter: vi.fn(),
      loadEncounterData: vi.fn(),
      deleteEncounterAction: vi.fn(),
      renameEncounterAction: async (oldName, newName) => {
        await h.renameEncounterAction(oldName, newName);
        setNames((prev) => prev.map((n) => (n === oldName ? newName : n)));
        await reload();
      },
    };
  }
  return { default: useEncounterManagement };
});

// Real EncounterModal mounted (no stub) so the pen→form→toast chain is walked
// end-to-end at the builder seam.
vi.mock('../common/MarkdownPreview.jsx', () => ({
  default: ({ text }) => <div data-testid="markdown-preview">{text}</div>,
}));
vi.mock('./EncounterGeneratorModal.jsx', () => ({ default: () => null }));
vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));

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

const toastNode = () => document.querySelector('.encounter-toast');

// Bounded no-toast probe: the toast would render in the same commit as the
// resolved dispatch, so 300ms of real time is ample to prove silence.
async function expectNoToast() {
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(toastNode()).not.toBeInTheDocument();
}

async function openLoadModal() {
  fireEvent.click(screen.getByLabelText('Load encounter'));
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Load Encounter' })).toBeInTheDocument();
  });
  // Wait out the open-time list reload so row actions leave their disabled gate.
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Rename "test-encounter"' })).toBeEnabled();
  });
}

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

async function armRenameForm() {
  fireEvent.click(screen.getByRole('button', { name: 'Rename "test-encounter"' }));
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Rename Encounter' })).toBeInTheDocument();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EncounterBuilder - rename feedback (2026-10-28-T backlog)', () => {
  it('toasts non-error "Encounter renamed" on success, closes the modal, and the refreshed list shows the NEW name', async () => {
    mountBuilder();
    await openLoadModal();
    await armRenameForm();

    fireEvent.change(screen.getByLabelText('New Name'), { target: { value: 'Renamed Encounter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => {
      expect(toastNode()).toHaveTextContent('Encounter renamed');
    });
    expect(toastNode()).not.toHaveClass('encounter-toast-error');
    expect(h.renameEncounterAction).toHaveBeenCalledWith('test-encounter', 'Renamed Encounter');
    // Modal closes on success (list surface back, rename form gone).
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Rename Encounter' })).not.toBeInTheDocument();
    });
    // Re-open the list: the refresh carries the NEW name, old one gone.
    fireEvent.click(screen.getByLabelText('Load encounter'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Rename "Renamed Encounter"' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: 'Rename "test-encounter"' })).not.toBeInTheDocument();
  });

  it('does NOT fire the success toast when renameEncounterAction rejects (leaf modal keeps its inline error)', async () => {
    h.renameEncounterAction.mockRejectedValueOnce(new Error('rename exploded'));
    mountBuilder();
    await openLoadModal();
    await armRenameForm();

    fireEvent.change(screen.getByLabelText('New Name'), { target: { value: 'Renamed Encounter' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    // Leaf inline error lands (existing lane, copy not re-pinned here)…
    await waitFor(() => {
      expect(screen.getByText('rename exploded')).toBeInTheDocument();
    });
    // …and no builder toast ever renders — success and failure paths are exclusive.
    await expectNoToast();
    // Modal stays open for retry (pre-existing leg unchanged).
    expect(screen.getByRole('heading', { name: 'Rename Encounter' })).toBeInTheDocument();
  });

  it('× cancel leg: zero network and zero toast', async () => {
    mountBuilder();
    await openLoadModal();
    await armRenameForm();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Rename Encounter' })).not.toBeInTheDocument();
    });
    await expectNoToast();
    expect(h.renameEncounterAction).not.toHaveBeenCalled();
  });

  it('empty-name leg: inline "New name is required", zero network, zero toast', async () => {
    mountBuilder();
    await openLoadModal();
    await armRenameForm();

    fireEvent.change(screen.getByLabelText('New Name'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    await waitFor(() => {
      expect(screen.getByText('New name is required')).toBeInTheDocument();
    });
    await expectNoToast();
    expect(h.renameEncounterAction).not.toHaveBeenCalled();
  });
});
