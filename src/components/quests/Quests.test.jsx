// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Quests from './Quests.jsx';

const mockUseQuestsManagement = vi.fn();

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: (...args) => mockUseQuestsManagement(...args),
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

function renderWithQuests(items, loading = false) {
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockResolvedValue(undefined);
  mockUseQuestsManagement.mockReturnValue({
    items,
    loading,
    loadItems: vi.fn(),
    saveItems: mockSave,
    deleteItem: mockDelete,
  });
  return {
    ...render(<Quests {...defaultProps} />),
    mockSave,
    mockDelete,
  };
}

describe('Quests', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering and visibility', () => {
    it('returns null when isLocalhost is false', () => {
      mockUseQuestsManagement.mockReturnValue({
        items: [],
        loading: false,
        loadItems: vi.fn(),
        saveItems: vi.fn(),
        deleteItem: vi.fn(),
      });
      const { container } = render(<Quests {...defaultProps} isLocalhost={false} />);
      expect(container.innerHTML).toBe('');
    });

    it('renders header with back button, title, and New Quest button when isLocalhost is true', () => {
      renderWithQuests([]);
      expect(screen.getByText(/Back/)).toBeInTheDocument();
      expect(screen.getByText(/Quests/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New Quest/ })).toBeInTheDocument();
    });

    it('renders search input', () => {
      renderWithQuests([]);
      expect(screen.getByPlaceholderText(/Search Quests/)).toBeInTheDocument();
    });

    it('renders status options with correct labels', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));

      expect(screen.getByRole('option', { name: 'Active' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Completed' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Failed' })).toBeInTheDocument();
    });
  });

  describe('loading and empty states', () => {
    it('shows loading state', () => {
      renderWithQuests([], true);
      expect(screen.getByText(/Loading quests/)).toBeInTheDocument();
    });

    it('shows empty state when no quests', () => {
      renderWithQuests([]);
      expect(screen.getByText(/No quests yet/)).toBeInTheDocument();
    });
  });

  describe('back navigation', () => {
    it('calls onBack when back button clicked', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByText(/Back/));
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('new quest modal', () => {
    it('opens modal when New Quest clicked', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
    });

    it('closes modal when Cancel clicked', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();
    });

    it('closes modal when X button clicked', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      fireEvent.click(screen.getByLabelText('Close'));
      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();
    });

    it('closes modal when overlay clicked but not when modal content clicked', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      const overlay = document.querySelector('.ct-modal-overlay');
      fireEvent.click(overlay);
      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();
    });

    it('has all form fields in modal (name, status, description, rewards, notes)', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));

      expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
      expect(screen.getByTestId('preview-toggle-quest-description')).toBeInTheDocument();
      expect(screen.getByTestId('preview-toggle-quest-rewards')).toBeInTheDocument();
      expect(screen.getByTestId('preview-toggle-quest-notes')).toBeInTheDocument();
    });

    it('allows changing form fields', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));

      const nameInput = screen.getByLabelText(/Name/);
      fireEvent.change(nameInput, { target: { value: 'Find the Lost Sword' } });
      expect(nameInput.value).toBe('Find the Lost Sword');

      const statusSelect = screen.getByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'completed' } });
      expect(statusSelect.value).toBe('completed');

      const descField = screen.getByTestId('field-quest-description');
      fireEvent.change(descField, { target: { value: 'A dangerous quest' } });
      expect(descField.value).toBe('A dangerous quest');

      const rewardsField = screen.getByTestId('field-quest-rewards');
      fireEvent.change(rewardsField, { target: { value: '100 gold' } });
      expect(rewardsField.value).toBe('100 gold');

      const notesField = screen.getByTestId('field-quest-notes');
      fireEvent.change(notesField, { target: { value: 'Be careful' } });
      expect(notesField.value).toBe('Be careful');
    });

    it('disables save button when name is empty or whitespace, enables when non-empty', () => {
      renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));

      let saveButton = screen.getByText('Save').closest('button');
      expect(saveButton).toHaveAttribute('disabled');

      const nameInput = screen.getByLabelText(/Name/);
      fireEvent.change(nameInput, { target: { value: '   ' } });
      saveButton = screen.getByText('Save').closest('button');
      expect(saveButton).toHaveAttribute('disabled');

      fireEvent.change(nameInput, { target: { value: 'Find the Lost Sword' } });
      saveButton = screen.getByText('Save').closest('button');
      expect(saveButton).not.toHaveAttribute('disabled');
    });

    it('closes modal and resets form after saving new quest', async () => {
      const { mockSave } = renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));

      const nameInput = screen.getByLabelText(/Name/);
      fireEvent.change(nameInput, { target: { value: 'New Quest' } });

      const saveButton = screen.getByText('Save').closest('button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalled();
      });

      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();
    });

    it('does not save when name is empty', async () => {
      const { mockSave } = renderWithQuests([]);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));

      const saveButton = screen.getByText('Save').closest('button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSave).not.toHaveBeenCalled();
      });
    });
  });

  describe('quest list rendering', () => {
    it('renders quest list when quests are provided', async () => {
      renderWithQuests([
        {
          id: 'quest-1',
          name: 'Find the Lost Sword',
          status: 'active',
          description: 'Search for the ancient sword in the ruins',
          rewards: '500 gold',
          notes: '',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      });
    });

    it('shows multiple quests in the list', async () => {
      renderWithQuests([
        { id: 'quest-1', name: 'Find the Lost Sword', status: 'active', description: '', rewards: '', notes: '' },
        { id: 'quest-2', name: 'Defeat the Dragon', status: 'completed', description: '', rewards: '', notes: '' },
        { id: 'quest-3', name: 'Rescue the Princess', status: 'failed', description: '', rewards: '', notes: '' },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
        expect(screen.getByText('Defeat the Dragon')).toBeInTheDocument();
        expect(screen.getByText('Rescue the Princess')).toBeInTheDocument();
      });
    });

    it('shows description preview in quest list', async () => {
      renderWithQuests([
        {
          id: 'quest-1',
          name: 'Find the Lost Sword',
          status: 'active',
          description: 'Search for the ancient sword in the ruins of the old castle',
          rewards: '',
          notes: '',
        },
      ]);

      await waitFor(() => {
        expect(
          screen.getByText('Search for the ancient sword in the ruins of the old castle')
        ).toBeInTheDocument();
      });
    });

    it('truncates long description in quest list', async () => {
      const longDescription = 'A'.repeat(150);

      renderWithQuests([
        {
          id: 'quest-1',
          name: 'Long Quest',
          status: 'active',
          description: longDescription,
          rewards: '',
          notes: '',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Long Quest')).toBeInTheDocument();
      });

      const truncated = 'A'.repeat(100) + '...';
      expect(screen.getByText(truncated)).toBeInTheDocument();
    });

    it('does not show description div when quest has no description', async () => {
      renderWithQuests([
        {
          id: 'quest-1',
          name: 'No Description Quest',
          status: 'active',
          description: '',
          rewards: '',
          notes: '',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('No Description Quest')).toBeInTheDocument();
      });

      const listItems = document.querySelectorAll('.ct-list-item');
      const questItem = listItems[0];
      const detailsDiv = questItem.querySelector('.ct-list-details');
      expect(detailsDiv).not.toBeInTheDocument();
    });

    it('renders quest list items with aria-label', async () => {
      renderWithQuests([
        {
          id: 'quest-1',
          name: 'Test Quest',
          status: 'active',
          description: '',
          rewards: '',
          notes: '',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Test Quest')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Edit quest: Test Quest')).toBeInTheDocument();
    });
  });

  describe('status badges', () => {
    it('renders status badges for each quest with correct text', async () => {
      renderWithQuests([
        {
          id: 'quest-1',
          name: 'Active Quest',
          status: 'active',
          description: '',
          rewards: '',
          notes: '',
        },
        {
          id: 'quest-2',
          name: 'Completed Quest',
          status: 'completed',
          description: '',
          rewards: '',
          notes: '',
        },
        {
          id: 'quest-3',
          name: 'Failed Quest',
          status: 'failed',
          description: '',
          rewards: '',
          notes: '',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Active Quest')).toBeInTheDocument();
        expect(screen.getByText('Completed Quest')).toBeInTheDocument();
        expect(screen.getByText('Failed Quest')).toBeInTheDocument();
      });

      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('failed')).toBeInTheDocument();
    });
  });

  describe('edit quest modal', () => {
    it('opens edit modal with Edit Quest heading when quest clicked', async () => {
      renderWithQuests([
        {
          id: 'quest-1',
          name: 'Find the Lost Sword',
          status: 'active',
          description: 'Search for the ancient sword',
          rewards: '500 gold',
          notes: '',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Find the Lost Sword'));
      expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();
    });

    it('shows delete button in edit modal', async () => {
      renderWithQuests([
        {
          id: 'quest-1',
          name: 'Find the Lost Sword',
          status: 'active',
          description: 'Search for the ancient sword',
          rewards: '500 gold',
          notes: '',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Find the Lost Sword'));
      expect(screen.getByText(/Delete/)).toBeInTheDocument();
    });

    it('populates form fields when editing a quest', async () => {
      renderWithQuests([
        {
          id: 'quest-1',
          name: 'Find the Lost Sword',
          status: 'completed',
          description: 'An old quest',
          rewards: '100 gold',
          notes: 'Almost done',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Find the Lost Sword'));

      const nameInput = screen.getByLabelText(/Name/);
      expect(nameInput.value).toBe('Find the Lost Sword');

      const statusSelect = screen.getByLabelText('Status');
      expect(statusSelect.value).toBe('completed');

      expect(screen.getByTestId('field-quest-description').value).toBe('An old quest');
      expect(screen.getByTestId('field-quest-rewards').value).toBe('100 gold');
      expect(screen.getByTestId('field-quest-notes').value).toBe('Almost done');
    });

    it('closes modal after saving edited quest', async () => {
      const { mockSave } = renderWithQuests([
        {
          id: 'quest-1',
          name: 'Find the Lost Sword',
          status: 'active',
          description: 'Search for the sword',
          rewards: '50 gold',
          notes: '',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Find the Lost Sword'));
      expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();

      const nameInput = screen.getByLabelText(/Name/);
      fireEvent.change(nameInput, { target: { value: 'Updated Quest' } });

      const saveButton = screen.getByText('Save').closest('button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalled();
      });

      expect(screen.queryByRole('heading', { name: 'Edit Quest' })).not.toBeInTheDocument();
    });

    it('saves edited quest via saveQuestsList with updated data', async () => {
      const { mockSave } = renderWithQuests([
        {
          id: 'quest-1',
          name: 'Original Name',
          status: 'active',
          description: 'Original desc',
          rewards: '10 gold',
          notes: '',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Original Name')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Original Name'));

      const nameInput = screen.getByDisplayValue('Original Name');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

      const statusSelect = screen.getByLabelText('Status');
      fireEvent.change(statusSelect, { target: { value: 'completed' } });

      const descField = screen.getByTestId('field-quest-description');
      fireEvent.change(descField, { target: { value: 'Updated desc' } });

      const rewardsField = screen.getByTestId('field-quest-rewards');
      fireEvent.change(rewardsField, { target: { value: '100 gold' } });

      const notesField = screen.getByTestId('field-quest-notes');
      fireEvent.change(notesField, { target: { value: 'Updated notes' } });

      const saveButton = screen.getByText('Save').closest('button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockSave).toHaveBeenCalled();
      });

      const savedQuests = mockSave.mock.calls[0][0];
      const updatedQuest = savedQuests.find(q => q.id === 'quest-1');
      expect(updatedQuest).toBeDefined();
      expect(updatedQuest.name).toBe('Updated Name');
      expect(updatedQuest.status).toBe('completed');
      expect(updatedQuest.description).toBe('Updated desc');
      expect(updatedQuest.rewards).toBe('100 gold');
      expect(updatedQuest.notes).toBe('Updated notes');
    });
  });

  describe('search', () => {
    it('filters quests based on search query', async () => {
      renderWithQuests([
        {
          id: 'quest-1',
          name: 'Find the Lost Sword',
          status: 'active',
          description: 'Search for the sword',
          rewards: '',
          notes: '',
        },
        {
          id: 'quest-2',
          name: 'Defeat the Dragon',
          status: 'active',
          description: 'Slay the dragon',
          rewards: '',
          notes: '',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search Quests/);
      fireEvent.change(searchInput, { target: { value: 'dragon' } });

      expect(screen.queryByText('Find the Lost Sword')).not.toBeInTheDocument();
      expect(screen.getByText('Defeat the Dragon')).toBeInTheDocument();
    });

    it('shows clear search button when search has text and clears on click', () => {
      renderWithQuests([
        {
          id: 'quest-1',
          name: 'Test Quest',
          status: 'active',
          description: '',
          rewards: '',
          notes: '',
        },
      ]);

      const searchInput = screen.getByPlaceholderText(/Search Quests/);
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'test' } });
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Clear search'));
      expect(searchInput.value).toBe('');
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
    });

    it('restores all quests after clearing search', async () => {
      renderWithQuests([
        {
          id: 'quest-1',
          name: 'Quest One',
          status: 'active',
          description: '',
          rewards: '',
          notes: '',
        },
        {
          id: 'quest-2',
          name: 'Quest Two',
          status: 'completed',
          description: '',
          rewards: '',
          notes: '',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Quest One')).toBeInTheDocument();
        expect(screen.getByText('Quest Two')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/Search Quests/);
      fireEvent.change(searchInput, { target: { value: 'one' } });
      expect(screen.getByText('Quest One')).toBeInTheDocument();
      expect(screen.queryByText('Quest Two')).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Clear search'));
      expect(screen.getByText('Quest One')).toBeInTheDocument();
      expect(screen.getByText('Quest Two')).toBeInTheDocument();
    });

    it('shows search no results message with the search query', async () => {
      renderWithQuests([
        {
          id: 'quest-1',
          name: 'Find the Lost Sword',
          status: 'active',
          description: '',
          rewards: '',
          notes: '',
        },
      ]);

      const searchInput = screen.getByPlaceholderText(/Search Quests/);
      fireEvent.change(searchInput, { target: { value: 'dragons' } });

      const emptyState = screen.getByText(/No quests found matching/);
      expect(emptyState.textContent).toContain('dragons');
    });
  });

  describe('delete quest', () => {
    it('calls deleteQuestAction when delete confirmed', async () => {
      const { mockDelete } = renderWithQuests([
        {
          id: 'quest-1',
          name: 'Find the Lost Sword',
          status: 'active',
          description: 'Search for the sword',
          rewards: '',
          notes: '',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Find the Lost Sword'));
      fireEvent.click(screen.getByText(/Delete/));

      expect(window.confirm).toHaveBeenCalledWith('Delete quest "Find the Lost Sword"?');
      expect(mockDelete).toHaveBeenCalledWith('quest-1');
    });

    it('does not call deleteQuestAction when confirm is cancelled', async () => {
      window.confirm.mockReturnValueOnce(false);

      const { mockDelete } = renderWithQuests([
        {
          id: 'quest-1',
          name: 'Find the Lost Sword',
          status: 'active',
          description: 'Search for the sword',
          rewards: '',
          notes: '',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Find the Lost Sword'));
      fireEvent.click(screen.getByText(/Delete/));

      expect(window.confirm).toHaveBeenCalledWith('Delete quest "Find the Lost Sword"?');
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('shows confirming delete text when delete is in progress', async () => {
      let deleteResolve;
      const { mockDelete } = renderWithQuests([
        {
          id: 'quest-1',
          name: 'Slow Delete Quest',
          status: 'active',
          description: '',
          rewards: '',
          notes: '',
        },
      ]);

      mockDelete.mockImplementation(() => new Promise((resolve) => { deleteResolve = resolve; }));

      await waitFor(() => {
        expect(screen.getByText('Slow Delete Quest')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Slow Delete Quest'));

      const deleteBtn = document.querySelector('.ct-btn-danger');
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(screen.getByText(/Deleting/)).toBeInTheDocument();
      });

      deleteResolve();
    });

    it('handles delete error gracefully', async () => {
      const { mockDelete } = renderWithQuests([
        {
          id: 'quest-1',
          name: 'Error Delete Quest',
          status: 'active',
          description: '',
          rewards: '',
          notes: '',
        },
      ]);

      mockDelete.mockRejectedValue(new Error('Delete failed'));

      await waitFor(() => {
        expect(screen.getByText('Error Delete Quest')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Error Delete Quest'));

      const deleteBtn = document.querySelector('.ct-btn-danger');
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith('Failed to delete quest:', expect.any(Error));
      });
    });
  });

  describe('save error handling', () => {
    it('handles save error gracefully', async () => {
      const { mockSave } = renderWithQuests([]);
      mockSave.mockRejectedValue(new Error('Save failed'));

      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));

      const nameInput = screen.getByLabelText(/Name/);
      fireEvent.change(nameInput, { target: { value: 'New Quest' } });

      const saveButton = screen.getByText('Save').closest('button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith('Failed to save quest:', expect.any(Error));
      });
    });

    it('does not close modal when save throws error', async () => {
      const { mockSave } = renderWithQuests([]);
      mockSave.mockRejectedValue(new Error('Save failed'));

      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));

      const nameInput = screen.getByLabelText(/Name/);
      fireEvent.change(nameInput, { target: { value: 'New Quest' } });

      const saveButton = screen.getByText('Save').closest('button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
      });
    });
  });

  describe('form reset behavior', () => {
    it('resets form to defaults when opening new quest modal after a previous edit', async () => {
      renderWithQuests([
        {
          id: 'quest-1',
          name: 'Existing Quest',
          status: 'completed',
          description: 'Existing desc',
          rewards: '50 gold',
          notes: 'Existing notes',
        },
      ]);

      await waitFor(() => {
        expect(screen.getByText('Existing Quest')).toBeInTheDocument();
      });

      // Edit the quest
      fireEvent.click(screen.getByText('Existing Quest'));
      expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();

      // Close the edit modal
      fireEvent.click(screen.getByText('Cancel'));

      // Open new quest modal
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();

      // Verify form is reset to defaults
      const nameInput = screen.getByLabelText(/Name/);
      expect(nameInput.value).toBe('');

      const statusSelect = screen.getByLabelText('Status');
      expect(statusSelect.value).toBe('active');

      expect(screen.getByTestId('field-quest-description').value).toBe('');
      expect(screen.getByTestId('field-quest-rewards').value).toBe('');
      expect(screen.getByTestId('field-quest-notes').value).toBe('');
    });
  });
});
