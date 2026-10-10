// @improved-by-ai
// @cleaned-by-ai
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
      <textarea
        data-testid={`faction-field-${id}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
}));

describe('Factions', () => {
  const defaultProps = { campaignName: 'test-campaign', onBack: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    factionsState.factions = [];
    factionsState.loading = false;
    factionsState.loadFactionsList = vi.fn();
    factionsState.saveFactionsList = vi.fn();
    factionsState.deleteFactionAction = vi.fn();
    window.confirm = vi.fn(() => true);
  });

  describe('rendering', () => {
    it('renders header with back button, title, new faction button, and search input', () => {
      render(<Factions {...defaultProps} />);
      expect(screen.getByText(/Back/)).toBeInTheDocument();
      expect(screen.getByText(/Factions/)).toBeInTheDocument();
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

    it('closes modal when X button clicked', () => {
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

    it('disables save button when name is empty or whitespace-only, enables when filled', () => {
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: '   ' } });
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
      fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'Test' } });
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
    });

    it('shows Edit Faction heading when editing existing faction', () => {
      factionsState.factions = [{ id: 'f1', name: 'Old Name', description: 'A faction', goals: '', influence: 5, notes: '' }];
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByText('Old Name'));
      expect(screen.getByRole('heading', { name: 'Edit Faction' })).toBeInTheDocument();
    });

    it('pre-fills modal fields when editing existing faction', () => {
      factionsState.factions = [{ id: 'f1', name: 'Test Faction', description: 'Some desc', goals: 'Goals here', influence: 7, notes: 'Extra notes' }];
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByText('Test Faction'));
      expect(screen.getByRole('textbox', { name: 'Faction Name *' })).toHaveValue('Test Faction');
      expect(screen.getByTestId('faction-field-faction-description')).toHaveValue('Some desc');
      expect(screen.getByTestId('faction-field-faction-goals')).toHaveValue('Goals here');
      expect(screen.getByTestId('faction-field-faction-notes')).toHaveValue('Extra notes');
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

    it('closes modal after successful save', async () => {
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'The Silver Hand' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(factionsState.saveFactionsList).toHaveBeenCalled());
      expect(screen.queryByRole('heading', { name: 'New Faction' })).not.toBeInTheDocument();
    });
  });

  describe('duplicate-name guard', () => {
    it('shows an inline error and does not save when a new faction name collides case-insensitively', async () => {
      factionsState.factions = [{ id: 'f1', name: 'The Iron Consortium', description: '', goals: '', influence: 5, notes: '' }];
      render(<Factions {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'the iron CONSORTIUM' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText('A faction with that name already exists')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'New Faction' })).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 0));
      expect(factionsState.saveFactionsList).not.toHaveBeenCalled();
    });

    it('shows an inline error when renaming onto another existing faction name', async () => {
      factionsState.factions = [
        { id: 'f1', name: 'The Iron Consortium', description: '', goals: '', influence: 5, notes: '' },
        { id: 'f2', name: 'QA Parity Faction', description: '', goals: '', influence: 5, notes: '' },
      ];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('QA Parity Faction')).toBeInTheDocument());

      fireEvent.click(screen.getByText('QA Parity Faction'));
      fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'THE IRON CONSORTIUM' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      expect(screen.getByText('A faction with that name already exists')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Edit Faction' })).toBeInTheDocument();
      await new Promise((r) => setTimeout(r, 0));
      expect(factionsState.saveFactionsList).not.toHaveBeenCalled();
    });

    it('saves normally when editing without renaming (self-match excluded)', async () => {
      factionsState.factions = [{ id: 'f1', name: 'The Iron Consortium', description: 'old', goals: '', influence: 5, notes: '' }];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('The Iron Consortium')).toBeInTheDocument());

      fireEvent.click(screen.getByText('The Iron Consortium'));
      fireEvent.change(screen.getByTestId('faction-field-faction-description'), { target: { value: 'updated' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(factionsState.saveFactionsList).toHaveBeenCalled());
      expect(screen.queryByText('A faction with that name already exists')).not.toBeInTheDocument();
      expect(factionsState.saveFactionsList.mock.calls[0][0][0].description).toBe('updated');
    });

    it('surfaces the server error message when a save is rejected', async () => {
      factionsState.saveFactionsList = vi.fn().mockRejectedValue(new Error('A faction with that name already exists'));
      render(<Factions {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'Some Faction' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => expect(screen.getByText('A faction with that name already exists')).toBeInTheDocument());
      expect(screen.getByRole('heading', { name: 'New Faction' })).toBeInTheDocument();
    });
  });

  describe('delete', () => {
    it('deletes when confirmed', async () => {
      factionsState.deleteFactionAction = vi.fn().mockResolvedValue(undefined);
      factionsState.factions = [{ id: 'f1', name: 'ToDelete', description: '', goals: '', influence: 5, notes: '' }];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('ToDelete')).toBeInTheDocument());
      fireEvent.click(screen.getByText('ToDelete'));
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/ });
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      await waitFor(() => expect(factionsState.deleteFactionAction).toHaveBeenCalledWith('f1'));
    });

    it('does not delete when user cancels', async () => {
      factionsState.factions = [{ id: 'f1', name: 'Keep', description: '', goals: '', influence: 5, notes: '' }];
      window.confirm = vi.fn(() => false);
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('Keep')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Keep'));
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/ });
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      expect(factionsState.deleteFactionAction).not.toHaveBeenCalled();
    });

    it('shows delete button only in edit mode', () => {
      render(<Factions {...defaultProps} />);
      expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
    });

    it('disables delete button while deleting', async () => {
      factionsState.deleteFactionAction = vi.fn().mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));
      factionsState.factions = [{ id: 'f1', name: 'ToDelete', description: '', goals: '', influence: 5, notes: '' }];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('ToDelete')).toBeInTheDocument());
      fireEvent.click(screen.getByText('ToDelete'));
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/ });
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      expect(deleteButtons[deleteButtons.length - 1]).toBeDisabled();
      expect(deleteButtons[deleteButtons.length - 1]).toHaveTextContent(/Deleting/);
    });
  });

  describe('search and filtering', () => {
    it('filters factions by search query matching name case-insensitively', async () => {
      factionsState.factions = [
        { id: 'f1', name: 'The Silver Hand', description: '', goals: '', influence: 5, notes: '' },
        { id: 'f2', name: 'Black Lotus', description: '', goals: '', influence: 3, notes: '' },
      ];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('The Silver Hand')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText(/Search factions/), { target: { value: 'silver' } });
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
      expect(screen.queryByText('Black Lotus')).not.toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText(/Search factions/), { target: { value: 'SILVER' } });
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
      expect(screen.queryByText('Black Lotus')).not.toBeInTheDocument();
    });

    it('filters factions by name field only', async () => {
      factionsState.factions = [
        { id: 'f1', name: 'Order of Guardians', description: 'Protectors of the realm', goals: '', influence: 5, notes: '' },
        { id: 'f2', name: 'Dark Brotherhood', description: 'Assassins from the shadows', goals: '', influence: 3, notes: '' },
      ];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('Order of Guardians')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText(/Search factions/), { target: { value: 'dark' } });
      expect(screen.queryByText('Order of Guardians')).not.toBeInTheDocument();
      expect(screen.getByText('Dark Brotherhood')).toBeInTheDocument();
    });

    it('shows no results message when search matches nothing', async () => {
      factionsState.factions = [{ id: 'f1', name: 'The Silver Hand', description: '', goals: '', influence: 5, notes: '' }];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('The Silver Hand')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText(/Search factions/), { target: { value: 'dragons' } });
      expect(screen.getByText(/No factions found matching/)).toBeInTheDocument();
    });

    it('shows all factions again when search is cleared', async () => {
      factionsState.factions = [
        { id: 'f1', name: 'Silver Hand', description: '', goals: '', influence: 5, notes: '' },
        { id: 'f2', name: 'Black Lotus', description: '', goals: '', influence: 3, notes: '' },
      ];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('Silver Hand')).toBeInTheDocument());
      fireEvent.change(screen.getByPlaceholderText(/Search factions/), { target: { value: 'silver' } });
      expect(screen.queryByText('Black Lotus')).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Clear search'));
      expect(screen.getByText('Silver Hand')).toBeInTheDocument();
      expect(screen.getByText('Black Lotus')).toBeInTheDocument();
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

    it('applies correct influence color based on level', () => {
      factionsState.factions = [
        { id: 'f1', name: 'Weak', description: '', goals: '', influence: 2, notes: '' },
        { id: 'f2', name: 'Strong', description: '', goals: '', influence: 10, notes: '' },
      ];
      render(<Factions {...defaultProps} />);
      expect(screen.getByTitle('Influence: 2')).toBeInTheDocument();
      expect(screen.getByTitle('Influence: 10')).toBeInTheDocument();
    });
  });

  describe('keyboard accessibility', () => {
    it('opens edit modal with keyboard keys', async () => {
      factionsState.factions = [{ id: 'f1', name: 'Test', description: '', goals: '', influence: 5, notes: '' }];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('Test')).toBeInTheDocument());
      const editButton = screen.getByRole('button', { name: /Edit faction: Test/ });
      fireEvent.keyDown(editButton, { key: 'Enter' });
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

    it('handles delete error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      factionsState.deleteFactionAction = vi.fn().mockRejectedValue(new Error('Delete failed'));
      factionsState.factions = [{ id: 'f1', name: 'ToDelete', description: '', goals: '', influence: 5, notes: '' }];
      render(<Factions {...defaultProps} />);
      await waitFor(() => expect(screen.getByText('ToDelete')).toBeInTheDocument());
      fireEvent.click(screen.getByText('ToDelete'));
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/ });
      fireEvent.click(deleteButtons[deleteButtons.length - 1]);
      await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('Failed to delete faction:', expect.any(Error)));
      consoleSpy.mockRestore();
    });
  });
});
