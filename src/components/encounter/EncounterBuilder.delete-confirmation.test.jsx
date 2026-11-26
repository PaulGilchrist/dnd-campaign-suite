// @maintained-by-ai 2026-10-22
/* Lane — FULL-STACK delete single-confirmation for defect #410 (fix#410 2026-10-22;
 * confirm tier unified 2026-11-24 QA backlog: the leaf's native window.confirm
 * retired onto the shared in-app DeleteConfirmModal).
 * REAL EncounterBuilder + REAL EncounterModal mounted together (the only lane that
 * exercises the whole click-through, because the pre-fix stack lived BETWEEN the two
 * files: EncounterModal.jsx confirmed with the formatted name, then fired onDelete
 * into EncounterBuilder.handleDeleteEncounter, which confirmed AGAIN with the raw
 * name — two stacked dialogs per single click).
 * OWNED HERE: exactly ONE confirm per delete click (times(1) end-to-end), the
 * surviving dialog is the leaf modal's shared DeleteConfirmModal (role="dialog",
 * naming the DISPLAY name), the builder-side raw-name prompt is NEVER shown again
 * (negative pin = regression guard against re-adding it), Confirm dispatches
 * deleteEncounterAction once with the raw name, Cancel aborts the delete with the
 * row still listed, and no native window.confirm fires anywhere on the lane.
 * Ownership verdict: leaf owns, mirroring MapsManager's row Delete leg, and the
 * builder's own sibling passthroughs (handleRenameEncounter / handleLoadEncounter —
 * never confirm; rename's no-confirm pin stays byte-intact in uncovered-handlers).
 * Boundary mocks only: useEncounterManagement keeps REAL useState for modal mode
 * (uncovered-handlers pattern), heavy modals closed at the seam, network severed —
 * none of these sit on the confirm path. Modal internals (sorting, save form, XP
 * labels) owned by EncounterModal.test.jsx; server seam by uncovered-handlers. */
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

// Real useState so the load modal genuinely opens/closes (uncovered-handlers pattern).
vi.mock('../../hooks/management/useEncounterManagement.js', async () => {
  const React = await import('react');
  function useEncounterManagement() {
    const [modalMode, setModalMode] = React.useState(null);
    return {
      modalOpen: modalMode !== null,
      modalMode,
      encounters: [{ name: 'test-encounter', effectiveXP: 100 }],
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

// NOT stubbed: EncounterModal — the whole point of this lane is the REAL leaf
// DeleteConfirmModal riding on the REAL builder dispatcher behind it.

// Heavy modals never opened by this lane; closed at the seam.
vi.mock('./EncounterGeneratorModal.jsx', () => ({ default: () => null }));
vi.mock('./MonsterCardModal.jsx', () => ({ default: () => null }));

// MarkdownPreview sanitized-rendering is owned by its own lane (modal-lane stub).
vi.mock('../common/MarkdownPreview.jsx', () => ({
  default: ({ text }) => <div data-testid="markdown-preview">{text}</div>,
}));

// viewingMonster lives in the runtime store but is never driven here (#405/#407 passthrough).
vi.mock('../../hooks/runtime/useSyncedState.js', async () => {
  const React = await import('react');
  return {
    useSyncedState: (_key, _prop, initial) => React.useState(initial),
  };
});

// Sever network seams — the delete dispatch lands on the management-hook spy above.
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
  fireEvent.click(screen.getByRole('button', { name: 'Load' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Delete "test-encounter"' })).toBeInTheDocument();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('EncounterBuilder + REAL EncounterModal — delete confirms exactly once (#410, in-app tier)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a single delete click opens exactly ONE in-app confirm — the leaf modal\'s DeleteConfirmModal naming the display name — with zero native prompts', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    mountBuilder();
    await openLoadModal();

    fireEvent.click(screen.getByRole('button', { name: 'Delete "test-encounter"' }));

    // One dialog per click (pre-#410 this stacked two native prompts).
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(1);
    const dialog = screen.getByRole('dialog', { name: 'Delete Encounter' });
    expect(dialog).toHaveTextContent('Test Encounter');
    expect(confirmSpy).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Yes, Delete Permanently/i }));
    });

    // Confirm path: raw name dispatched exactly once.
    expect(h.deleteEncounterAction).toHaveBeenCalledTimes(1);
    expect(h.deleteEncounterAction).toHaveBeenCalledWith('test-encounter');
    expect(h.renameEncounterAction).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('Cancel aborts the delete after the single confirm — row and state intact, zero native prompts', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    mountBuilder();
    await openLoadModal();

    fireEvent.click(screen.getByRole('button', { name: 'Delete "test-encounter"' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(h.deleteEncounterAction).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    // Cancel leaves the load list intact: the row is still offered for delete.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete "test-encounter"' })).toBeInTheDocument();
  });

  it('each successive delete click opens exactly ONE dialog (never stacked), zero native prompts', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm');
    mountBuilder();
    await openLoadModal();

    fireEvent.click(screen.getByRole('button', { name: 'Delete "test-encounter"' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    // Second click re-arms the same single dialog — never two at once.
    fireEvent.click(screen.getByRole('button', { name: 'Delete "test-encounter"' }));
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(h.deleteEncounterAction).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
