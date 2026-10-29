// @maintained-by-ai: 2026-10-28
// Regression lock for improve 2026-10-28-T: the Factions lane must share the
// NPC reload-discard guard (ba51c25ee → shared useReloadGuard) — with the
// editor open and DIRTY under a 409 banner, "Reload list" NAMES the discard;
// Cancel is fully inert (banner, editor, draft survive — zero network) and
// Accept completes the existing one-GET recovery ladder. A clean editor
// keeps the old silent one-click behavior. Legs mirror
// NPCs.reload-discard-confirm.test.jsx; harness mirrors
// Factions.conflict-reload.test.jsx.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Factions from './Factions';

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: () => () => {},
}));

let loadCallCount = 0;
let saveCallCount = 0;
let saveError = null;
let factionsFixture = [{ id: 'f1', name: 'The Iron Consortium', influence: 3, description: 'old' }];

vi.mock('../../services/campaign/factionsService.js', () => ({
  loadFactions: vi.fn(async () => {
    loadCallCount += 1;
    return { factions: factionsFixture };
  }),
  saveFactions: vi.fn(async () => {
    saveCallCount += 1;
    if (saveError) throw saveError;
    return { success: true };
  }),
  deleteFaction: vi.fn(async () => ({ success: true })),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange }) => (
    <textarea
      data-testid={`faction-field-${id}`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

const CONFLICT_MESSAGE =
  'Faction "The Iron Consortium" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';
const DISCARD_CONFIRM = 'Reload the faction list and discard your unsaved edits?';

const conflictError = () => Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });

const renderFactions = () =>
  render(<Factions campaignName="test-campaign" onBack={vi.fn()} />);

// Open the editor, dirty the description draft, attempt a save → banner up.
const openConflictWithDraft = async (draftDescription) => {
  fireEvent.click(screen.getByRole('button', { name: 'Edit faction: The Iron Consortium' }));
  fireEvent.change(screen.getByTestId('faction-field-faction-description'), {
    target: { value: draftDescription },
  });
  fireEvent.click(screen.getByRole('button', { name: /^save/i }));
  await screen.findByText(/NOT saved/);
};

describe('Factions 409 recovery: Reload list names the discard', () => {
  let confirmSpy;
  beforeEach(() => {
    loadCallCount = 0;
    saveCallCount = 0;
    saveError = conflictError();
    factionsFixture = [{ id: 'f1', name: 'The Iron Consortium', influence: 3, description: 'old' }];
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dirty editor: Reload list asks to discard, Cancel is inert (banner + draft survive, zero network)', async () => {
    renderFactions();
    await screen.findByText('The Iron Consortium');
    expect(loadCallCount).toBe(1);

    await openConflictWithDraft('my unsaved draft');

    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));
    expect(confirmSpy).toHaveBeenCalledWith(DISCARD_CONFIRM);

    // Cancel = nothing happened: banner verbatim, editor open, draft intact,
    // no extra fetch.
    expect(screen.getByText(/NOT saved/)).toHaveTextContent(CONFLICT_MESSAGE);
    expect(screen.getByTestId('faction-field-faction-description')).toBeInTheDocument();
    expect(screen.getByTestId('faction-field-faction-description').value).toBe('my unsaved draft');
    expect(loadCallCount).toBe(1);
  });

  it('dirty editor: Accept completes the recovery ladder — reload, reopen seeds fresh, re-apply saves 200', async () => {
    renderFactions();
    await screen.findByText('The Iron Consortium');

    await openConflictWithDraft('my unsaved draft');

    // What the other tab persisted — the accept-leg refetch surfaces it.
    factionsFixture = [{ id: 'f1', name: 'The Iron Consortium', influence: 7, description: 'other-tab text' }];
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));

    // Named confirm fired, then the existing one-click recovery ran: editor
    // closed AND the stale list refresh consumed.
    expect(confirmSpy).toHaveBeenCalledWith(DISCARD_CONFIRM);
    await waitFor(() =>
      expect(screen.queryByTestId('faction-field-faction-description')).toBeNull()
    );
    await screen.findByText('other-tab text');
    expect(loadCallCount).toBe(2);

    // Reopen re-seeds the fresh row/stamp and re-applying the edit saves
    // clean — no 409 loop.
    saveError = null;
    fireEvent.click(screen.getByRole('button', { name: 'Edit faction: The Iron Consortium' }));
    expect(screen.getByTestId('faction-field-faction-description').value).toBe('other-tab text');
    expect(loadCallCount).toBe(2);
    fireEvent.change(screen.getByTestId('faction-field-faction-description'), {
      target: { value: 're-applied' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));
    await waitFor(() =>
      expect(screen.queryByTestId('faction-field-faction-description')).toBeNull()
    );
    expect(saveCallCount).toBe(2);
    expect(screen.queryByText(/NOT saved/)).not.toBeInTheDocument();
  });

  it('clean editor: Reload list stays one click — no confirm, closes + refetches', async () => {
    renderFactions();
    await screen.findByText('The Iron Consortium');

    // Conflict with an untouched draft (stale stamp, no local edits).
    fireEvent.click(screen.getByRole('button', { name: 'Edit faction: The Iron Consortium' }));
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));
    await screen.findByText(/NOT saved/);

    factionsFixture = [{ id: 'f1', name: 'The Iron Consortium', influence: 7, description: 'new' }];
    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByTestId('faction-field-faction-description')).toBeNull()
    );
    await screen.findByText('new');
    expect(loadCallCount).toBe(2);
  });

  it('draft reverted to the seed counts as clean — no confirm', async () => {
    renderFactions();
    await screen.findByText('The Iron Consortium');

    // Type an edit, then undo it before saving: deep-equal to the seed again.
    fireEvent.click(screen.getByRole('button', { name: 'Edit faction: The Iron Consortium' }));
    fireEvent.change(screen.getByTestId('faction-field-faction-description'), {
      target: { value: 'wip' },
    });
    fireEvent.change(screen.getByTestId('faction-field-faction-description'), {
      target: { value: 'old' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));
    await screen.findByText(/NOT saved/);

    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByTestId('faction-field-faction-description')).toBeNull()
    );
    expect(loadCallCount).toBe(2);
  });
});
