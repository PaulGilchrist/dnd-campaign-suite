// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Quests from './Quests.jsx';

const mockUseQuestsManagement = vi.fn();

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: (campaignName, config) => mockUseQuestsManagement(campaignName, config),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange, placeholder, label }) => (
    <div data-testid={`preview-toggle-${id}`}>
      <label>{label}</label>
      <textarea
        data-testid={`field-${id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
}));

const defaultProps = {
  campaignName: 'test-campaign',
  isLocalhost: true,
  onBack: vi.fn(),
};

const quest = (overrides = {}) => ({
  id: 'quest-1',
  name: 'Find the Lost Sword',
  status: 'active',
  description: '',
  rewards: '',
  notes: '',
  ...overrides,
});

function renderWithQuests(quests = [], managementOverrides = {}, componentProps = {}) {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockResolvedValue(undefined);
  mockUseQuestsManagement.mockReturnValue({
    items: quests,
    loading: false,
    loadItems: vi.fn(),
    saveItems: mockSave,
    deleteItem: mockDelete,
    ...managementOverrides,
  });
  return {
    ...render(<Quests {...defaultProps} {...componentProps} />),
    mockSave,
    mockDelete,
  };
}

describe('Quests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('visibility', () => {
    it('renders nothing when isLocalhost is false', () => {
      const { container } = renderWithQuests([], {}, { isLocalhost: false });
      expect(container.querySelector('.ct-container')).toBeNull();
    });
  });

  describe('rendering', () => {
    it('renders the header with back button, title, and New Quest button', () => {
      renderWithQuests([]);
      expect(screen.getByRole('button', { name: /Back/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Quests/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New Quest/ })).toBeInTheDocument();
    });

    it('renders a search input', () => {
      renderWithQuests([]);
      expect(screen.getByRole('textbox', { name: /Search Quests/ })).toBeInTheDocument();
    });
  });

  describe('loading and empty states', () => {
    it('shows a loading state while quests are loading', () => {
      renderWithQuests([], { loading: true });
      expect(screen.getByText(/Loading quests/)).toBeInTheDocument();
    });

    it('shows an empty state when there are no quests', () => {
      renderWithQuests([]);
      expect(screen.getByText(/No quests yet/)).toBeInTheDocument();
    });

    it('shows the no-results message with the query when search matches nothing', () => {
      renderWithQuests([quest({ name: 'Find the Lost Sword' })]);

      const searchInput = screen.getByRole('textbox', { name: /Search Quests/ });
      fireEvent.change(searchInput, { target: { value: 'dragons' } });

      const emptyState = screen.getByText(/No quests found matching/);
      expect(emptyState.textContent).toContain('dragons');
    });

    it('does not show a no-results message for whitespace-only search', () => {
      renderWithQuests([quest({ name: 'Find the Lost Sword' })]);

      const searchInput = screen.getByRole('textbox', { name: /Search Quests/ });
      fireEvent.change(searchInput, { target: { value: '   ' } });

      expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      expect(screen.queryByText(/No quests found matching/)).not.toBeInTheDocument();
    });
  });

  describe('back navigation', () => {
    it('calls onBack when the back button is clicked', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /Back/ }));
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('new quest modal', () => {
    it('opens the modal when New Quest is clicked', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
    });

    it('closes the modal via Cancel or X (Close), but not via overlay click', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Close'));
      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();

      const overlay = document.querySelector('.ct-modal-overlay');
      fireEvent.click(overlay);
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
    });

    it('allows changing all form fields', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));

      const nameInput = screen.getByRole('textbox', { name: /Name/ });
      fireEvent.change(nameInput, { target: { value: 'Find the Lost Sword' } });
      expect(nameInput).toHaveValue('Find the Lost Sword');

      const statusSelect = screen.getByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'completed' } });
      expect(statusSelect).toHaveValue('completed');

      const descField = screen.getByTestId('field-quest-description');
      fireEvent.change(descField, { target: { value: 'A dangerous quest' } });
      expect(descField).toHaveValue('A dangerous quest');

      const rewardsField = screen.getByTestId('field-quest-rewards');
      fireEvent.change(rewardsField, { target: { value: '100 gold' } });
      expect(rewardsField).toHaveValue('100 gold');

      const notesField = screen.getByTestId('field-quest-notes');
      fireEvent.change(notesField, { target: { value: 'Be careful' } });
      expect(notesField).toHaveValue('Be careful');
    });

    it('disables the save button when the name is empty or whitespace-only', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));

      expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('disabled');

      const nameInput = screen.getByRole('textbox', { name: /Name/ });
      fireEvent.change(nameInput, { target: { value: '   ' } });
      expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('disabled');

      fireEvent.change(nameInput, { target: { value: 'Find the Lost Sword' } });
      expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('disabled');
    });

    it('disables the Cancel and Save buttons while a save is in progress', () => {
      renderWithQuests([], {
        saveItems: vi.fn().mockImplementation(() => new Promise(() => {})),
      });

      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'New Quest' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByRole('button', { name: /Saving/ })).toHaveAttribute('disabled');
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('disabled');
    });

    it('closes the modal and resets the form after saving a new quest', async () => {
      const { mockSave } = renderWithQuests([]);

      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'New Quest' } });
      fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
      fireEvent.change(screen.getByTestId('field-quest-description'), { target: { value: 'A quest' } });
      fireEvent.change(screen.getByTestId('field-quest-rewards'), { target: { value: '50 gold' } });
      fireEvent.change(screen.getByTestId('field-quest-notes'), { target: { value: 'Notes' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalled();
      });

      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();

      // Re-open to verify form reset to defaults
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('');
      expect(screen.getByLabelText('Status')).toHaveValue('active');
      expect(screen.getByTestId('field-quest-description')).toHaveValue('');
      expect(screen.getByTestId('field-quest-rewards')).toHaveValue('');
      expect(screen.getByTestId('field-quest-notes')).toHaveValue('');
    });

    it('passes the new quest data to saveItems while preserving existing quests', async () => {
      const { mockSave } = renderWithQuests([
        quest({ id: 'quest-1', name: 'Existing Quest' }),
      ]);

      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'New Quest' } });
      fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
      fireEvent.change(screen.getByTestId('field-quest-description'), { target: { value: 'New desc' } });
      fireEvent.change(screen.getByTestId('field-quest-rewards'), { target: { value: '50 gold' } });
      fireEvent.change(screen.getByTestId('field-quest-notes'), { target: { value: 'New notes' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalled();
      });

      const savedQuests = mockSave.mock.calls[0][0];
      const existingQuest = savedQuests.find((q) => q.id === 'quest-1');
      const newQuest = savedQuests.find((q) => q.name === 'New Quest');
      expect(existingQuest).toBeDefined();
      expect(existingQuest.name).toBe('Existing Quest');
      expect(newQuest).toBeDefined();
      expect(newQuest.status).toBe('completed');
      expect(newQuest.description).toBe('New desc');
      expect(newQuest.rewards).toBe('50 gold');
      expect(newQuest.notes).toBe('New notes');
      expect(newQuest.id).toBeDefined();
    });
  });

  describe('quest list rendering', () => {
    it('renders each quest with its name and status', () => {
      renderWithQuests([
        quest({ id: 'quest-1', name: 'Find the Lost Sword', status: 'active' }),
        quest({ id: 'quest-2', name: 'Defeat the Dragon', status: 'completed' }),
        quest({ id: 'quest-3', name: 'Rescue the Princess', status: 'failed' }),
      ]);

      expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      expect(screen.getByText('Defeat the Dragon')).toBeInTheDocument();
      expect(screen.getByText('Rescue the Princess')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('failed')).toBeInTheDocument();
    });

    it('truncates long descriptions in the quest list', () => {
      renderWithQuests([quest({ name: 'Long Quest', description: 'A'.repeat(150) })]);

      expect(screen.getByText('A'.repeat(100) + '...')).toBeInTheDocument();
    });

    it('opens the edit modal when a quest item is clicked', () => {
      renderWithQuests([quest({ name: 'Clickable Quest' })]);

      fireEvent.click(screen.getByRole('button', { name: 'Edit quest: Clickable Quest' }));
      expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();
    });

    it('opens the edit modal when a quest item is activated via keyboard', () => {
      renderWithQuests([quest({ name: 'Keyboard Quest' })]);

      const listItem = screen.getByRole('button', { name: 'Edit quest: Keyboard Quest' });

      fireEvent.keyDown(listItem, { key: 'Enter' });
      expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      fireEvent.keyDown(listItem, { key: ' ' });
      expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();
    });
  });

  describe('edit quest modal', () => {
    it('opens the edit modal pre-populated with the quest data', () => {
      renderWithQuests([
        quest({
          name: 'Find the Lost Sword',
          status: 'completed',
          description: 'An old quest',
          rewards: '100 gold',
          notes: 'Almost done',
        }),
      ]);

      fireEvent.click(screen.getByRole('button', { name: 'Edit quest: Find the Lost Sword' }));
      expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();

      expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('Find the Lost Sword');
      expect(screen.getByLabelText('Status')).toHaveValue('completed');
      expect(screen.getByTestId('field-quest-description')).toHaveValue('An old quest');
      expect(screen.getByTestId('field-quest-rewards')).toHaveValue('100 gold');
      expect(screen.getByTestId('field-quest-notes')).toHaveValue('Almost done');
    });

    it('shows a delete button when editing a quest', () => {
      renderWithQuests([quest({ name: 'Find the Lost Sword' })]);

      fireEvent.click(screen.getByRole('button', { name: 'Edit quest: Find the Lost Sword' }));
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('hides the delete button when creating a new quest', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    });

    it('disables the delete button while a delete is in progress and re-enables it after', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      let deleteResolve;
      renderWithQuests([quest({ name: 'Delete Test Quest' })], {
        deleteItem: vi.fn().mockImplementation(() => new Promise((resolve) => { deleteResolve = resolve; })),
      });

      fireEvent.click(screen.getByRole('button', { name: 'Edit quest: Delete Test Quest' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Deleting/ })).toHaveAttribute('disabled');
      });

      await act(async () => deleteResolve());

      expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveAttribute('disabled');
    });

    it('saves edited quest data while leaving other quests untouched', async () => {
      const { mockSave } = renderWithQuests([
        quest({ id: 'quest-1', name: 'Original Name', description: 'Original desc', rewards: '10 gold' }),
        quest({ id: 'quest-2', name: 'Untouched Quest' }),
      ]);

      fireEvent.click(screen.getByRole('button', { name: 'Edit quest: Original Name' }));
      fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'Updated Name' } });
      fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'completed' } });
      fireEvent.change(screen.getByTestId('field-quest-description'), { target: { value: 'Updated desc' } });
      fireEvent.change(screen.getByTestId('field-quest-rewards'), { target: { value: '100 gold' } });
      fireEvent.change(screen.getByTestId('field-quest-notes'), { target: { value: 'Updated notes' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalled();
      });

      const savedQuests = mockSave.mock.calls[0][0];
      const updatedQuest = savedQuests.find((q) => q.id === 'quest-1');
      const untouchedQuest = savedQuests.find((q) => q.id === 'quest-2');
      expect(updatedQuest).toBeDefined();
      expect(updatedQuest.name).toBe('Updated Name');
      expect(updatedQuest.status).toBe('completed');
      expect(updatedQuest.description).toBe('Updated desc');
      expect(updatedQuest.rewards).toBe('100 gold');
      expect(updatedQuest.notes).toBe('Updated notes');
      expect(untouchedQuest.name).toBe('Untouched Quest');
    });
  });

  describe('search', () => {
    it('filters quests by name (case-insensitive) and does not search descriptions', () => {
      renderWithQuests([
        quest({ id: 'quest-1', name: 'Find the Lost Sword', description: 'Search for the sword' }),
        quest({ id: 'quest-2', name: 'Defeat the Dragon', description: 'Slay the dragon' }),
      ]);

      const searchInput = screen.getByRole('textbox', { name: /Search Quests/ });

      fireEvent.change(searchInput, { target: { value: 'dragon' } });
      expect(screen.queryByText('Defeat the Dragon')).toBeInTheDocument();
      expect(screen.queryByText('Find the Lost Sword')).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'find the lost sword' } });
      expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      expect(screen.queryByText('Defeat the Dragon')).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'dungeon' } });
      expect(screen.queryByText('Find the Lost Sword')).not.toBeInTheDocument();
    });

    it('clears the search query and restores all quests', () => {
      renderWithQuests([
        quest({ id: 'quest-1', name: 'Quest One' }),
        quest({ id: 'quest-2', name: 'Quest Two' }),
      ]);

      const searchInput = screen.getByRole('textbox', { name: /Search Quests/ });
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'one' } });
      expect(screen.getByText('Quest One')).toBeInTheDocument();
      expect(screen.queryByText('Quest Two')).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Clear search'));
      expect(searchInput.value).toBe('');
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
      expect(screen.getByText('Quest One')).toBeInTheDocument();
      expect(screen.getByText('Quest Two')).toBeInTheDocument();
    });

    it('shows a clear search button when there is a search query', () => {
      renderWithQuests([quest({ name: 'Test Quest' })]);

      const searchInput = screen.getByRole('textbox', { name: /Search Quests/ });
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'test' } });
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    });
  });

  describe('delete quest', () => {
    it('deletes a quest when the confirmation is accepted', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { mockDelete } = renderWithQuests([quest({ name: 'Find the Lost Sword' })]);

      fireEvent.click(screen.getByRole('button', { name: 'Edit quest: Find the Lost Sword' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(window.confirm).toHaveBeenCalledWith('Delete quest "Find the Lost Sword"?');
      expect(mockDelete).toHaveBeenCalledWith('quest-1');
    });

    it('does not delete when the confirmation is cancelled', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const { mockDelete } = renderWithQuests([quest({ name: 'Find the Lost Sword' })]);

      fireEvent.click(screen.getByRole('button', { name: 'Edit quest: Find the Lost Sword' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(window.confirm).toHaveBeenCalledWith('Delete quest "Find the Lost Sword"?');
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('logs the error and re-enables the delete button when deletion fails', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const errorSpy = vi.spyOn(console, 'error');
      renderWithQuests([quest({ name: 'Error Delete Quest' })], {
        deleteItem: vi.fn().mockRejectedValue(new Error('Delete failed')),
      });

      fireEvent.click(screen.getByRole('button', { name: 'Edit quest: Error Delete Quest' }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith('Failed to delete quest:', expect.any(Error));
      });

      expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveAttribute('disabled');
    });
  });

  describe('save error handling', () => {
    it('logs the error, keeps the modal open, and re-enables the save button when saving fails', async () => {
      const errorSpy = vi.spyOn(console, 'error');
      renderWithQuests([], {
        saveItems: vi.fn().mockRejectedValue(new Error('Save failed')),
      });

      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), { target: { value: 'New Quest' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith('Failed to save quest:', expect.any(Error));
      });

      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('disabled');
    });
  });

  describe('form reset behavior', () => {
    it('resets the form to defaults when opening the new quest modal after an edit', () => {
      renderWithQuests([
        quest({ name: 'Existing Quest', status: 'completed', description: 'Existing desc', rewards: '50 gold', notes: 'Existing notes' }),
      ]);

      fireEvent.click(screen.getByRole('button', { name: 'Edit quest: Existing Quest' }));
      expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();

      expect(screen.getByRole('textbox', { name: /Name/ })).toHaveValue('');
      expect(screen.getByLabelText('Status')).toHaveValue('active');
      expect(screen.getByTestId('field-quest-description')).toHaveValue('');
      expect(screen.getByTestId('field-quest-rewards')).toHaveValue('');
      expect(screen.getByTestId('field-quest-notes')).toHaveValue('');
    });
  });
});
