// @maintained-by-ai: 2026-10-28
// Regression lock for improve 2026-10-28-T: the Quests lane must share the
// NPC reload-discard guard (ba51c25ee → shared useReloadGuard) — with the
// editor open and DIRTY under a 409 banner, "Reload list" NAMES the discard;
// Cancel is fully inert (banner, editor, draft survive — zero network) and
// Accept completes the existing one-GET recovery ladder. A clean editor
// keeps the old silent one-click behavior. Legs mirror
// NPCs.reload-discard-confirm.test.jsx; harness mirrors
// Quests.conflict-reload.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Quests from './Quests';

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: () => () => {},
}));

let loadCallCount = 0;
let saveCallCount = 0;
let saveError = null;
let questsFixture = [{ id: 'q1', name: 'The Lost Artifact', status: 'active', description: 'old' }];

vi.mock('../../services/campaign/questsService.js', () => ({
  loadQuests: vi.fn(async () => {
    loadCallCount += 1;
    // Mirrors questsService.loadQuests: unwraps to a plain array.
    return questsFixture;
  }),
  saveQuests: vi.fn(async () => {
    saveCallCount += 1;
    if (saveError) throw saveError;
    return { success: true };
  }),
  deleteQuest: vi.fn(async () => ({ success: true })),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange }) => (
    <textarea
      data-testid={`quest-field-${id}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../common/MarkdownPreview.jsx', () => ({
  default: ({ text }) => <span>{text}</span>,
}));

const CONFLICT_MESSAGE =
  'Quest "The Lost Artifact" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';
const DISCARD_CONFIRM = 'Reload the quest list and discard your unsaved edits?';

const conflictError = () => Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });

const renderQuests = () =>
  render(<Quests campaignName="test-campaign" isLocalhost />);

// Open the editor, dirty the description draft, attempt a save → banner up.
const openConflictWithDraft = async (draftDescription) => {
  fireEvent.click(screen.getByRole('button', { name: 'Edit quest: The Lost Artifact' }));
  fireEvent.change(screen.getByTestId('quest-field-quest-description'), {
    target: { value: draftDescription },
  });
  fireEvent.click(screen.getByRole('button', { name: /^save/i }));
  await screen.findByText(/NOT saved/);
};

describe('Quests 409 recovery: Reload list names the discard', () => {
  let confirmSpy;
  beforeEach(() => {
    loadCallCount = 0;
    saveCallCount = 0;
    saveError = conflictError();
    questsFixture = [{ id: 'q1', name: 'The Lost Artifact', status: 'active', description: 'old' }];
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dirty editor: Reload list asks to discard, Cancel is inert (banner + draft survive, zero network)', async () => {
    renderQuests();
    await screen.findByText('The Lost Artifact');
    expect(loadCallCount).toBe(1);

    await openConflictWithDraft('my unsaved draft');

    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));
    expect(confirmSpy).toHaveBeenCalledWith(DISCARD_CONFIRM);

    // Cancel = nothing happened: banner verbatim, editor open, draft intact,
    // no extra fetch.
    expect(screen.getByText(/NOT saved/)).toHaveTextContent(CONFLICT_MESSAGE);
    expect(screen.getByTestId('quest-field-quest-description')).toBeInTheDocument();
    expect(screen.getByTestId('quest-field-quest-description').value).toBe('my unsaved draft');
    expect(loadCallCount).toBe(1);
  });

  it('dirty editor: Accept completes the recovery ladder — reload, reopen seeds fresh, re-apply saves 200', async () => {
    renderQuests();
    await screen.findByText('The Lost Artifact');

    await openConflictWithDraft('my unsaved draft');

    // What the other tab persisted — the accept-leg refetch surfaces it.
    questsFixture = [{ id: 'q1', name: 'The Sunken Shrine', status: 'active', description: 'other-tab text' }];
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));

    // Named confirm fired, then the existing one-click recovery ran: editor
    // closed AND the stale list refresh consumed.
    expect(confirmSpy).toHaveBeenCalledWith(DISCARD_CONFIRM);
    await waitFor(() =>
      expect(screen.queryByTestId('quest-field-quest-description')).toBeNull()
    );
    await screen.findByText('The Sunken Shrine');
    expect(loadCallCount).toBe(2);

    // Reopen re-seeds the fresh row/stamp and re-applying the edit saves
    // clean — no 409 loop.
    saveError = null;
    fireEvent.click(screen.getByRole('button', { name: 'Edit quest: The Sunken Shrine' }));
    expect(screen.getByTestId('quest-field-quest-description').value).toBe('other-tab text');
    expect(loadCallCount).toBe(2);
    fireEvent.change(screen.getByTestId('quest-field-quest-description'), {
      target: { value: 're-applied' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));
    await waitFor(() =>
      expect(screen.queryByTestId('quest-field-quest-description')).toBeNull()
    );
    expect(saveCallCount).toBe(2);
    expect(screen.queryByText(/NOT saved/)).not.toBeInTheDocument();
  });

  it('clean editor: Reload list stays one click — no confirm, closes + refetches', async () => {
    renderQuests();
    await screen.findByText('The Lost Artifact');

    // Conflict with an untouched draft (stale stamp, no local edits).
    fireEvent.click(screen.getByRole('button', { name: 'Edit quest: The Lost Artifact' }));
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));
    await screen.findByText(/NOT saved/);

    questsFixture = [{ id: 'q1', name: 'The Sunken Shrine', status: 'active', description: 'new' }];
    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByTestId('quest-field-quest-description')).toBeNull()
    );
    await screen.findByText('The Sunken Shrine');
    expect(loadCallCount).toBe(2);
  });

  it('draft reverted to the seed counts as clean — no confirm', async () => {
    renderQuests();
    await screen.findByText('The Lost Artifact');

    // Type an edit, then undo it before saving: deep-equal to the seed again.
    fireEvent.click(screen.getByRole('button', { name: 'Edit quest: The Lost Artifact' }));
    fireEvent.change(screen.getByTestId('quest-field-quest-description'), {
      target: { value: 'wip' },
    });
    fireEvent.change(screen.getByTestId('quest-field-quest-description'), {
      target: { value: 'old' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));
    await screen.findByText(/NOT saved/);

    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByTestId('quest-field-quest-description')).toBeNull()
    );
    expect(loadCallCount).toBe(2);
  });
});
