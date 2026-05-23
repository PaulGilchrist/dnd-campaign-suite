import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Notes from './Notes.jsx';

vi.mock('../../hooks/useNotesManagement.js', () => ({
  default: () => ({
    notes: [],
    loading: false,
    loadNotesList: vi.fn(),
    saveNotesList: vi.fn(),
    deleteNoteAction: vi.fn(),
  }),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange, placeholder, label }) => (
    <div data-testid={`preview-toggle-${id}`}>
      <label>{label}</label>
      <textarea
        data-testid={`note-field-${id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
}));

describe('Notes', () => {
  const defaultProps = {
    campaignName: 'test-campaign',
    characters: [{ name: 'Aragorn', level: 5 }],
    isLocalhost: true,
    onBack: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  it('should render header with back button and title', () => {
    render(<Notes {...defaultProps} />);
    expect(screen.getByText(/Back/)).toBeInTheDocument();
    expect(screen.getByText(/Notes/)).toBeInTheDocument();
  });

  it('should call onBack when back button clicked', () => {
    render(<Notes {...defaultProps} />);
    fireEvent.click(screen.getByText(/Back/));
    expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
  });

  it('should render New Note button', () => {
    render(<Notes {...defaultProps} />);
    const buttons = screen.getAllByText(/New Note/);
    expect(buttons[0].tagName).toBe('BUTTON');
  });

  it('should open modal when New Note clicked', () => {
    render(<Notes {...defaultProps} />);
    const buttons = screen.getAllByText(/New Note/);
    fireEvent.click(buttons[0]);
    expect(screen.getByRole('heading', { name: 'New Note' })).toBeInTheDocument();
  });

  it('should show empty state when no notes', () => {
    render(<Notes {...defaultProps} />);
    expect(screen.getByText(/No notes yet/)).toBeInTheDocument();
  });

  it('should render search input', () => {
    render(<Notes {...defaultProps} />);
    expect(screen.getByPlaceholderText(/Search notes/)).toBeInTheDocument();
  });

  it('should show clear search button when search has text', () => {
    render(<Notes {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Search notes/);
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('should clear search when clear button clicked', () => {
    render(<Notes {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText(/Search notes/);
    fireEvent.change(searchInput, { target: { value: 'test' } });
    fireEvent.click(screen.getByLabelText('Clear search'));
    expect(searchInput.value).toBe('');
  });

  it('should close modal when Cancel clicked', () => {
    render(<Notes {...defaultProps} />);
    const buttons = screen.getAllByText(/New Note/);
    fireEvent.click(buttons[0]);
    expect(screen.getByRole('heading', { name: 'New Note' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByRole('heading', { name: 'New Note' })).not.toBeInTheDocument();
  });

  it('should close modal when X button clicked', () => {
    render(<Notes {...defaultProps} />);
    const buttons = screen.getAllByText(/New Note/);
    fireEvent.click(buttons[0]);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(screen.queryByRole('heading', { name: 'New Note' })).not.toBeInTheDocument();
  });

  it('should close modal when overlay clicked', () => {
    render(<Notes {...defaultProps} />);
    const buttons = screen.getAllByText(/New Note/);
    fireEvent.click(buttons[0]);
    const overlay = document.querySelector('.ct-modal-overlay');
    fireEvent.click(overlay);
    expect(screen.queryByRole('heading', { name: 'New Note' })).not.toBeInTheDocument();
  });

  it('should not close modal when modal content clicked', () => {
    render(<Notes {...defaultProps} />);
    const buttons = screen.getAllByText(/New Note/);
    fireEvent.click(buttons[0]);
    const modal = document.querySelector('.ct-modal');
    fireEvent.click(modal);
    expect(screen.getByRole('heading', { name: 'New Note' })).toBeInTheDocument();
  });

  it('should disable save button when description is empty', () => {
    render(<Notes {...defaultProps} />);
    const buttons = screen.getAllByText(/New Note/);
    fireEvent.click(buttons[0]);
    const saveButton = screen.getByText('Save').closest('button');
    expect(saveButton.disabled).toBe(true);
  });

  it('should show delete button when editing existing note', async () => {
    const notesManagement = await import('../../hooks/useNotesManagement.js');

    vi.mocked(notesManagement).default = () => ({
      notes: [{
        id: 'note-1',
        description: 'Test note',
        isPrivate: false,
        dateCreated: '2024-01-01T00:00:00.000Z',
        dateModified: '2024-01-02T00:00:00.000Z',
        partyLevel: 5,
        partyLocation: 'Town',
      }],
      loading: false,
      loadNotesList: vi.fn(),
      saveNotesList: vi.fn(),
      deleteNoteAction: vi.fn(),
    });

    render(<Notes {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Town')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Town').closest('.ct-list-item'));

    expect(screen.getByText('Edit Note')).toBeInTheDocument();
    expect(screen.getByText(/Delete/)).toBeInTheDocument();
  });

  it('should show party level auto-calculated from characters', () => {
    render(<Notes {...defaultProps} />);
    const buttons = screen.getAllByText(/New Note/);
    fireEvent.click(buttons[0]);
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should show party level 1 when no characters', () => {
    render(<Notes {...defaultProps} characters={[]} />);
    const buttons = screen.getAllByText(/New Note/);
    fireEvent.click(buttons[0]);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should show private note checkbox on localhost', () => {
    render(<Notes {...defaultProps} isLocalhost={true} />);
    const buttons = screen.getAllByText(/New Note/);
    fireEvent.click(buttons[0]);
    expect(screen.getByText(/Private Note/)).toBeInTheDocument();
  });

  it('should not show private note checkbox on non-localhost', () => {
    render(<Notes {...defaultProps} isLocalhost={false} />);
    const buttons = screen.getAllByText(/New Note/);
    fireEvent.click(buttons[0]);
    expect(screen.queryByText(/Private Note/)).not.toBeInTheDocument();
  });

  it('should show location in note list item', async () => {
    const notesManagement = await import('../../hooks/useNotesManagement.js');

    vi.mocked(notesManagement).default = () => ({
      notes: [{
        id: 'note-1',
        description: 'A note about the cave',
        isPrivate: false,
        dateCreated: '2024-01-01T00:00:00.000Z',
        dateModified: '2024-01-02T00:00:00.000Z',
        partyLevel: 5,
        partyLocation: 'Skull Creek Cave',
      }],
      loading: false,
      loadNotesList: vi.fn(),
      saveNotesList: vi.fn(),
      deleteNoteAction: vi.fn(),
    });

    render(<Notes {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Skull Creek Cave')).toBeInTheDocument();
    });
  });

  it('should show "No location" when partyLocation is empty', async () => {
    const notesManagement = await import('../../hooks/useNotesManagement.js');

    vi.mocked(notesManagement).default = () => ({
      notes: [{
        id: 'note-1',
        description: 'A note',
        isPrivate: false,
        dateCreated: '2024-01-01T00:00:00.000Z',
        dateModified: '2024-01-02T00:00:00.000Z',
        partyLevel: 5,
        partyLocation: '',
      }],
      loading: false,
      loadNotesList: vi.fn(),
      saveNotesList: vi.fn(),
      deleteNoteAction: vi.fn(),
    });

    render(<Notes {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('No location')).toBeInTheDocument();
    });
  });

  it('should show loading state', async () => {
    const notesManagement = await import('../../hooks/useNotesManagement.js');

    vi.mocked(notesManagement).default = () => ({
      notes: [],
      loading: true,
      loadNotesList: vi.fn(),
      saveNotesList: vi.fn(),
      deleteNoteAction: vi.fn(),
    });

    render(<Notes {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/Loading notes/)).toBeInTheDocument();
    });
  });

  it('should show search no results message', async () => {
    const notesManagement = await import('../../hooks/useNotesManagement.js');

    vi.mocked(notesManagement).default = () => ({
      notes: [{
        id: 'note-1',
        description: 'A note about caves',
        isPrivate: false,
        dateCreated: '2024-01-01T00:00:00.000Z',
        dateModified: '2024-01-02T00:00:00.000Z',
        partyLevel: 5,
        partyLocation: 'Cave',
      }],
      loading: false,
      loadNotesList: vi.fn(),
      saveNotesList: vi.fn(),
      deleteNoteAction: vi.fn(),
    });

    render(<Notes {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText('Cave')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/Search notes/);
    fireEvent.change(searchInput, { target: { value: 'dragons' } });

    expect(screen.getByText(/No notes found matching/)).toBeInTheDocument();
  });
});
