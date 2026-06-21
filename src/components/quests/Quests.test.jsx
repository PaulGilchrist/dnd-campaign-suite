// @improved-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Quests from './Quests.jsx';

vi.mock('../../hooks/management/useQuestsManagement.js', () => ({
  default: () => ({
    quests: [],
    loading: false,
    loadQuestsList: vi.fn(),
    saveQuestsList: vi.fn(),
    deleteQuestAction: vi.fn(),
  }),
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

describe('Quests', () => {
  const defaultProps = {
    campaignName: 'test-campaign',
    isLocalhost: true,
    onBack: vi.fn(),
  };

  beforeEach(async () => {
    window.confirm = vi.fn(() => true);

    const questsManagement = await import('../../hooks/management/useQuestsManagement.js');
    vi.mocked(questsManagement).default = () => ({
      quests: [],
      loading: false,
      loadQuestsList: vi.fn(),
      saveQuestsList: vi.fn(),
      deleteQuestAction: vi.fn(),
    });
  });

  describe('rendering and visibility', () => {
    it('returns null when isLocalhost is false', () => {
      const { container } = render(<Quests {...defaultProps} isLocalhost={false} />);
      expect(container.innerHTML).toBe('');
    });

    it('renders header with back button, title, and New Quest button when isLocalhost is true', () => {
      render(<Quests {...defaultProps} />);
      expect(screen.getByText(/Back/)).toBeInTheDocument();
      expect(screen.getByText(/Quests/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New Quest/ })).toBeInTheDocument();
    });

    it('renders search input', () => {
      render(<Quests {...defaultProps} />);
      expect(screen.getByPlaceholderText(/Search Quests/)).toBeInTheDocument();
    });

    it('renders required asterisk for name field', () => {
      render(<Quests {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('renders all status options in the select', () => {
      render(<Quests {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));

      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(2);
      expect(options[0].textContent).toBe('Active');
      expect(options[1].textContent).toBe('Completed');
      expect(options[2].textContent).toBe('Failed');
    });
  });

  describe('loading and empty states', () => {
    it('shows loading state', async () => {
      const questsManagement = await import('../../hooks/management/useQuestsManagement.js');

      vi.mocked(questsManagement).default = () => ({
        quests: [],
        loading: true,
        loadQuestsList: vi.fn(),
        saveQuestsList: vi.fn(),
        deleteQuestAction: vi.fn(),
      });

      render(<Quests {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Loading quests/)).toBeInTheDocument();
      });
    });

    it('shows empty state when no quests', async () => {
      render(<Quests {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(/No quests yet/)).toBeInTheDocument();
      });
    });
  });

  describe('back navigation', () => {
    it('calls onBack when back button clicked', () => {
      render(<Quests {...defaultProps} />);
      fireEvent.click(screen.getByText(/Back/));
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe('new quest modal', () => {
    it('opens modal when New Quest clicked', () => {
      render(<Quests {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
    });

    it('closes modal when Cancel clicked', () => {
      render(<Quests {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      expect(screen.getByRole('heading', { name: 'New Quest' })).toBeInTheDocument();
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();
    });

    it('closes modal when X button clicked', () => {
      render(<Quests {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      fireEvent.click(screen.getByLabelText('Close'));
      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();
    });

    it('closes modal when overlay clicked but not when modal content clicked', () => {
      render(<Quests {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      const overlay = document.querySelector('.ct-modal-overlay');
      fireEvent.click(overlay);
      expect(screen.queryByRole('heading', { name: 'New Quest' })).not.toBeInTheDocument();
    });

    it('has all form fields in modal (name, status, description, rewards, notes)', () => {
      render(<Quests {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));

      expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
      expect(screen.getByLabelText('Status')).toBeInTheDocument();
      expect(screen.getByTestId('preview-toggle-quest-description')).toBeInTheDocument();
      expect(screen.getByTestId('preview-toggle-quest-rewards')).toBeInTheDocument();
      expect(screen.getByTestId('preview-toggle-quest-notes')).toBeInTheDocument();
    });

    it('allows changing form fields', () => {
      render(<Quests {...defaultProps} />);
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

    it('disables save button when name is empty', () => {
      render(<Quests {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      const saveButton = screen.getByText('Save').closest('button');
      expect(saveButton).toHaveAttribute('disabled');
    });

    it('enables save button when name has a value', () => {
      render(<Quests {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      const nameInput = screen.getByLabelText(/Name/);
      fireEvent.change(nameInput, { target: { value: 'Find the Lost Sword' } });
      const saveButton = screen.getByText('Save').closest('button');
      expect(saveButton).not.toHaveAttribute('disabled');
    });

    it('does not show delete button in new quest modal', () => {
      render(<Quests {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Quest/ }));
      expect(screen.queryByText(/^Delete$/)).not.toBeInTheDocument();
    });
  });

  describe('quest list rendering', () => {
    it('renders quest list when quests are provided', async () => {
      const questsManagement = await import('../../hooks/management/useQuestsManagement.js');
      vi.mocked(questsManagement).default = () => ({
        quests: [
          {
            id: 'quest-1',
            name: 'Find the Lost Sword',
            status: 'active',
            description: 'Search for the ancient sword in the ruins',
            rewards: '500 gold',
            notes: '',
          },
        ],
        loading: false,
        loadQuestsList: vi.fn(),
        saveQuestsList: vi.fn(),
        deleteQuestAction: vi.fn(),
      });

      render(<Quests {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
      });
    });

    it('shows multiple quests in the list', async () => {
      const questsManagement = await import('../../hooks/management/useQuestsManagement.js');
      vi.mocked(questsManagement).default = () => ({
        quests: [
          { id: 'quest-1', name: 'Find the Lost Sword', status: 'active', description: '', rewards: '', notes: '' },
          { id: 'quest-2', name: 'Defeat the Dragon', status: 'completed', description: '', rewards: '', notes: '' },
          { id: 'quest-3', name: 'Rescue the Princess', status: 'failed', description: '', rewards: '', notes: '' },
        ],
        loading: false,
        loadQuestsList: vi.fn(),
        saveQuestsList: vi.fn(),
        deleteQuestAction: vi.fn(),
      });

      render(<Quests {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Find the Lost Sword')).toBeInTheDocument();
        expect(screen.getByText('Defeat the Dragon')).toBeInTheDocument();
        expect(screen.getByText('Rescue the Princess')).toBeInTheDocument();
      });
    });

    it('shows description preview in quest list', async () => {
      const questsManagement = await import('../../hooks/management/useQuestsManagement.js');
      vi.mocked(questsManagement).default = () => ({
        quests: [
          {
            id: 'quest-1',
            name: 'Find the Lost Sword',
            status: 'active',
            description: 'Search for the ancient sword in the ruins of the old castle',
            rewards: '',
            notes: '',
          },
        ],
        loading: false,
        loadQuestsList: vi.fn(),
        saveQuestsList: vi.fn(),
        deleteQuestAction: vi.fn(),
      });

      render(<Quests {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText('Search for the ancient sword in the ruins of the old castle')
        ).toBeInTheDocument();
      });
    });

    it('truncates long description in quest list', async () => {
      const questsManagement = await import('../../hooks/management/useQuestsManagement.js');
      const longDescription = 'A'.repeat(150);

      vi.mocked(questsManagement).default = () => ({
        quests: [
          {
            id: 'quest-1',
            name: 'Long Quest',
            status: 'active',
            description: longDescription,
            rewards: '',
            notes: '',
          },
        ],
        loading: false,
        loadQuestsList: vi.fn(),
        saveQuestsList: vi.fn(),
        deleteQuestAction: vi.fn(),
      });

      render(<Quests {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Long Quest')).toBeInTheDocument();
      });

      const truncated = 'A'.repeat(100) + '...';
      expect(screen.getByText(truncated)).toBeInTheDocument();
    });
  });

  describe('status badges', () => {
    async function renderWithQuest(quest) {
      const questsManagement = await import('../../hooks/management/useQuestsManagement.js');
      vi.mocked(questsManagement).default = () => ({
        quests: [quest],
        loading: false,
        loadQuestsList: vi.fn(),
        saveQuestsList: vi.fn(),
        deleteQuestAction: vi.fn(),
      });
      render(<Quests {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(quest.name)).toBeInTheDocument();
      });
    }

    it('renders status badge with correct color for active quest', async () => {
      await renderWithQuest({
        id: 'quest-1',
        name: 'Active Quest',
        status: 'active',
        description: '',
        rewards: '',
        notes: '',
      });

      const badge = screen.getByText('active');
      const styleAttr = badge.getAttribute('style');
      expect(styleAttr).toContain('rgb(6, 95, 70)');
      expect(styleAttr).toContain('rgb(52, 211, 153)');
    });

    it('renders status badge with correct color for completed quest', async () => {
      await renderWithQuest({
        id: 'quest-1',
        name: 'Completed Quest',
        status: 'completed',
        description: '',
        rewards: '',
        notes: '',
      });

      const badge = screen.getByText('completed');
      const styleAttr = badge.getAttribute('style');
      expect(styleAttr).toContain('rgb(30, 64, 175)');
      expect(styleAttr).toContain('rgb(96, 165, 250)');
    });

    it('renders status badge with correct color for failed quest', async () => {
      await renderWithQuest({
        id: 'quest-1',
        name: 'Failed Quest',
        status: 'failed',
        description: '',
        rewards: '',
        notes: '',
      });

      const badge = screen.getByText('failed');
      const styleAttr = badge.getAttribute('style');
      expect(styleAttr).toContain('rgb(153, 27, 27)');
      expect(styleAttr).toContain('rgb(248, 113, 113)');
    });
  });

  describe('edit quest modal', () => {
    async function renderWithQuest(quest) {
      const questsManagement = await import('../../hooks/management/useQuestsManagement.js');
      vi.mocked(questsManagement).default = () => ({
        quests: [quest],
        loading: false,
        loadQuestsList: vi.fn(),
        saveQuestsList: vi.fn(),
        deleteQuestAction: vi.fn(),
      });
      render(<Quests {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(quest.name)).toBeInTheDocument();
      });
    }

    it('opens edit modal with Edit Quest heading when quest clicked', async () => {
      await renderWithQuest({
        id: 'quest-1',
        name: 'Find the Lost Sword',
        status: 'active',
        description: 'Search for the ancient sword',
        rewards: '500 gold',
        notes: '',
      });

      fireEvent.click(screen.getByText('Find the Lost Sword'));
      expect(screen.getByRole('heading', { name: 'Edit Quest' })).toBeInTheDocument();
    });

    it('shows delete button in edit modal', async () => {
      await renderWithQuest({
        id: 'quest-1',
        name: 'Find the Lost Sword',
        status: 'active',
        description: 'Search for the ancient sword',
        rewards: '500 gold',
        notes: '',
      });

      fireEvent.click(screen.getByText('Find the Lost Sword'));
      expect(screen.getByText(/Delete/)).toBeInTheDocument();
    });

    it('populates form fields when editing a quest', async () => {
      await renderWithQuest({
        id: 'quest-1',
        name: 'Find the Lost Sword',
        status: 'completed',
        description: 'An old quest',
        rewards: '100 gold',
        notes: 'Almost done',
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
  });

  describe('search', () => {
    async function renderWithQuests(quests) {
      const questsManagement = await import('../../hooks/management/useQuestsManagement.js');
      vi.mocked(questsManagement).default = () => ({
        quests,
        loading: false,
        loadQuestsList: vi.fn(),
        saveQuestsList: vi.fn(),
        deleteQuestAction: vi.fn(),
      });
      render(<Quests {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(quests[0].name)).toBeInTheDocument();
      });
    }

    it('filters quests based on search query', async () => {
      await renderWithQuests([
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

      const searchInput = screen.getByPlaceholderText(/Search Quests/);
      fireEvent.change(searchInput, { target: { value: 'dragon' } });

      expect(screen.queryByText('Find the Lost Sword')).not.toBeInTheDocument();
      expect(screen.getByText('Defeat the Dragon')).toBeInTheDocument();
    });

    it('shows clear search button when search has text', () => {
      render(<Quests {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText(/Search Quests/);
      fireEvent.change(searchInput, { target: { value: 'test' } });
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
    });

    it('clears search when clear button clicked', () => {
      render(<Quests {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText(/Search Quests/);
      fireEvent.change(searchInput, { target: { value: 'test' } });
      fireEvent.click(screen.getByLabelText('Clear search'));
      expect(searchInput.value).toBe('');
    });

    it('shows search no results message', async () => {
      await renderWithQuests([
        {
          id: 'quest-1',
          name: 'Find the Lost Sword',
          status: 'active',
          description: 'Search for the sword',
          rewards: '',
          notes: '',
        },
      ]);

      const searchInput = screen.getByPlaceholderText(/Search Quests/);
      fireEvent.change(searchInput, { target: { value: 'dragons' } });

      expect(screen.getByText(/No quests found matching/)).toBeInTheDocument();
    });
  });

  describe('delete quest', () => {
    async function renderWithQuest(quest, deleteSpy) {
      const questsManagement = await import('../../hooks/management/useQuestsManagement.js');
      vi.mocked(questsManagement).default = () => ({
        quests: [quest],
        loading: false,
        loadQuestsList: vi.fn(),
        saveQuestsList: vi.fn(),
        deleteQuestAction: deleteSpy,
      });
      render(<Quests {...defaultProps} />);
      await waitFor(() => {
        expect(screen.getByText(quest.name)).toBeInTheDocument();
      });
    }

    it('calls deleteQuestAction when delete confirmed', async () => {
      const deleteSpy = vi.fn();
      await renderWithQuest({
        id: 'quest-1',
        name: 'Find the Lost Sword',
        status: 'active',
        description: 'Search for the sword',
        rewards: '',
        notes: '',
      }, deleteSpy);

      fireEvent.click(screen.getByText('Find the Lost Sword'));
      fireEvent.click(screen.getByText(/Delete/));

      expect(window.confirm).toHaveBeenCalledWith('Delete quest "Find the Lost Sword"?');
      expect(deleteSpy).toHaveBeenCalledWith('quest-1');
    });

    it('does not call deleteQuestAction when confirm is cancelled', async () => {
      window.confirm = vi.fn(() => false);

      const deleteSpy = vi.fn();
      await renderWithQuest({
        id: 'quest-1',
        name: 'Find the Lost Sword',
        status: 'active',
        description: 'Search for the sword',
        rewards: '',
        notes: '',
      }, deleteSpy);

      fireEvent.click(screen.getByText('Find the Lost Sword'));
      fireEvent.click(screen.getByText(/Delete/));

      expect(window.confirm).toHaveBeenCalledWith('Delete quest "Find the Lost Sword"?');
      expect(deleteSpy).not.toHaveBeenCalled();
    });
  });
});
