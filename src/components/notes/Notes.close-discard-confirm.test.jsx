// @maintained-by-ai: 2026-10-29
// Regression lock for improve 2026-10-29-V (ct-lanes-close-x-unguarded): the
// Notes lane's ×/Cancel close path must NAME the discard through the shared
// useReloadGuard when the draft is dirty — wizard precedent
// `Discard changes to "X"?` (CharacterCreationWizard.jsx) — with the entity
// name the editor shows (noteDisplayName: party location, else a plain-text
// description excerpt; unnamed new draft → the wizard's generic new-draft
// copy). A clean draft keeps closing silently. Dismiss is fully inert
// (banner, editor, draft survive — zero network); accept closes via the same
// handleCloseModal path; internal closes (save/delete/reload) stay single-
// confirm. Harness mirrors Notes.reload-discard-confirm.test.jsx.
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

const conflictError = () => Object.assign(new Error(CONFLICT_MESSAGE), { conflict: true });

const renderNotes = () =>
  render(<Notes campaignName="test-campaign" characters={[]} isLocalhost />);

const openEditor = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'Edit note: old note' }));
};

const closeX = () => screen.getByRole('button', { name: 'Close' });
const cancelButton = () => screen.getByRole('button', { name: 'Cancel' });
const editor = () => screen.queryByTestId('preview-toggle-note-description');

describe('Notes ×/Cancel close: dirty draft names the discard', () => {
  let confirmSpy;
  beforeEach(() => {
    loadCallCount = 0;
    saveCallCount = 0;
    saveError = null;
    notesFixture = [{
      id: 'n1',
      description: 'old note',
      isPrivate: false,
      dateCreated: '2026-01-01T00:00:00.000Z',
      dateModified: '2026-01-02T00:00:00.000Z',
      partyLevel: 1,
      partyLocation: '',
    }];
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dirty draft + ×: exactly ONE named confirm (location names the note)', async () => {
    renderNotes();
    await openEditor();
    fireEvent.change(screen.getByLabelText('Party Location'), {
      target: { value: 'Waterdeep' },
    });

    fireEvent.click(closeX());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "Waterdeep"?');
  });

  it('dirty draft + Cancel: dismiss is fully inert — editor, draft, banner survive, zero network', async () => {
    // With a 409 banner up too: dismissing the close must leave everything.
    saveError = conflictError();
    renderNotes();
    await openEditor();
    fireEvent.change(editor(), { target: { value: 'my unsaved draft' } });
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));
    await screen.findByText(/NOT saved/);
    loadCallCount = 0;

    fireEvent.click(cancelButton());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "my unsaved draft"?');
    expect(screen.getByText(/NOT saved/)).toHaveTextContent(CONFLICT_MESSAGE);
    expect(editor()).toBeInTheDocument();
    expect(editor().value).toBe('my unsaved draft');
    expect(loadCallCount).toBe(0);
    expect(saveCallCount).toBe(1);
  });

  it('dirty draft + Cancel: accept closes via the same path — no reload, no residue', async () => {
    renderNotes();
    await openEditor();
    fireEvent.change(editor(), { target: { value: 'typo fix in progress' } });
    confirmSpy.mockReturnValue(true);

    fireEvent.click(cancelButton());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "typo fix in progress"?');
    await waitFor(() => expect(editor()).toBeNull());
    // Clean close: no missed-broadcast refresh, list untouched.
    expect(loadCallCount).toBe(1);
    expect(screen.queryByText(/NOT saved/)).not.toBeInTheDocument();
  });

  it('clean draft: × and Cancel close silently — behavior unchanged', async () => {
    renderNotes();
    await openEditor();

    fireEvent.click(closeX());
    await waitFor(() => expect(editor()).toBeNull());
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(loadCallCount).toBe(1);

    // Reopen, touch nothing, Cancel: still silent, and the rejected-save
    // stale-refresh side effect of handleCloseModal stays wired (clean
    // Cancel after a 409 still refetches).
    saveError = conflictError();
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: /^save/i }));
    await screen.findByText(/NOT saved/);
    loadCallCount = 0;

    fireEvent.click(cancelButton());
    await waitFor(() => expect(editor()).toBeNull());
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(loadCallCount).toBe(1);
  });

  it('unnamed new draft (Private toggle only): wizard generic new-draft copy', async () => {
    renderNotes();
    await screen.findByText('old note');
    fireEvent.click(screen.getByRole('button', { name: /new note/i }));
    fireEvent.click(screen.getByLabelText(/Private Note/i));

    fireEvent.click(closeX());

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Discard this new note draft?');
    // Dismiss keeps the fresh editor open with the toggle still set.
    expect(editor()).toBeInTheDocument();
    expect(screen.getByLabelText(/Private Note/i)).toBeChecked();
  });

  it('save success still closes without double-confirm', async () => {
    renderNotes();
    await openEditor();
    fireEvent.change(editor(), { target: { value: 'final text' } });

    fireEvent.click(screen.getByRole('button', { name: /^save/i }));
    await waitFor(() => expect(editor()).toBeNull());
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('delete keeps its own single named confirm (unchanged path)', async () => {
    renderNotes();
    await openEditor();
    fireEvent.change(editor(), { target: { value: 'doomed draft' } });
    confirmSpy.mockReturnValue(true);

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(editor()).toBeNull());
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Delete Note "old note"?');
  });
});
