// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Notes from './Notes.jsx';

vi.mock('../../hooks/management/useNotesManagement.js', () => ({
  default: vi.fn(() => ({
    notes: [],
    loading: false,
    loadNotesList: vi.fn(),
    saveNotesList: vi.fn(),
    deleteNoteAction: vi.fn(),
  })),
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

import useNotesManagement from '../../hooks/management/useNotesManagement.js';

const createMockUseNotes = () => ({
  notes: [],
  loading: false,
  loadNotesList: vi.fn(),
  saveNotesList: vi.fn().mockResolvedValue(undefined),
  deleteNoteAction: vi.fn().mockResolvedValue(undefined),
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

describe('Notes', () => {
  let mockUseNotes;

  beforeEach(() => {
    mockUseNotes = createMockUseNotes();
    useNotesManagement.mockReturnValue(mockUseNotes);
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Date.prototype, 'toISOString').mockReturnValue('2025-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders header with title and back button', () => {
      renderNotes();
      expect(screen.getByRole('heading', { name: /notes/i })).toBeInTheDocument();
      expect(screen.getByText(/back/i)).toBeInTheDocument();
    });

    it('renders new note button', () => {
      renderNotes();
      expect(screen.getByRole('button', { name: /new note/i })).toBeInTheDocument();
    });

    it('renders search bar', () => {
      renderNotes();
      expect(screen.getByLabelText('Search notes')).toBeInTheDocument();
    });

    it('renders empty state when no notes exist', () => {
      renderNotes();
      expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    });

    it('renders loading state when loading', () => {
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        loading: true,
      });
      renderNotes();
      expect(screen.getByText(/loading notes/i)).toBeInTheDocument();
    });
  });

  describe('notes list', () => {
    it('renders notes list when notes exist', () => {
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        notes: [
          {
            id: '1',
            description: 'Test note content',
            partyLocation: 'Skull Creek Cave',
            isPrivate: false,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-01-15T12:00:00.000Z',
          },
        ],
      });
      renderNotes();
      expect(screen.getByText(/skull creek cave/i)).toBeInTheDocument();
    });

    it('shows private lock icon for private notes', () => {
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        notes: [
          {
            id: '1',
            description: 'Secret',
            partyLocation: '',
            isPrivate: true,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-01-15T12:00:00.000Z',
          },
        ],
      });
      renderNotes();
      expect(screen.getByTitle('Private note')).toBeInTheDocument();
    });

    it('shows no location for notes without partyLocation', () => {
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        notes: [
          {
            id: '1',
            description: 'Test',
            partyLocation: '',
            isPrivate: false,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-01-15T12:00:00.000Z',
          },
        ],
      });
      renderNotes();
      expect(screen.getByText(/no location/i)).toBeInTheDocument();
    });

    it('shows location icon for notes with partyLocation', () => {
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        notes: [
          {
            id: '1',
            description: 'Test',
            partyLocation: 'Dungeon',
            isPrivate: false,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-01-15T12:00:00.000Z',
          },
        ],
      });
      renderNotes();
      expect(screen.getByText('Dungeon')).toBeInTheDocument();
    });

    it('truncates long descriptions in list view', () => {
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        notes: [
          {
            id: '1',
            description: 'A'.repeat(200),
            partyLocation: '',
            isPrivate: false,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-01-15T12:00:00.000Z',
          },
        ],
      });
      renderNotes();
      const noteItem = screen.getByRole('button', { name: /edit note/i });
      expect(noteItem.textContent).toContain('…');
    });

    it('does not truncate short descriptions', () => {
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        notes: [
          {
            id: '1',
            description: 'Short',
            partyLocation: '',
            isPrivate: false,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-01-15T12:00:00.000Z',
          },
        ],
      });
      renderNotes();
      const noteItem = screen.getByRole('button', { name: /edit note/i });
      expect(noteItem.textContent).toContain('Short');
    });

    it('renders date modified for notes', () => {
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        notes: [
          {
            id: '1',
            description: 'Test',
            partyLocation: '',
            isPrivate: false,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-01-15T12:00:00.000Z',
          },
        ],
      });
      renderNotes();
      const noteItem = screen.getByRole('button', { name: /edit note/i });
      expect(noteItem.textContent).toContain('2025');
    });
  });

  describe('search', () => {
    it('filters notes by search query and shows no results for non-matching query', async () => {
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        notes: [
          {
            id: '1',
            description: 'Fireball is a 3rd level spell',
            partyLocation: '',
            isPrivate: false,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-01-15T12:00:00.000Z',
          },
          {
            id: '2',
            description: 'Thunderwave explosion',
            partyLocation: '',
            isPrivate: false,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-01-15T12:00:00.000Z',
          },
        ],
      });
      renderNotes();
      const searchInput = screen.getByLabelText('Search notes');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      expect(screen.getByText(/no notes found matching/i)).toBeInTheDocument();
    });

    it('clears search when clear button is clicked', async () => {
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        notes: [
          {
            id: '1',
            description: 'Fireball is a 3rd level spell',
            partyLocation: '',
            isPrivate: false,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-01-15T12:00:00.000Z',
          },
        ],
      });
      renderNotes();
      const searchInput = screen.getByLabelText('Search notes');
      fireEvent.change(searchInput, { target: { value: 'fireball' } });
      const clearBtn = screen.getByLabelText('Clear search');
      fireEvent.click(clearBtn);
      expect(searchInput.value).toBe('');
    });
  });

  describe('modal', () => {
    it('opens modal when new note button is clicked', () => {
      renderNotes();
      const modalOpen = screen.getByRole('button', { name: /new note/i });
      fireEvent.click(modalOpen);
      expect(screen.getByRole('heading', { name: 'New Note' })).toBeInTheDocument();
    });

    it('shows private note checkbox only when isLocalhost is true', () => {
      renderNotes({ isLocalhost: false });
      const modalOpen = screen.getByRole('button', { name: /new note/i });
      fireEvent.click(modalOpen);
      expect(screen.queryByLabelText(/private note/i)).not.toBeInTheDocument();
    });

    it('shows private note checkbox when isLocalhost is true', () => {
      renderNotes({ isLocalhost: true });
      const modalOpen = screen.getByRole('button', { name: /new note/i });
      fireEvent.click(modalOpen);
      expect(screen.getByLabelText(/private note/i)).toBeInTheDocument();
    });

    it('closes modal when cancel button is clicked', () => {
      renderNotes();
      const modalOpen = screen.getByRole('button', { name: /new note/i });
      fireEvent.click(modalOpen);
      expect(screen.getByRole('heading', { name: 'New Note' })).toBeInTheDocument();
      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelBtn);
      expect(screen.queryByRole('heading', { name: 'New Note' })).not.toBeInTheDocument();
    });

    it('closes modal when close button is clicked', () => {
      renderNotes();
      const modalOpen = screen.getByRole('button', { name: /new note/i });
      fireEvent.click(modalOpen);
      const closeBtn = screen.getByLabelText('Close');
      fireEvent.click(closeBtn);
      expect(screen.queryByRole('heading', { name: 'New Note' })).not.toBeInTheDocument();
    });

    it('closes modal when clicking overlay', () => {
      renderNotes();
      const modalOpen = screen.getByRole('button', { name: /new note/i });
      fireEvent.click(modalOpen);
      const overlay = document.querySelector('.ct-modal-overlay');
      if (overlay) {
        fireEvent.click(overlay);
      }
      expect(screen.queryByRole('heading', { name: 'New Note' })).not.toBeInTheDocument();
    });

    it('auto-calculates party level from characters', () => {
      renderNotes({ characters: [{ level: 5 }, { level: 7 }] });
      const modalOpen = screen.getByRole('button', { name: /new note/i });
      fireEvent.click(modalOpen);
      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('defaults party level to 1 when no characters', () => {
      renderNotes({ characters: [] });
      const modalOpen = screen.getByRole('button', { name: /new note/i });
      fireEvent.click(modalOpen);
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('saving notes', () => {
    it('saves a new note when save is clicked with description', async () => {
      renderNotes();
      const modalOpen = screen.getByRole('button', { name: /new note/i });
      fireEvent.click(modalOpen);
      const textarea = screen.getByTestId('preview-toggle-textarea');
      fireEvent.change(textarea, { target: { value: 'My new note' } });
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(mockUseNotes.saveNotesList).toHaveBeenCalled();
    });

    it('does not save when description is empty', async () => {
      renderNotes();
      const modalOpen = screen.getByRole('button', { name: /new note/i });
      fireEvent.click(modalOpen);
      const saveBtn = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveBtn);
      expect(mockUseNotes.saveNotesList).not.toHaveBeenCalled();
    });

    it('disables save button when description is empty', () => {
      renderNotes();
      const modalOpen = screen.getByRole('button', { name: /new note/i });
      fireEvent.click(modalOpen);
      const saveBtn = screen.getByRole('button', { name: /save/i });
      expect(saveBtn).toBeDisabled();
    });
  });

  describe('editing notes', () => {
    it('opens edit modal when clicking a note', () => {
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        notes: [
          {
            id: '1',
            description: 'Edit me',
            partyLocation: 'Cave',
            isPrivate: false,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-01-15T12:00:00.000Z',
          },
        ],
      });
      renderNotes();
      const noteItem = screen.getByRole('button', { name: /edit note/i });
      fireEvent.click(noteItem);
      expect(screen.getByRole('heading', { name: 'Edit Note' })).toBeInTheDocument();
    });

    it('shows delete button when editing a note', () => {
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        notes: [
          {
            id: '1',
            description: 'Delete me',
            partyLocation: '',
            isPrivate: false,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-01-15T12:00:00.000Z',
          },
        ],
      });
      renderNotes();
      const noteItem = screen.getByRole('button', { name: /edit note/i });
      fireEvent.click(noteItem);
      const deleteBtn = screen.getByRole('button', { name: 'Delete' });
      expect(deleteBtn).toBeInTheDocument();
    });

    it('does not show delete button for new note', () => {
      renderNotes();
      const modalOpen = screen.getByRole('button', { name: /new note/i });
      fireEvent.click(modalOpen);
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });
  });

  describe('deleting notes', () => {
    it('calls deleteNoteAction when delete is confirmed', async () => {
      global.window.confirm = vi.fn(() => true);
      const deleteMock = createMockUseNotes();
      useNotesManagement.mockReturnValue({
        ...deleteMock,
        notes: [
          {
            id: '1',
            description: 'Delete me',
            partyLocation: '',
            isPrivate: false,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-01-15T12:00:00.000Z',
          },
        ],
      });
      renderNotes();
      const noteItem = screen.getByRole('button', { name: /edit note/i });
      fireEvent.click(noteItem);
      const deleteBtn = screen.getByRole('button', { name: 'Delete' });
      fireEvent.click(deleteBtn);
      expect(deleteMock.deleteNoteAction).toHaveBeenCalledWith('1');
    });

    it('does not delete when user cancels confirmation', async () => {
      global.window.confirm = vi.fn(() => false);
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        notes: [
          {
            id: '1',
            description: 'Keep me',
            partyLocation: '',
            isPrivate: false,
            dateCreated: '2025-01-01T00:00:00.000Z',
            dateModified: '2025-01-15T12:00:00.000Z',
          },
        ],
      });
      renderNotes();
      const noteItem = screen.getByRole('button', { name: /edit note/i });
      fireEvent.click(noteItem);
      const deleteBtn = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteBtn);
      expect(mockUseNotes.deleteNoteAction).not.toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('loads notes on mount with campaignName', () => {
      const loadNotesListMock = vi.fn();
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        loadNotesList: loadNotesListMock,
      });
      renderNotes();
      expect(loadNotesListMock).toHaveBeenCalled();
    });

    it('does not load notes without campaignName', () => {
      const loadNotesListMock = vi.fn();
      useNotesManagement.mockReturnValue({
        ...createMockUseNotes(),
        loadNotesList: loadNotesListMock,
      });
      renderNotes({ campaignName: null });
      expect(loadNotesListMock).not.toHaveBeenCalled();
    });
  });
});
