// @maintained-by-ai
// Live duplicate-name validation lane: the error must appear WHILE TYPING
// (before Save), disable Save with zero write attempts, clear immediately when
// the name is fixed, and exempt the faction being edited (case-insensitive,
// mirrors the server guard). Also owns the server-400 lane fix (backlog
// 2026-10-13): a duplicate error surfaced by the server (stale-list race,
// same message bytes via server/utils/nameUniqueness.js) must ALSO clear as
// soon as the name input changes, while unrelated save failures persist.
// On-click guard semantics (saveItems not called on collision click, rename
// collisions, self-edit save success, server-error surfacing) live in
// Factions.test.jsx's "duplicate-name guard" and "save and edit" blocks —
// this file owns the derived-state behavior while typing plus the
// clear-on-name-change contract.
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

// Exact bytes must match Factions.jsx DUPLICATE_NAME_ERROR; getByText
// additionally enforces the message renders exactly once.
const ERROR_TEXT = 'A faction with that name already exists';

describe('Factions live duplicate-name validation', () => {
  const defaultProps = { campaignName: 'test-campaign', onBack: vi.fn() };
  const nameInput = () => screen.getByRole('textbox', { name: 'Faction Name *' });

  beforeEach(() => {
    factionsState = {
      factions: [{ id: 'f1', name: 'QA Dupe Test', description: '', goals: '', influence: 5, notes: '' }],
      loading: false,
      loadFactionsList: vi.fn(),
      saveFactionsList: vi.fn(),
      deleteFactionAction: vi.fn(),
    };
  });

  it('shows the case-insensitive duplicate error while typing before Save, keeps Save disabled with no write attempted, and clears the moment the name is fixed', () => {
    render(<Factions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument();

    fireEvent.change(nameInput(), { target: { value: 'qa dupe test' } });
    expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(factionsState.saveFactionsList).not.toHaveBeenCalled();

    fireEvent.change(nameInput(), { target: { value: 'qa dupe test 2' } });
    expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('never flags the faction being edited with its own name (case-insensitive self-exempt)', () => {
    render(<Factions {...defaultProps} />);

    fireEvent.click(screen.getByLabelText('Edit faction: QA Dupe Test'));
    expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();

    fireEvent.change(nameInput(), { target: { value: 'QA DUPE TEST' } });
    expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('clears a server-surfaced duplicate error as soon as the name changes, and unrelated failures persist', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Stale-list race: local items carry no collision, so the duplicate comes
    // back as a server 400 with the exact same message bytes.
    // NOTE: the save spy reference is captured by the component at render —
    // steer behavior with mockRejectedValueOnce, never reassignment.
    const saveSpy = factionsState.saveFactionsList;
    saveSpy.mockRejectedValueOnce(new Error(ERROR_TEXT));
    render(<Factions {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /New Faction/ }));
    fireEvent.change(nameInput(), { target: { value: 'Race Condition League' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByText(ERROR_TEXT)).toBeInTheDocument());

    fireEvent.change(nameInput(), { target: { value: 'Race Condition League II' } });
    expect(screen.queryByText(ERROR_TEXT)).not.toBeInTheDocument();

    // Unrelated failure must NOT be wiped by a name edit.
    saveSpy.mockRejectedValueOnce(new Error('Network unavailable'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('Network unavailable')).toBeInTheDocument());

    fireEvent.change(nameInput(), { target: { value: 'Still Broken League' } });
    expect(screen.getByText('Network unavailable')).toBeInTheDocument();
    errorSpy.mockRestore();
  });
});
