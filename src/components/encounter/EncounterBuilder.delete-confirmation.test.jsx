// @maintained-by-ai
/* Lane — FULL-STACK delete single-confirmation for defect #410 (fix#410 2026-10-22).
 * REAL EncounterBuilder + REAL EncounterModal mounted together (the only lane that
 * exercises the whole click-through, because the pre-fix stack lived BETWEEN the two
 * files: EncounterModal.jsx:55 confirmed with the formatted name, then fired onDelete
 * into EncounterBuilder.handleDeleteEncounter, which confirmed AGAIN with the raw name
 * — two stacked dialogs per single click).
 * OWNED HERE: exactly ONE window.confirm per delete click (times(1) end-to-end), the
 * surviving dialog is the leaf modal's formatted-name prompt, the builder-side raw-name
 * prompt is NEVER shown again (negative pin = regression guard against re-adding it),
 * OK dispatches deleteEncounterAction once with the raw name, cancel aborts the delete
 * with the row still listed.
 * Ownership verdict: leaf owns, mirroring the house (Notes.jsx:260, Factions.jsx:158,
 * Sessions.jsx:135, Quests.jsx:198, Settlements.jsx:581, NPCs.jsx:96,
 * PartyInventory.jsx:519, CharSummary.jsx:626 all confirm at the click point) and the
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

// NOT stubbed: EncounterModal — the whole point of this lane is the REAL leaf confirm
// at EncounterModal.jsx:55 riding on the REAL builder dispatcher behind it.

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
  fireEvent.click(screen.getByRole('button', { name: 'Load encounter' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Delete test-encounter' })).toBeInTheDocument();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('EncounterBuilder + REAL EncounterModal — delete confirms exactly once (#410)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a single delete click opens exactly ONE confirm — the leaf modal\'s formatted prompt — and the raw-name builder prompt never appears', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mountBuilder();
    await openLoadModal();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete test-encounter' }));
    });

    // Fix#410: one dialog per click (pre-fix this received 2: formatted then raw).
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Delete "Test Encounter"?');
    // Regression guard: the retired builder-side raw-name dialog must stay retired.
    expect(confirmSpy).not.toHaveBeenCalledWith('Delete "test-encounter"?');
    // OK path: raw name dispatched exactly once.
    expect(h.deleteEncounterAction).toHaveBeenCalledTimes(1);
    expect(h.deleteEncounterAction).toHaveBeenCalledWith('test-encounter');
    expect(h.renameEncounterAction).not.toHaveBeenCalled();
  });

  it('cancel aborts the delete after the single confirm — row and state intact', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    mountBuilder();
    await openLoadModal();

    fireEvent.click(screen.getByRole('button', { name: 'Delete test-encounter' }));

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(h.deleteEncounterAction).not.toHaveBeenCalled();
    // Cancel leaves the load list intact: the row is still offered for delete.
    expect(screen.getByRole('button', { name: 'Delete test-encounter' })).toBeInTheDocument();
  });

  it('each successive delete click asks exactly once (2 clicks => 2 dialogs, never 4)', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    mountBuilder();
    await openLoadModal();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete test-encounter' }));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Delete test-encounter' }));

    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(confirmSpy).toHaveBeenNthCalledWith(1, 'Delete "Test Encounter"?');
    expect(confirmSpy).toHaveBeenNthCalledWith(2, 'Delete "Test Encounter"?');
    expect(h.deleteEncounterAction).not.toHaveBeenCalled();
  });
});
