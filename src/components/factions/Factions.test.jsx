/* @cleaned-by-ai */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Factions from './Factions.jsx';

let factionsState = { factions: [], loading: false, loadFactionsList: vi.fn(), saveFactionsList: vi.fn(), deleteFactionAction: vi.fn() };

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: () => ({
    items: factionsState.factions,
    loading: factionsState.loading,
    loadItems: factionsState.loadFactionsList,
    saveItems: factionsState.saveFactionsList,
    deleteItem: factionsState.deleteFactionAction,
  }),
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: ({ id, value, onChange, placeholder, label }) => (
    <div data-testid={`preview-toggle-${id}`}>
      <label>{label}</label>
      <textarea data-testid={`faction-field-${id}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  ),
}));

describe('Factions', () => {
  const defaultProps = { campaignName: 'test-campaign', onBack: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    factionsState = { factions: [], loading: false, loadFactionsList: vi.fn(), saveFactionsList: vi.fn(), deleteFactionAction: vi.fn() };
    window.confirm = vi.fn(() => true);
  });

  describe('rendering', () => {
    it('renders header with back button and title', () => {
      render(<Factions {...defaultProps} />);
      expect(screen.getByText(/Back/)).toBeInTheDocument();
      expect(screen.getByText(/Factions/)).toBeInTheDocument();
    });

    it('renders New Faction button and search input', () => {
      render(<Factions {...defaultProps} />);
      expect(screen.getByRole('button', { name: /New Faction/ })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search factions/)).toBeInTheDocument();
    });

    it('shows empty state when no factions', () => {
      render(<Factions {...defaultProps} />);
      expect(screen.getByText(/No factions yet/)).toBeInTheDocument();
    });

    it('shows loading state', async () => {
      factionsState.loading = true;
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText(/Loading factions/)).toBeInTheDocument());
    });
  });

  describe('modal interactions', () => {
    it('opens modal when New Faction clicked, closes on Cancel', () => {
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      expect(screen.getByRole('heading', { name: 'New Faction' })).toBeInTheDocument();
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByRole('heading', { name: 'New Faction' })).not.toBeInTheDocument();
    });

    it('closes modal when X or overlay clicked', () => {
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      fireEvent.click(screen.getByLabelText('Close'));
      expect(screen.queryByRole('heading', { name: 'New Faction' })).not.toBeInTheDocument();
    });

    it('does not close modal when modal content clicked', () => {
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      const modal = document.querySelector('.ct-modal');
      fireEvent.click(modal);
      expect(screen.getByRole('heading', { name: 'New Faction' })).toBeInTheDocument();
    });

    it('renders modal fields and influence slider', () => {
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      expect(screen.getByText('Description')).toBeInTheDocument();
      expect(screen.getByRole('slider')).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Faction Name *' })).toBeInTheDocument();
    });

    it('disables save button when name is empty, enables when filled', () => {
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'Test' } });
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
    });
  });

  describe('save and edit', () => {
    it('saves a new faction when save clicked with name', async () => {
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'The Silver Hand' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(factionsState.saveFactionsList).toHaveBeenCalled());
    });

    it('saves with all fields populated', async () => {
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'Test' } });
      fireEvent.change(screen.getByTestId('faction-field-faction-description'), { target: { value: 'Desc' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(factionsState.saveFactionsList).toHaveBeenCalled());
    });

    it('does not save when name is empty', async () => {
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(factionsState.saveFactionsList).not.toHaveBeenCalled());
    });

    it('edits existing faction and saves changes', async () => {
      factionsState.factions = [{ id: 'f1', name: 'Old Name', description: 'A faction', goals: '', influence: 5, notes: '' }];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('Old Name')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Old Name'));
      fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'New Name' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(factionsState.saveFactionsList).toHaveBeenCalled());
    });
  });

  describe('delete', () => {
    it('deletes when confirmed, skips when cancelled', async () => {
      factionsState.deleteFactionAction = vi.fn().mockResolvedValue(undefined);
      factionsState.factions = [{ id: 'f1', name: 'ToDelete', description: '', goals: '', influence: 5, notes: '' }];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('ToDelete')).toBeInTheDocument());
      fireEvent.click(screen.getByText('ToDelete'));
      fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
      await waitFor(() => expect(factionsState.deleteFactionAction).toHaveBeenCalledWith('f1'));
    });

    it('does not delete when user cancels', async () => {
      factionsState.factions = [{ id: 'f1', name: 'Keep', description: '', goals: '', influence: 5, notes: '' }];
      window.confirm = vi.fn(() => false);
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('Keep')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Keep'));
      fireEvent.click(screen.getByRole('button', { name: /Delete/ }));
      expect(factionsState.deleteFactionAction).not.toHaveBeenCalled();
    });

    it('shows delete button only in edit mode', () => {
      render(<Factions {...defaultProps} />);
      expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    });
  });

  describe('search and filtering', () => {
    it('filters factions by search query', async () => {
      factionsState.factions = [{ id: 'f1', name: 'The Silver Hand', description: '', goals: '', influence: 5, notes: '' }];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('The Silver Hand')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText(/Search factions/), { target: { value: 'silver' } });
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
    });

    it('shows no results message when search matches nothing', async () => {
      factionsState.factions = [{ id: 'f1', name: 'The Silver Hand', description: '', goals: '', influence: 5, notes: '' }];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('The Silver Hand')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText(/Search factions/), { target: { value: 'dragons' } });
      expect(screen.getByText(/No factions found matching/)).toBeInTheDocument();
    });

    it('clears search when clear button clicked', () => {
      render(<Factions {...defaultProps} />);
      const searchInput = screen.getByPlaceholderText(/Search factions/);
      fireEvent.change(searchInput, { target: { value: 'test' } });
      expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Clear search'));
      expect(searchInput.value).toBe('');
    });
  });

  describe('list rendering', () => {
    it('renders multiple factions', async () => {
      factionsState.factions = [
        { id: 'f1', name: 'Silver Hand', description: '', goals: '', influence: 5, notes: '' },
        { id: 'f2', name: 'Black Lotus', description: '', goals: '', influence: 8, notes: '' },
      ];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('Silver Hand')).toBeInTheDocument());
      expect(screen.getByText('Black Lotus')).toBeInTheDocument();
    });

    it('shows influence badge when set', async () => {
      factionsState.factions = [{ id: 'f1', name: 'Test', description: '', goals: '', influence: 7, notes: '' }];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByTitle('Influence: 7')).toBeInTheDocument());
    });

    it('handles faction without influence gracefully', async () => {
      factionsState.factions = [{ id: 'f1', name: 'Mysterious', description: '', goals: '', notes: '' }];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('Mysterious')).toBeInTheDocument());
      expect(screen.queryByTitle(/Influence:/)).not.toBeInTheDocument();
    });
  });

  describe('keyboard accessibility', () => {
    it('opens edit modal with Enter key', async () => {
      factionsState.factions = [{ id: 'f1', name: 'Test', description: '', goals: '', influence: 5, notes: '' }];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('Test')).toBeInTheDocument());
      fireEvent.keyDown(screen.getByRole('button', { name: /Edit faction: Test/ }), { key: 'Enter' });
      expect(screen.getByText('Edit Faction')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('handles save error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      factionsState.saveFactionsList = vi.fn().mockRejectedValue(new Error('Network error'));
      factionsState.factions = [{ id: 'f1', name: 'Test', description: '', goals: '', influence: 5, notes: '' }];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('Test')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Test'));
      fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'Updated' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('Failed to save faction:', expect.any(Error)));
      consoleSpy.mockRestore();
    });
  });
});
