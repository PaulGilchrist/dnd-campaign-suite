// @maintained-by-ai: 2026-10-14
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import Notes from './Notes.jsx';
import { useEntityManagement } from '../../hooks/useEntityManagement.js';

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
      onBack={() => {}}
      {...props}
    />,
  );

const openNewNote = () => fireEvent.click(screen.getByRole('button', { name: /new note/i }));
const openEditNote = () => fireEvent.click(screen.getByRole('button', { name: /edit note/i }));
const setDescription = (value) =>
  fireEvent.change(screen.getByTestId('preview-toggle-textarea'), { target: { value } });
const saveButton = () => screen.getByRole('button', { name: /save/i });

describe('Notes', () => {
  let confirmMock;

  beforeEach(() => {
    mockHook();
    confirmMock = vi.fn(() => false);
    vi.stubGlobal('confirm', confirmMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('rendering', () => {
    it('renders header, new note button, search bar, and empty state', () => {
      renderNotes();
      expect(screen.getByRole('heading', { name: /notes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /new note/i })).toBeInTheDocument();
      expect(screen.getByLabelText('Search notes')).toBeInTheDocument();
      expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    });

    it('renders loading state when loading is true', () => {
      mockHook({ loading: true });
      renderNotes();
      expect(screen.getByText(/loading notes/i)).toBeInTheDocument();
    });

    it('shows location text when present and no-location placeholder when absent', () => {
      mockHook({ items: [makeNote({ partyLocation: 'Dungeon' })] });
      renderNotes();
      expect(screen.getByText('Dungeon')).toBeInTheDocument();

      mockHook({ items: [makeNote({ id: '2', partyLocation: '' })] });
      renderNotes();
      expect(screen.getByText(/no location/i)).toBeInTheDocument();
    });
  });

  describe('row aria-label', () => {
    it('labels a location-named row with its party location, not raw markdown', () => {
      mockHook({
        items: [makeNote({ partyLocation: 'QA Cave Note', description: '## Session hook\nThe **baron** arrives at dawn.' })],
      });
      renderNotes();
      expect(
        screen.getByRole('button', { name: 'Edit note: QA Cave Note' }),
      ).toBeInTheDocument();
    });

    it('labels a description-titled row with a markdown-stripped plain title', () => {
      mockHook({
        items: [makeNote({ partyLocation: '', description: '## QA **bold hook**\nbody of the note' })],
      });
      renderNotes();
      expect(
        screen.getByRole('button', { name: 'Edit note: QA bold hook body of the note' }),
      ).toBeInTheDocument();
    });

    it('every note row matches the Edit note: prefix and no label carries markdown syntax', () => {
      mockHook({
        items: [
          makeNote({ id: '1', partyLocation: 'Skull Creek Cave', description: '## Plot `hook`\n- item [link](http://x)' }),
          makeNote({ id: '2', partyLocation: '', description: '**Bold** _italic_ ~~strike~~\n> quote' }),
        ],
      });
      renderNotes();
      const rows = document.querySelectorAll('.ct-list-item');
      expect(rows).toHaveLength(2);
      const labelled = document.querySelectorAll('[aria-label^="Edit note: "]');
      expect(labelled).toHaveLength(rows.length);
      labelled.forEach((row) => {
        expect(row.getAttribute('aria-label')).not.toMatch(/[#*`[\]>~_]/);
      });
    });

    it('row label title and delete confirm title are derived identically', () => {
      mockHook({
        items: [makeNote({
          description: '## Important Plot Hook\nThe **baron** wants revenge on the guildmasters for the raid on the village',
        })],
      });
      confirmMock.mockReturnValue(false);
      renderNotes();
      const label = screen.getByRole('button', { name: /^Edit note: / }).getAttribute('aria-label');
      const title = label.replace(/^Edit note: /, '');
      openEditNote();
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(confirmMock).toHaveBeenCalledWith(`Delete Note "${title}"?`);
    });
  });

  describe('search', () => {
    const searchable = [
      makeNote({ description: 'Fireball is a 3rd level spell' }),
      makeNote({ id: '2', description: 'Thunderwave explosion' }),
    ];

    it.each`
      query            | shouldMatch                          | shouldNotMatch
      ${'fireball'}    | ${'Fireball is a 3rd level spell'}  | ${'Thunderwave explosion'}
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

    it('shows and clears query via the clear search button', () => {
      mockHook({ items: searchable });
      renderNotes();
      const searchInput = screen.getByLabelText('Search notes');
      fireEvent.change(searchInput, { target: { value: 'fireball' } });
      fireEvent.click(screen.getByLabelText('Clear search'));
      expect(searchInput.value).toBe('');
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
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
      characters                    | expectedLevel
      ${[]}                         | ${1}
      ${[{ level: 5 }, { level: 7 }]} | ${6}
      ${[{ level: 1 }, { level: 2 }, { level: 3 }]} | ${2}
      ${[{}, { level: 5 }]}        | ${3}
    `('calculates party level from characters → level $expectedLevel', ({ characters, expectedLevel }) => {
      renderNotes({ characters });
      openNewNote();
      expect(screen.getByText(String(expectedLevel))).toBeInTheDocument();
    });

    it.each(['Cancel', 'Close'])('closes modal via the %s button', (name) => {
      renderNotes();
      openNewNote();
      fireEvent.click(screen.getByRole('button', { name }));
      expect(screen.queryByRole('heading', { name: 'New Note' })).not.toBeInTheDocument();
    });

    it('does not close modal via overlay click', () => {
      renderNotes();
      openNewNote();
      fireEvent.click(document.querySelector('.ct-modal-overlay'));
      expect(screen.getByRole('heading', { name: 'New Note' })).toBeInTheDocument();
    });

    it.each([' ', '\n\t '])(
      'disables save when description is whitespace only: %j',
      (description) => {
        renderNotes();
        openNewNote();
        setDescription(description);
        expect(saveButton()).toBeDisabled();
      },
    );
  });

  describe('saving notes', () => {
    it('creates a new note with description, private flag, and location', async () => {
      const saveItems = vi.fn().mockResolvedValue(undefined);
      mockHook({ saveItems });
      renderNotes();
      openNewNote();
      setDescription('My new note');
      fireEvent.click(screen.getByLabelText(/private note/i));
      fireEvent.change(screen.getByLabelText(/party location/i), {
        target: { value: 'Skull Creek Cave' },
      });
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
      await act(async () => fireEvent.click(saveButton()));
      const callArgs = saveItems.mock.calls[0][0];
      expect(callArgs).toHaveLength(1);
      expect(callArgs[0]).toMatchObject({ id: '1', description: 'Updated text' });
    });
  });

  describe('editing notes', () => {
    it('opens edit modal prefilled with note data and a delete button', () => {
      mockHook({
        items: [makeNote({ description: 'Existing content', partyLocation: 'Dungeon', isPrivate: true })],
      });
      renderNotes();
      openEditNote();
      expect(screen.getByRole('heading', { name: 'Edit Note' })).toBeInTheDocument();
      expect(screen.getByTestId('preview-toggle-textarea').value).toBe('Existing content');
      expect(screen.getByLabelText(/party location/i).value).toBe('Dungeon');
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
  });

  describe('deleting notes', () => {
    it.each`
      confirmed | expected
      ${true}   | ${'deletes the note when confirmed'}
      ${false}  | ${'keeps the note when the confirmation is cancelled'}
    `('$expected', async ({ confirmed }) => {
      const deleteItem = vi.fn().mockResolvedValue(undefined);
      mockHook({ items: [makeNote()], deleteItem });
      confirmMock.mockReturnValue(confirmed);
      renderNotes();
      openEditNote();
      await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete' })));
      // Named-confirm contract (mirrors Settlements/Sessions): the message
      // carries a meaningful identifier, never the generic "this note".
      expect(confirmMock).toHaveBeenCalledWith('Delete Note "Test"?');
      if (confirmed) {
        expect(deleteItem).toHaveBeenCalledWith('1');
      } else {
        expect(deleteItem).not.toHaveBeenCalled();
      }
    });

    it('names the note by its party location when one is set', () => {
      mockHook({
        items: [makeNote({ description: 'Some hidden details', partyLocation: 'Skull Creek Cave' })],
      });
      confirmMock.mockReturnValue(false);
      renderNotes();
      openEditNote();
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(confirmMock).toHaveBeenCalledWith('Delete Note "Skull Creek Cave"?');
    });

    it('derives a plain-text shortened title from a markdown description when party location is empty', () => {
      mockHook({
        items: [makeNote({ description: '## The **Baron** wants revenge on the Emerald Enclave guildmasters for the raid' })],
      });
      confirmMock.mockReturnValue(false);
      renderNotes();
      openEditNote();
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      // Markdown syntax stripped, newlines collapsed, truncated at 40 chars + ellipsis
      expect(confirmMock).toHaveBeenCalledWith('Delete Note "The Baron wants revenge on the Emerald E…"?');
    });

    it('disables delete button while deleting', async () => {
      let resolveDelete;
      mockHook({
        items: [makeNote()],
        deleteItem: () => new Promise((resolve) => { resolveDelete = resolve; }),
      });
      confirmMock.mockReturnValue(true);
      renderNotes();
      openEditNote();
      const deleteBtn = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(deleteBtn);
      expect(deleteBtn).toBeDisabled();
      expect(deleteBtn).toHaveTextContent(/deleting/i);
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
