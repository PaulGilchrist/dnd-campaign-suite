// @maintained-by-ai
// Base CRUD / modal / search lane for Factions: header + mount-load, loading
// and empty states, modal open/close lifecycle, save-disabled-by-name guard
// (the disabled byte IS the guard — clicking a disabled button is a no-op,
// so we assert the byte, never a post-guard click), create/edit save payload
// bytes, server-error surfacing, delete confirm/cancel/pending/error, search,
// and influence badges.
// The live duplicate-name arc (error WHILE typing, case-insensitive dup,
// self-exempt retype) is owned by Factions.duplicate-name.test.jsx —
// do not duplicate it here.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Factions from './Factions.jsx';

let factionsState = {};

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

const DUPLICATE_ERROR = 'A faction with that name already exists';

// Fresh fixtures per test (no in-place mutation across tests).
const faction = (overrides = {}) => ({
  id: 'f1',
  name: 'Faction',
  description: '',
  goals: '',
  influence: 5,
  notes: '',
  ...overrides,
});

describe('Factions', () => {
  let defaultProps;

  beforeEach(() => {
    defaultProps = { campaignName: 'test-campaign', onBack: vi.fn() };
    factionsState = {
      factions: [],
      loading: false,
      loadFactionsList: vi.fn(),
      saveFactionsList: vi.fn(),
      deleteFactionAction: vi.fn(),
    };
    window.confirm = vi.fn(() => true);
  });

  const nameInput = () => screen.getByRole('textbox', { name: 'Faction Name *' });
  const saveButton = () => screen.getByRole('button', { name: 'Save' });

  describe('list states', () => {
    it('loads on mount and renders header, back button, and empty state; Back invokes onBack', () => {
      render(<Factions {...defaultProps} />);
      expect(factionsState.loadFactionsList).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('heading', { name: /Factions/ })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search factions/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /New Faction/ })).toBeInTheDocument();
      expect(screen.getByText(/No factions yet/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /Back/ }));
      expect(defaultProps.onBack).toHaveBeenCalledTimes(1);
    });

    it('shows the loading state instead of the list', () => {
      factionsState.loading = true;
      render(<Factions {...defaultProps} />);
      expect(screen.getByText(/Loading factions/)).toBeInTheDocument();
      expect(screen.queryByText(/No factions/)).not.toBeInTheDocument();
    });

    it('renders influence badges with level-dependent colors and omits the badge when unset', () => {
      factionsState.factions = [
        faction({ id: 'f1', name: 'Weak', influence: 2 }),
        faction({ id: 'f2', name: 'Strong', influence: 10 }),
        faction({ id: 'f3', name: 'Mysterious', influence: undefined }),
      ];
      render(<Factions {...defaultProps} />);
      const weak = screen.getByTitle('Influence: 2');
      const strong = screen.getByTitle('Influence: 10');
      expect(weak).toHaveTextContent('2');
      expect(strong).toHaveTextContent('10');
      // level colors must differ (without pinning exact hex values)
      expect(weak.style.backgroundColor).not.toBe(strong.style.backgroundColor);
      // exactly two badges in the list; f3 has no influence, so no badge
      expect(screen.queryAllByTitle(/Influence:/)).toHaveLength(2);
    });
  });

  describe('modal lifecycle', () => {
    it('opens on New Faction with Save disabled until a real name is typed, no Delete button, closes via X and Cancel', () => {
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      expect(screen.getByRole('heading', { name: 'New Faction' })).toBeInTheDocument();
      // Guard contract: disabled byte is the empty-name guard (this replaces
      // any "click Save while disabled, assert no save" tautology).
      expect(saveButton()).toBeDisabled();
      fireEvent.change(nameInput(), { target: { value: '   ' } });
      expect(saveButton()).toBeDisabled();
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Close'));
      expect(screen.queryByRole('heading', { name: 'New Faction' })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      fireEvent.change(nameInput(), { target: { value: 'Test' } });
      expect(saveButton()).not.toBeDisabled();
      fireEvent.click(screen.getByText('Cancel'));
      expect(screen.queryByRole('heading', { name: 'New Faction' })).not.toBeInTheDocument();
    });

    it('opens a prefilled Edit modal via keyboard with Save enabled and Delete present', () => {
      factionsState.factions = [
        faction({ id: 'f1', name: 'Test Faction', description: 'Some desc', goals: 'Goals here', influence: 7, notes: 'Extra notes' }),
      ];
      render(<Factions {...defaultProps} />);
      fireEvent.keyDown(screen.getByRole('button', { name: 'Edit faction: Test Faction' }), { key: 'Enter' });
      expect(screen.getByRole('heading', { name: 'Edit Faction' })).toBeInTheDocument();
      expect(nameInput()).toHaveValue('Test Faction');
      expect(screen.getByTestId('faction-field-faction-description')).toHaveValue('Some desc');
      expect(screen.getByTestId('faction-field-faction-goals')).toHaveValue('Goals here');
      expect(screen.getByTestId('faction-field-faction-notes')).toHaveValue('Extra notes');
      expect(saveButton()).not.toBeDisabled();
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });
  });

  describe('save', () => {
    it('creates a new faction with exact payload bytes and closes the modal', async () => {
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      fireEvent.change(nameInput(), { target: { value: 'The Silver Hand' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(factionsState.saveFactionsList).toHaveBeenCalledTimes(1));
      expect(factionsState.saveFactionsList).toHaveBeenCalledWith([
        { id: expect.any(String), name: 'The Silver Hand', description: '', goals: '', influence: 1, notes: '' },
      ]);
      expect(screen.queryByRole('heading', { name: 'New Faction' })).not.toBeInTheDocument();
    });

    it('saves an edited faction in place (self-name exempt from the duplicate guard) with exact payload bytes', async () => {
      factionsState.factions = [
        faction({ id: 'f1', name: 'The Iron Consortium', description: 'old' }),
        faction({ id: 'f2', name: 'Other Faction' }),
      ];
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Edit faction: The Iron Consortium'));
      // Enabled-arm contract: own name must not trip the duplicate guard.
      expect(screen.queryByText(DUPLICATE_ERROR)).not.toBeInTheDocument();
      expect(saveButton()).not.toBeDisabled();
      fireEvent.change(screen.getByTestId('faction-field-faction-description'), { target: { value: 'updated' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(factionsState.saveFactionsList).toHaveBeenCalledTimes(1));
      expect(factionsState.saveFactionsList).toHaveBeenCalledWith([
        { id: 'f1', name: 'The Iron Consortium', description: 'updated', goals: '', influence: 5, notes: '' },
        { id: 'f2', name: 'Other Faction', description: '', goals: '', influence: 5, notes: '' },
      ]);
      expect(screen.queryByRole('heading', { name: 'Edit Faction' })).not.toBeInTheDocument();
    });

    it('blocks renaming onto another faction: initially enabled, error + disabled Save while the colliding name is typed, zero writes', () => {
      // Rename-collision face (id-exclusion of the guard). The while-typing
      // duplicate arc for NEW factions is owned by Factions.duplicate-name.test.jsx.
      factionsState.factions = [
        faction({ id: 'f1', name: 'The Iron Consortium' }),
        faction({ id: 'f2', name: 'QA Parity Faction' }),
      ];
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Edit faction: QA Parity Faction'));
      expect(saveButton()).not.toBeDisabled();
      fireEvent.change(nameInput(), { target: { value: 'THE IRON CONSORTIUM' } });
      expect(screen.getByText(DUPLICATE_ERROR)).toBeInTheDocument();
      expect(saveButton()).toBeDisabled();
      expect(factionsState.saveFactionsList).not.toHaveBeenCalled();
    });

    it('surfaces the server rejection message exactly once, keeps the modal open, and logs the error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const refusal = 'Server rejected the faction save';
      factionsState.saveFactionsList = vi.fn().mockRejectedValue(new Error(refusal));
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
      fireEvent.change(nameInput(), { target: { value: 'Some Faction' } });
      fireEvent.click(saveButton());
      await waitFor(() => expect(screen.getByText(refusal)).toBeInTheDocument());
      expect(screen.queryByText(DUPLICATE_ERROR)).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'New Faction' })).toBeInTheDocument();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to save faction:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('delete', () => {
    it('asks for confirmation once per click, shows a disabled Deleting… state, and closes on success', async () => {
      let resolveDelete;
      factionsState.factions = [faction({ id: 'f1', name: 'ToDelete' })];
      factionsState.deleteFactionAction = vi.fn(() => new Promise((resolve) => { resolveDelete = resolve; }));
      window.confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Edit faction: ToDelete'));
      const deleteButton = screen.getByRole('button', { name: 'Delete' });

      fireEvent.click(deleteButton); // cancelled
      expect(window.confirm).toHaveBeenCalledWith('Delete Faction "ToDelete"?');
      expect(factionsState.deleteFactionAction).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'Edit Faction' })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Delete' })); // confirmed
      expect(window.confirm).toHaveBeenLastCalledWith('Delete Faction "ToDelete"?');
      expect(factionsState.deleteFactionAction).toHaveBeenCalledWith('f1');
      expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();

      resolveDelete();
      await waitFor(() => expect(screen.queryByRole('heading', { name: 'Edit Faction' })).not.toBeInTheDocument());
      expect(factionsState.deleteFactionAction).toHaveBeenCalledTimes(1);
    });

    it('logs and stays in the modal when the delete fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      factionsState.factions = [faction({ id: 'f1', name: 'ToDelete' })];
      factionsState.deleteFactionAction = vi.fn().mockRejectedValue(new Error('Delete failed'));
      render(<Factions {...defaultProps} />);
      fireEvent.click(screen.getByLabelText('Edit faction: ToDelete'));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(consoleSpy).toHaveBeenCalledWith('Failed to delete faction:', expect.any(Error)));
      expect(screen.getByRole('heading', { name: 'Edit Faction' })).toBeInTheDocument();
      consoleSpy.mockRestore();
    });
  });

  describe('search', () => {
    it('filters by name case-insensitively, ignores description text, shows a no-results message, and restores on clear', () => {
      factionsState.factions = [
        faction({ id: 'f1', name: 'The Silver Hand', description: 'a shadowy guild of artisans' }),
        faction({ id: 'f2', name: 'Black Lotus' }),
      ];
      render(<Factions {...defaultProps} />);
      fireEvent.change(screen.getByPlaceholderText(/Search factions/), { target: { value: 'silver' } });
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
      expect(screen.queryByText('Black Lotus')).not.toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText(/Search factions/), { target: { value: 'SILVER' } });
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
      // name-field only: 'shadowy' lives in the hidden description, not any name
      fireEvent.change(screen.getByPlaceholderText(/Search factions/), { target: { value: 'shadowy' } });
      expect(screen.queryByText('The Silver Hand')).not.toBeInTheDocument();
      expect(screen.getByText(/No factions found matching/)).toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('Clear search'));
      expect(screen.getByText('The Silver Hand')).toBeInTheDocument();
      expect(screen.getByText('Black Lotus')).toBeInTheDocument();
    });
  });
});
