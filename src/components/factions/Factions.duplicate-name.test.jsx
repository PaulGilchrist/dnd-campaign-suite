// Regression tests for live duplicate-name validation: the error must appear
// while typing (before Save), clear immediately when the name is fixed, and
// exempt the faction being edited (case-insensitive, mirrors server guard).
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

const ERROR_TEXT = 'A faction with that name already exists';

describe('Factions live duplicate-name validation', () => {
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

  it('shows the duplicate error while typing, before clicking Save, and disables Save', async () => {
    factionsState.factions = [{ id: 'f1', name: 'QA Dupe Test', description: '', goals: '', influence: 5, notes: '' }];
    render(<Factions {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('QA Dupe Test')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'qa dupe test' } });

    expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(factionsState.saveFactionsList).not.toHaveBeenCalled();
  });

  it('clears the duplicate error immediately when the name is edited to a non-duplicate', () => {
    factionsState.factions = [{ id: 'f1', name: 'QA Dupe Test', description: '', goals: '', influence: 5, notes: '' }];
    render(<Factions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'qa dupe test' } });
    expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'qa dupe test 2' } });

    expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('does not flag the edited faction with its own name (self-exempt)', async () => {
    factionsState.factions = [{ id: 'f1', name: 'QA Dupe Test', description: '', goals: '', influence: 5, notes: '' }];
    render(<Factions {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('QA Dupe Test')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Edit faction: QA Dupe Test'));

    expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'qa dupe test' } });
    expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('blocks saving a duplicate even if Save were triggered, and saves a valid name normally', async () => {
    factionsState.factions = [{ id: 'f1', name: 'QA Dupe Test', description: '', goals: '', influence: 5, notes: '' }];
    render(<Factions {...defaultProps} />);
    await waitFor(() => expect(screen.getByText('QA Dupe Test')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'QA DUPE TEST' } });
    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();
    fireEvent.click(saveButton);
    await new Promise((r) => setTimeout(r, 0));
    expect(factionsState.saveFactionsList).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: 'Faction Name *' }), { target: { value: 'QA Dupe Test 2' } });
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(factionsState.saveFactionsList).toHaveBeenCalled());
  });
});
