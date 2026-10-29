// @maintained-by-ai: 2026-10-28
// Regression lock for improve 2026-10-28-T: the Notes lane must share the
// NPC reload-discard guard (ba51c25ee → shared useReloadGuard) — with the
// editor open and DIRTY under a 409 banner, "Reload list" NAMES the discard;
// Cancel is fully inert (banner, editor, draft survive — zero network) and
// Accept completes the existing one-GET recovery ladder. A clean editor
// keeps the old silent one-click behavior. Legs mirror
// NPCs.reload-discard-confirm.test.jsx; harness mocks the notes service so
// loadCallCount tracks refetches (cf. Notes.concurrent-save.test.jsx).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Notes from './Notes';

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: () => () => {},
}));

let loadCallCount = 0;
let saveCallCount = 0;
let saveError = null;
let notesFixture = [
  {
    id: 'n1',
    description: 'old note',
    isPrivate: false,
    dateCreated: '2026-01-01T00:00:00.000Z',
    dateModified: '2026-01-02T00:00:00.000Z',
    partyLevel: 1,
    partyLocation: '',
  },
];

vi.mock('../../services/campaign/notesService.js', () => ({
  loadNotes: vi.fn(async () => {
    loadCallCount += 1;
    return { notes: notesFixture };
  }),
  saveNotes: vi.fn(async () => {
    saveCallCount += 1;
    if (saveError) throw saveError;
    return { success: true };
  }),
  deleteNote: vi.fn(async () => ({ success: true })),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange }) => (
    <textarea
      data-testid={`preview-toggle-${id}`}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('../common/MarkdownPreview.jsx', () => ({
  default: ({ text }) => <span>{text}</span>,
}));

const CONFLICT_MESSAGE =
  'Note "old note" was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.';
const DISCARD_CONFIRM = 'Reload the note list and discard your unsaved edits?';

const conflictError = () => Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });

const renderNotes = () =>
  render(<Notes campaignName="test-campaign" characters={[]} isLocalhost onBack={vi.fn()} />);

const openEditor = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Edit note: old note' }));
};

// Open the editor, dirty the description draft, attempt a save → banner up.
const openConflictWithDraft = async (draftDescription) => {
  await openEditor();
  fireEvent.change(screen.getByTestId('preview-toggle-note-description'), {
    target: { value: draftDescription },
  });
  fireEvent.click(screen.getByRole('button', { name: /^save/i }));
  await screen.findByText(/NOT saved/);
};

describe('Notes 409 recovery: Reload list names the discard', () => {
  let confirmSpy;
  beforeEach(() => {
    loadCallCount = 0;
    saveCallCount = 0;
    saveError = conflictError();
    notesFixture = [notesFixture[0]];
    notesFixture[0] = {
      id: 'n1',
      description: 'old note',
      isPrivate: false,
      dateCreated: '2026-01-01T00:00:00.000Z',
      dateModified: '2026-01-02T00:00:00.000Z',
      partyLevel: 1,
      partyLocation: '',
    };
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dirty editor: Reload list asks to discard, Cancel is inert (banner + draft survive, zero network)', async () => {
    renderNotes();
    await screen.findByText('old note');
    expect(loadCallCount).toBe(1);

    await openConflictWithDraft('my unsaved draft');

    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));
    expect(confirmSpy).toHaveBeenCalledWith(DISCARD_CONFIRM);

    // Cancel = nothing happened: banner verbatim, editor open, draft intact,
    // no extra fetch.
    expect(screen.getByText(/NOT saved/)).toHaveTextContent(CONFLICT_MESSAGE);
    expect(screen.getByTestId('preview-toggle-note-description')).toBeInTheDocument();
    expect(screen.getByTestId('preview-toggle-note-description').value).toBe('my unsaved draft');
    expect(loadCallCount).toBe(1);
  });

  it('dirty editor: Accept completes the recovery ladder — reload, reopen seeds fresh, re-apply saves 200', async () => {
    renderNotes();
    await screen.findByText('old note');

    await openConflictWithDraft('my unsaved draft');

    // What the other tab persisted — the accept-leg refetch surfaces it.
    notesFixture = [{ ...notesFixture[0], description: 'other-tab text', dateModified: '2026-01-03T00:00:00.000Z' }];
    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));

    // Named confirm fired, then the existing one-click recovery ran: editor
    // closed AND the stale list refresh consumed.
    expect(confirmSpy).toHaveBeenCalledWith(DISCARD_CONFIRM);
    await waitFor(() =>
      expect(screen.queryByTestId('preview-toggle-note-description')).toBeNull()
    );
    await screen.findByText('other-tab text');
    expect(loadCallCount).toBe(2);

    // Reopen re-seeds the fresh row/stamp and re-applying the edit saves
    // clean — no 409 loop.
    saveError = null;
    fireEvent.click(screen.getByRole('button', { name: 'Edit note: other-tab text' }));
    expect(screen.getByTestId('preview-toggle-note-description').value).toBe('other-tab text');
    expect(loadCallCount).toBe(2);
    fireEvent.change(screen.getByTestId('preview-toggle-note-description'), {
      target: { value: 're-applied' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));
    await waitFor(() =>
      expect(screen.queryByTestId('preview-toggle-note-description')).toBeNull()
    );
    expect(saveCallCount).toBe(2);
    expect(screen.queryByText(/NOT saved/)).not.toBeInTheDocument();
  });

  it('clean editor: Reload list stays one click — no confirm, closes + refetches', async () => {
    renderNotes();
    await screen.findByText('old note');

    // Conflict with an untouched draft (stale stamp, no local edits).
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));
    await screen.findByText(/NOT saved/);

    notesFixture = [{ ...notesFixture[0], description: 'new text' }];
    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));

    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByTestId('preview-toggle-note-description')).toBeNull()
    );
    await screen.findByText('new text');
    expect(loadCallCount).toBe(2);
  });

  it('draft reverted to the seed counts as clean — no confirm', async () => {
    renderNotes();
    await screen.findByText('old note');

    // Type an edit, then undo it before saving: deep-equal to the seed again.
    await openEditor();
    fireEvent.change(screen.getByTestId('preview-toggle-note-description'), {
      target: { value: 'wip' },
    });
    fireEvent.change(screen.getByTestId('preview-toggle-note-description'), {
      target: { value: 'old note' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));
    await screen.findByText(/NOT saved/);

    fireEvent.click(screen.getByRole('button', { name: 'Reload list' }));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByTestId('preview-toggle-note-description')).toBeNull()
    );
    expect(loadCallCount).toBe(2);
  });
});
