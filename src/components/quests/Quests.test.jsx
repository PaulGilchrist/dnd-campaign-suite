// @maintained-by-ai: 2026-10-14
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

// Map form fields to their queries in the quest modal.
const field = {
  name: () => screen.getByRole('textbox', { name: /Name/ }),
  status: () => screen.getByLabelText('Status'),
  description: () => screen.getByTestId('field-quest-description'),
  rewards: () => screen.getByTestId('field-quest-rewards'),
  notes: () => screen.getByTestId('field-quest-notes'),
};

function fillQuestForm(values) {
  for (const [key, value] of Object.entries(values)) {
    fireEvent.change(field[key](), { target: { value } });
  }
}

function expectFormValues(values) {
  for (const [key, value] of Object.entries(values)) {
    expect(field[key]()).toHaveValue(value);
  }
}

const openNewModal = () => fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
const openEditModal = (name) => fireEvent.click(screen.getByRole('button', { name: `Edit quest: ${name}` }));

const DEFAULT_FORM = { name: '', status: 'active', description: '', rewards: '', notes: '' };

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

  it('renders nothing when isLocalhost is false', () => {
    const { container } = renderWithQuests([], {}, { isLocalhost: false });
    expect(container.querySelector('.ct-container')).toBeNull();
  });

  describe('header', () => {
    it('renders back button, title, New Quest button, and search input', () => {
      renderWithQuests([]);
      expect(screen.getByRole('heading', { name: /Quests/ })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Search Quests/ })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /Back/ }));
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    });

    it('renders the search placeholder with a real ellipsis (not a literal \\u2026 escape)', () => {
      renderWithQuests([]);
      expect(screen.getByRole('textbox', { name: /Search Quests/ })).toHaveAttribute('placeholder', 'Search Quests…');
    });
  });

  describe('loading and empty states', () => {
    it('shows a loading state while quests are loading', () => {
      renderWithQuests([], { loading: true });
      expect(screen.getByText(/Loading quests/)).toBeInTheDocument();
    });

    it('renders a real ellipsis (not a literal \\u2026 escape) in the loading text', () => {
      renderWithQuests([], { loading: true });
      const loading = screen.getByText(/Loading quests/);
      expect(loading.textContent).toContain('Loading quests…');
      expect(loading.textContent).not.toContain('\\u2026');
    });

    it('shows an empty state when there are no quests', () => {
      renderWithQuests([]);
      expect(screen.getByText(/No quests yet/)).toBeInTheDocument();
    });

    it('shows the no-results message with the query, but not for whitespace-only searches', () => {
      renderWithQuests([quest()]);

      fireEvent.change(screen.getByRole('textbox', { name: /Search Quests/ }), { target: { value: 'dragons' } });
      expect(screen.getByText(/No quests found matching/).textContent).toContain('dragons');

      fireEvent.change(screen.getByRole('textbox', { name: /Search Quests/ }), { target: { value: '   ' } });
      expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      expect(screen.queryByText(/No quests found matching/)).not.toBeInTheDocument();
    });
  });

  describe('new quest modal', () => {
    it('opens and closes via Cancel or Close (X), but not via overlay click', () => {
      renderWithQuests([]);

      openNewModal();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();

      openNewModal();
      fireEvent.click(screen.getByLabelText('Close'));
      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();

      openNewModal();
      fireEvent.click(document.querySelector('.ct-modal-overlay'));
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
    });

    it('allows changing all form fields', () => {
      renderWithQuests([]);
      openNewModal();

      const values = {
        name: 'Find the Lost Sword',
        status: 'completed',
        description: 'A dangerous quest',
        rewards: '100 gold',
        notes: 'Be careful',
      };
      fillQuestForm(values);
      expectFormValues(values);
    });

    it('disables the save button until the name is non-blank', () => {
      renderWithQuests([]);
      openNewModal();
      expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('disabled');

      fillQuestForm({ name: '   ' });
      expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('disabled');

      fillQuestForm({ name: 'Find the Lost Sword' });
      expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('disabled');
    });

    it('disables the Cancel and Save buttons while a save is in progress', () => {
      renderWithQuests([], { saveItems: vi.fn().mockImplementation(() => new Promise(() => {})) });

      openNewModal();
      fillQuestForm({ name: 'New Quest' });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByRole('button', { name: /Saving/ })).toHaveAttribute('disabled');
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute('disabled');
    });

    it('saves a new quest, closing the modal, and resets the form on reopen', async () => {
      const { mockSave } = renderWithQuests([quest({ id: 'quest-1', name: 'Existing Quest' })]);

      openNewModal();
      fillQuestForm({
        name: 'New Quest',
        status: 'completed',
        description: 'New desc',
        rewards: '50 gold',
        notes: 'New notes',
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(mockSave).toHaveBeenCalled());
      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();

      const savedQuests = mockSave.mock.calls[0][0];
      expect(savedQuests.find((q) => q.id === 'quest-1').name).toBe('Existing Quest');
      const newQuest = savedQuests.find((q) => q.name === 'New Quest');
      expect(newQuest.id).toBeDefined();
      expect(newQuest).toMatchObject({
        status: 'completed',
        description: 'New desc',
        rewards: '50 gold',
        notes: 'New notes',
      });

      openNewModal();
      expectFormValues(DEFAULT_FORM);
    });

    it('logs the error, keeps the modal open, and re-enables save when saving fails', async () => {
      const errorSpy = vi.spyOn(console, 'error');
      renderWithQuests([], { saveItems: vi.fn().mockRejectedValue(new Error('Save failed')) });

      openNewModal();
      fillQuestForm({ name: 'New Quest' });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Failed to save quest:', expect.any(Error)));
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Save' })).not.toHaveAttribute('disabled');
    });
  });

  describe('duplicate-name guard', () => {
    it('shows an inline error and does not save on case-insensitive collision, clearing it on reopen', async () => {
      const { mockSave } = renderWithQuests([quest({ name: 'The Lost Artifact' })]);

      openNewModal();
      fillQuestForm({ name: 'the lost artifact' });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText('A quest with that name already exists')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 0));
      expect(mockSave).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      openNewModal();
      expect(screen.queryByText('A quest with that name already exists')).not.toBeInTheDocument();
    });

    it('shows an inline error when renaming onto another existing quest name', async () => {
      const { mockSave } = renderWithQuests([
        quest({ id: 'quest-1', name: 'The Lost Artifact' }),
        quest({ id: 'quest-2', name: 'QA Parity Quest' }),
      ]);

      openEditModal('QA Parity Quest');
      fillQuestForm({ name: 'THE LOST ARTIFACT' });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText('A quest with that name already exists')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 0));
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('saves normally when editing without renaming (self-match excluded)', async () => {
      const { mockSave } = renderWithQuests([quest({ name: 'The Lost Artifact' })]);

      openEditModal('The Lost Artifact');
      fillQuestForm({ description: 'updated' });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(mockSave).toHaveBeenCalled());
      expect(screen.queryByText('A quest with that name already exists')).not.toBeInTheDocument();
      expect(mockSave.mock.calls[0][0][0].description).toBe('updated');
    });
  });

  describe('quest list', () => {
    it('renders each quest with its name and status, truncating long descriptions', () => {
      renderWithQuests([
        quest({ id: 'quest-1', name: 'Find the Lost Sword', status: 'active' }),
        quest({ id: 'quest-2', name: 'Defeat the Dragon', status: 'completed' }),
        quest({ id: 'quest-3', name: 'Rescue the Princess', status: 'failed', description: 'A'.repeat(150) }),
      ]);

      expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      expect(screen.getByText('Defeat the Dragon')).toBeInTheDocument();
      expect(screen.getByText('Rescue the Princess')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('failed')).toBeInTheDocument();
      expect(screen.getByText('A'.repeat(100) + '...')).toBeInTheDocument();
    });

    it('opens the edit modal when a quest item is clicked or activated via keyboard', () => {
      renderWithQuests([quest({ name: 'Clickable Quest' })]);

      openEditModal('Clickable Quest');
      expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      const listItem = screen.getByRole('button', { name: 'Edit quest: Clickable Quest' });

      fireEvent.keyDown(listItem, { key: 'Enter' });
      expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      fireEvent.keyDown(listItem, { key: ' ' });
      expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();
    });
  });

  describe('edit quest modal', () => {
    it('is pre-populated with the quest data and shows a delete button', () => {
      renderWithQuests([
        quest({
          name: 'Find the Lost Sword',
          status: 'completed',
          description: 'An old quest',
          rewards: '100 gold',
          notes: 'Almost done',
        }),
      ]);

      openEditModal('Find the Lost Sword');
      expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
      expectFormValues({
        name: 'Find the Lost Sword',
        status: 'completed',
        description: 'An old quest',
        rewards: '100 gold',
        notes: 'Almost done',
      });
    });

    it('renders editor textarea placeholders with real ellipses (not literal \\u2026 escapes)', () => {
      renderWithQuests([quest({ name: 'The Lost Artifact' })]);

      openEditModal('The Lost Artifact');
      expect(field.description()).toHaveAttribute('placeholder', 'Describe the quest…');
      expect(field.rewards()).toHaveAttribute('placeholder', 'Describe rewards…');
      expect(field.notes()).toHaveAttribute('placeholder', 'Additional notes…');
      expect(document.body.textContent).not.toContain('\\u2026');
    });

    it('resets the form to defaults when opening the new quest modal after cancelling an edit', () => {
      renderWithQuests([quest({ name: 'Existing Quest', status: 'completed' })]);

      openEditModal('Existing Quest');
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      openNewModal();
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
      expectFormValues(DEFAULT_FORM);
    });

    it('disables the delete button while a delete is in progress and closes the modal after', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      let deleteResolve;
      renderWithQuests([quest({ name: 'Delete Test Quest' })], {
        deleteItem: vi.fn().mockImplementation(() => new Promise((resolve) => { deleteResolve = resolve; })),
      });

      openEditModal('Delete Test Quest');
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(screen.getByRole('button', { name: /Deleting/ })).toHaveAttribute('disabled'));

      await act(async () => deleteResolve());
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
      expect(document.querySelector('.ct-modal-overlay')).toBeNull();
    });

    it('saves edited quest data while leaving other quests untouched', async () => {
      const { mockSave } = renderWithQuests([
        quest({ id: 'quest-1', name: 'Original Name', description: 'Original desc', rewards: '10 gold' }),
        quest({ id: 'quest-2', name: 'Untouched Quest' }),
      ]);

      openEditModal('Original Name');
      fillQuestForm({
        name: 'Updated Name',
        status: 'completed',
        description: 'Updated desc',
        rewards: '100 gold',
        notes: 'Updated notes',
      });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(mockSave).toHaveBeenCalled());
      const savedQuests = mockSave.mock.calls[0][0];
      expect(savedQuests.find((q) => q.id === 'quest-1')).toMatchObject({
        name: 'Updated Name',
        status: 'completed',
        description: 'Updated desc',
        rewards: '100 gold',
        notes: 'Updated notes',
      });
      expect(savedQuests.find((q) => q.id === 'quest-2').name).toBe('Untouched Quest');
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
      expect(screen.getByText('Defeat the Dragon')).toBeInTheDocument();
      expect(screen.queryByText('Find the Lost Sword')).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'find the lost sword' } });
      expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      expect(screen.queryByText('Defeat the Dragon')).not.toBeInTheDocument();
    });

    it('shows a clear-search button only with a query and restores all quests when clicked', () => {
      renderWithQuests([
        quest({ id: 'quest-1', name: 'Quest One' }),
        quest({ id: 'quest-2', name: 'Quest Two' }),
      ]);

      const searchInput = screen.getByRole('textbox', { name: /Search Quests/ });
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: 'one' } });
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
      expect(screen.getByText('Quest One')).toBeInTheDocument();
      expect(screen.queryByText('Quest Two')).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Clear search'));
      expect(searchInput.value).toBe('');
      expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
      expect(screen.getByText('Quest One')).toBeInTheDocument();
      expect(screen.getByText('Quest Two')).toBeInTheDocument();
    });
  });

  describe('delete quest', () => {
    it('deletes a quest when the confirmation is accepted', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const { mockDelete } = renderWithQuests([quest()]);

      openEditModal('Find the Lost Sword');
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(window.confirm).toHaveBeenCalledWith('Delete quest "Find the Lost Sword"?');
      expect(mockDelete).toHaveBeenCalledWith('quest-1');
    });

    it('does not delete when the confirmation is cancelled', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const { mockDelete } = renderWithQuests([quest()]);

      openEditModal('Find the Lost Sword');
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

      openEditModal('Error Delete Quest');
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('Failed to delete quest:', expect.any(Error)));
      expect(screen.getByRole('button', { name: 'Delete' })).not.toHaveAttribute('disabled');
    });
  });
});
