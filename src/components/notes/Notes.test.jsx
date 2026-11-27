// @maintained-by-ai 2026-11-26
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import Notes from './Notes.jsx';
import { useEntityManagement } from '../../hooks/useEntityManagement.js';

// Notes mounts <Subscriber> (live factions-style list sync). Mock the shared
// SSE client so this file's afterEach `vi.unstubAllGlobals()` — which also
// drops setup.js's global EventSource stub — cannot break later mounts.
// Close/discard lanes live in Notes.close-discard-confirm.test.jsx, 409
// recovery in Notes.concurrent-save.test.jsx, live sync in
// Notes.sse-sync.test.jsx; the shared dialog's own focus/Escape/backdrop
// contract is pinned by common/DeleteConfirmModal.test.jsx. This file owns:
// list rendering + search, row/dialog title derivation, save gating/payload,
// and the Notes-side delete wiring.
vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: () => () => {},
}));

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: vi.fn(),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: function PreviewToggle({ value, onChange, placeholder, label }) {
    return (
      <div className="preview-toggle-wrapper">
        {label && <label>{label}</label>}
        <textarea
          data-testid="preview-toggle-textarea"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
        />
      </div>
    );
  },
}));

const makeNote = (overrides = {}) => ({
  id: '1',
  description: 'Test',
  partyLocation: '',
  isPrivate: false,
  dateCreated: '2025-01-01T00:00:00.000Z',
  dateModified: '2025-01-15T12:00:00.000Z',
  ...overrides,
});

const mockHook = ({ items = [], ...rest } = {}) =>
  useEntityManagement.mockReturnValue({
    items,
    loading: false,
    loadItems: vi.fn(),
    saveItems: vi.fn().mockResolvedValue(undefined),
    deleteItem: vi.fn().mockResolvedValue(undefined),
    ...rest,
  });

const renderNotes = (props = {}) =>
  render(
    <Notes
      campaignName="test"
      characters={[]}
      isLocalhost={true}
      {...props}
    />,
  );

const openNewNote = () => fireEvent.click(screen.getByRole('button', { name: /new note/i }));
const openEditNote = () => fireEvent.click(screen.getByRole('button', { name: /edit note/i }));
const setDescription = (value) =>
  fireEvent.change(screen.getByTestId('preview-toggle-textarea'), { target: { value } });
const setPartyLocation = (value) =>
  fireEvent.change(screen.getByLabelText(/party location/i), { target: { value } });
const saveButton = () => screen.getByRole('button', { name: /save/i });

describe('Notes', () => {
  let confirmSpy;

  const deleteDialog = () => screen.getByRole('dialog', { name: 'Delete Note' });

  beforeEach(() => {
    mockHook();
    // A native confirm that FIRES on this lane is a regression (QA backlog
    // 2026-11-24: the delete leg migrated to the shared DeleteConfirmModal) —
    // make it loud. The discard-draft confirm (useReloadGuard) is a different
    // lane with its own files.
    confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => {
      throw new Error('native window.confirm fired on the notes delete path');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('rendering', () => {
    it('renders header, new note button, search bar, and empty state', () => {
      renderNotes();
      expect(screen.getByRole('heading', { name: /notes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /new note/i })).toBeInTheDocument();
      expect(screen.getByLabelText('Search notes')).toBeInTheDocument();
      expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    });

    it('renders loading state when loading is true', () => {
      mockHook({ loading: true });
      renderNotes();
      expect(screen.getByText(/loading notes/i)).toBeInTheDocument();
    });
  });

  describe('row labels', () => {
    // Note rows have no name field: the aria-label (and the delete-confirm
    // title, tested below) share ONE noteDisplayName derivation — party
    // location wins, else a markdown-stripped excerpt of the description.
    it('labels every row "Edit note: <title>" — party location wins, else a markdown-stripped description', () => {
      mockHook({
        items: [
          makeNote({ id: '1', partyLocation: 'Skull Creek Cave', description: '## Plot `hook`\n- item [link](http://x)' }),
          makeNote({ id: '2', partyLocation: '', description: '**Bold** _italic_ ~~strike~~\n> quote' }),
        ],
      });
      renderNotes();
      const rows = screen.getAllByRole('button', { name: /^Edit note: / });
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveAccessibleName('Edit note: Skull Creek Cave');
      // Markdown syntax never leaks into the label.
      expect(rows[1]).toHaveAccessibleName('Edit note: Bold italic strike quote');
    });

    it('row label title and delete dialog title are derived identically', () => {
      mockHook({
        items: [makeNote({
          description: '## Important Plot Hook\nThe **baron** wants revenge on the guildmasters for the raid on the village',
        })],
      });
      renderNotes();
      const label = screen.getByRole('button', { name: /^Edit note: / }).getAttribute('aria-label');
      const title = label.replace(/^Edit note: /, '');
      openEditNote();
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(deleteDialog()).toHaveTextContent(title);
    });
  });

  describe('search', () => {
    const searchable = [
      // partyLocation on the first row pins the widened field list
      // (improve 2026-11-12 OP backlog): the row TITLE is searchable too.
      makeNote({ description: 'Fireball is a 3rd level spell', partyLocation: 'Ember Hollow Shrine' }),
      makeNote({ id: '2', description: 'Thunderwave explosion' }),
    ];

    it.each`
      query            | shouldMatch                          | shouldNotMatch
      ${'fireball'}    | ${'Fireball is a 3rd level spell'}  | ${'Thunderwave explosion'}
      ${'HOLLOW shr'}  | ${'Fireball is a 3rd level spell'}  | ${'Thunderwave explosion'}
      ${'nonexistent'} | ${null}                              | ${'Fireball is a 3rd level spell'}
    `('filters notes by search query: "$query"', ({ query, shouldMatch, shouldNotMatch }) => {
      mockHook({ items: searchable });
      renderNotes();
      fireEvent.change(screen.getByLabelText('Search notes'), { target: { value: query } });
      if (shouldMatch) {
        expect(screen.getByText(shouldMatch)).toBeInTheDocument();
      } else {
        expect(screen.getByText(/no notes found matching/i)).toBeInTheDocument();
      }
      if (shouldNotMatch) {
        expect(screen.queryByText(shouldNotMatch)).not.toBeInTheDocument();
      }
    });

    // Post-save visibility guarantee (improve 2026-11-12 NN backlog): saving
    // while the filter is armed must never leave the saved row invisible
    // (the "looks like a lost write" trap); a still-matching save — via
    // description OR partyLocation (shared NOTE_SEARCH_FIELDS) — leaves the
    // user's filter untouched.
    it.each`
      description                              | partyLocation      | filterAfterSave
      ${'A brand new trap log'}                | ${'Glyph Chamber'} | ${''}
      ${'Fireball scorch marks on the wall'}   | ${'Glyph Chamber'} | ${'fireball'}
      ${'Scorch marks on the wall'}            | ${'Fireball Altar'} | ${'fireball'}
    `('filter "$filterAfterSave" survives a save of "$description" in "$partyLocation"', async ({
      description,
      partyLocation,
      filterAfterSave,
    }) => {
      const saveItems = vi.fn().mockResolvedValue(undefined);
      mockHook({ items: searchable, saveItems });
      renderNotes();
      fireEvent.change(screen.getByLabelText('Search notes'), {
        target: { value: 'fireball' },
      });
      openNewNote();
      setDescription(description);
      setPartyLocation(partyLocation);
      await act(async () => fireEvent.click(saveButton()));
      expect(saveItems).toHaveBeenCalled();
      // Asserted via the input itself (not row visibility, which depends on
      // the mocked hook's static items): the filter resets only when the
      // saved row would land outside it.
      expect(screen.getByLabelText('Search notes').value).toBe(filterAfterSave);
    });
  });

  describe('modal', () => {
    it('opens new-note modal with disabled save and no delete button', () => {
      renderNotes();
      openNewNote();
      expect(screen.getByRole('heading', { name: 'New Note' })).toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it.each`
      isLocalhost | shouldShow
      ${true}     | ${true}
      ${false}    | ${false}
    `('shows private note checkbox only on localhost ($isLocalhost)', ({ isLocalhost, shouldShow }) => {
      renderNotes({ isLocalhost });
      openNewNote();
      expect(!!screen.queryByLabelText(/private note/i)).toBe(shouldShow);
    });

    it.each`
      characters                       | expectedLevel
      ${[]}                            | ${1}
      ${[{ level: 5 }, { level: 7 }]}  | ${6}
      ${[{}, { level: 5 }]}            | ${3}
    `('calculates party level from characters → level $expectedLevel', ({ characters, expectedLevel }) => {
      renderNotes({ characters });
      openNewNote();
      expect(screen.getByText(String(expectedLevel))).toBeInTheDocument();
    });

    it('does not close modal via overlay click', () => {
      renderNotes();
      openNewNote();
      fireEvent.click(document.querySelector('.ct-modal-overlay'));
      expect(screen.getByRole('heading', { name: 'New Note' })).toBeInTheDocument();
    });

    // Validation-by-disable harmonization (improve 2026-11-12 NN backlog):
    // Notes mirrors the Sessions empty-Name gate — whitespace-only
    // description OR party location keeps Save inert so every stored row
    // carries both.
    it.each`
      description       | partyLocation       | enabled
      ${' '}            | ${'Skull Creek Cave'} | ${false}
      ${'Real content'} | ${''}               | ${false}
      ${'Real content'} | ${' \n\t '}         | ${false}
      ${'Real content'} | ${'Skull Creek Cave'} | ${true}
    `('enables Save = $enabled for description $description and location $partyLocation', ({
      description,
      partyLocation,
      enabled,
    }) => {
      renderNotes();
      openNewNote();
      setDescription(description);
      setPartyLocation(partyLocation);
      if (enabled) {
        expect(saveButton()).toBeEnabled();
      } else {
        expect(saveButton()).toBeDisabled();
      }
    });
  });

  describe('saving notes', () => {
    it('creates a new note with description, private flag, and location', async () => {
      const saveItems = vi.fn().mockResolvedValue(undefined);
      mockHook({ saveItems });
      renderNotes();
      openNewNote();
      setDescription('My new note');
      fireEvent.click(screen.getByLabelText(/private note/i));
      setPartyLocation('Skull Creek Cave');
      await act(async () => fireEvent.click(saveButton()));
      const callArgs = saveItems.mock.calls[0][0];
      expect(callArgs).toHaveLength(1);
      expect(callArgs[0]).toMatchObject({
        description: 'My new note',
        isPrivate: true,
        partyLocation: 'Skull Creek Cave',
      });
      expect(callArgs[0].dateModified).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'New Note' })).not.toBeInTheDocument();
    });

    it('updates an existing note preserving its id', async () => {
      const saveItems = vi.fn().mockResolvedValue(undefined);
      mockHook({ items: [makeNote({ description: 'Original text' })], saveItems });
      renderNotes();
      openEditNote();
      setDescription('Updated text');
      // The location gate (harmonized 2026-11-12) makes Save inert until the
      // legacy empty-location row gets a location — type one before saving.
      setPartyLocation('Dungeon');
      await act(async () => fireEvent.click(saveButton()));
      const callArgs = saveItems.mock.calls[0][0];
      expect(callArgs).toHaveLength(1);
      expect(callArgs[0]).toMatchObject({ id: '1', description: 'Updated text' });
    });
  });

  describe('editing notes', () => {
    it('shows the location on the row and opens the edit modal prefilled with a delete button', () => {
      mockHook({
        items: [makeNote({ description: 'Existing content', partyLocation: 'Dungeon', isPrivate: true })],
      });
      renderNotes();
      expect(screen.getByText('Dungeon')).toBeInTheDocument();
      openEditNote();
      expect(screen.getByRole('heading', { name: 'Edit Note' })).toBeInTheDocument();
      expect(screen.getByTestId('preview-toggle-textarea').value).toBe('Existing content');
      expect(screen.getByLabelText(/party location/i).value).toBe('Dungeon');
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
  });

  describe('deleting notes', () => {
    // QA backlog 2026-11-24: the native `Delete Note "X"?` confirm is retired —
    // the footer Delete button opens the shared DeleteConfirmModal tier
    // (mirrors EncounterModal.delete-confirm-modal.test.jsx). The dialog's
    // internal focus/Escape/backdrop routing is pinned by
    // common/DeleteConfirmModal.test.jsx; here we pin the Notes-side wiring:
    // it names the right note, Cancel writes nothing and keeps the editor,
    // and the staged confirm is the only writer.
    const armDelete = (note) => {
      const deleteItem = vi.fn().mockResolvedValue(undefined);
      mockHook({ items: [note], deleteItem });
      renderNotes();
      openEditNote();
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      return deleteItem;
    };

    it('the Delete button opens the shared dialog naming the note — no native confirm', () => {
      armDelete(makeNote());
      const dialog = deleteDialog();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      // Named-confirm contract (mirrors Settlements/Sessions): the copy
      // carries a meaningful identifier, never the generic "this note".
      expect(dialog).toHaveTextContent('Test');
      expect(screen.getByRole('button', { name: /Yes, Delete Permanently/i })).toBeInTheDocument();
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('derives a plain-text shortened title from a markdown description when party location is empty', () => {
      armDelete(makeNote({
        description: '## The **Baron** wants revenge on the Emerald Enclave guildmasters for the raid',
      }));
      // Markdown syntax stripped, newlines collapsed, truncated at 40 chars + ellipsis
      expect(deleteDialog()).toHaveTextContent('The Baron wants revenge on the Emerald E…');
    });

    it('the Cancel button dismisses the dialog and keeps the note — zero delete, editor intact', () => {
      const deleteItem = armDelete(makeNote());
      const dialog = deleteDialog();
      // The editor's own Cancel stays behind the dialog — always answer the
      // dialog's buttons only.
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(deleteItem).not.toHaveBeenCalled();
      // The note editor survives the dismiss — the row is still on screen.
      expect(screen.getByRole('heading', { name: 'Edit Note' })).toBeInTheDocument();
      expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('deletes the note when confirmed via Yes, Delete Permanently', async () => {
      const deleteItem = armDelete(makeNote());
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Yes, Delete Permanently/i }));
      });
      expect(deleteItem).toHaveBeenCalledWith('1');
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Edit Note' })).not.toBeInTheDocument();
    });

    it('disables delete button while deleting', async () => {
      let resolveDelete;
      mockHook({
        items: [makeNote()],
        deleteItem: () => new Promise((resolve) => { resolveDelete = resolve; }),
      });
      renderNotes();
      openEditNote();
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Yes, Delete Permanently/i }));
      });
      const deleteBtn = screen.getByRole('button', { name: /deleting/i });
      expect(deleteBtn).toBeDisabled();
      await act(async () => resolveDelete());
    });
  });

  describe('lifecycle and accessibility', () => {
    it('loads notes on mount', () => {
      const loadItems = vi.fn();
      mockHook({ loadItems });
      renderNotes();
      expect(loadItems).toHaveBeenCalled();
    });

    it.each`
      key
      ${'Enter'}
      ${' '}
    `('opens edit modal when list item is activated via $key key', ({ key }) => {
      mockHook({ items: [makeNote({ description: 'Keyboard test' })] });
      renderNotes();
      fireEvent.keyDown(screen.getByRole('button', { name: /edit note/i }), { key });
      expect(screen.getByRole('heading', { name: 'Edit Note' })).toBeInTheDocument();
    });
  });
});
