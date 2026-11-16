// @maintained-by-ai
// Row-level delete affordance + shared DeleteConfirmModal tier (backlog
// 2026-11-16 XD): every faction row carries a `Delete "<name>"` aria-button
// (MapsManager chip pattern) that arms the role="dialog" confirm WITHOUT
// opening the editor (row click-through is stopped). The native
// `window.confirm('Delete Faction "X"?')` tier is retired — pressing any
// delete affordance fires zero native dialogs. Cancel/Escape are fully inert
// (zero delete requests); confirming deletes exactly once by faction id.
// The in-form footer Delete arming the same dialog is pinned by
// Factions.test.jsx — do not duplicate that leg here.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
  default: ({ id }) => <div data-testid={`preview-toggle-${id}`} />,
}));

const faction = (overrides = {}) => ({
  id: 'f1',
  name: 'Iron Consortium',
  description: '',
  goals: '',
  influence: 5,
  notes: '',
  ...overrides,
});

describe('Factions row-level delete (DeleteConfirmModal tier)', () => {
  beforeEach(() => {
    factionsState = {
      factions: [],
      loading: false,
      loadFactionsList: vi.fn(),
      saveFactionsList: vi.fn(),
      deleteFactionAction: vi.fn().mockResolvedValue({}),
    };
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  const dialog = () => screen.getByRole('dialog');
  const dialogConfirm = () => within(dialog()).getByRole('button', { name: 'Yes, Delete Permanently' });
  const dialogCancel = () => within(dialog()).getByRole('button', { name: 'Cancel' });

  it('every row carries an aria-labelled Delete button mirroring the row name', () => {
    factionsState.factions = [faction({ id: 'f1', name: 'Iron Consortium' }), faction({ id: 'f2', name: 'Silver Hand' })];
    render(<Factions campaignName="test-campaign" />);
    expect(screen.getByRole('button', { name: 'Delete "Iron Consortium"' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete "Silver Hand"' })).toBeInTheDocument();
  });

  it('row delete opens the shared dialog naming the faction, without opening the editor, and fires zero native confirms', () => {
    factionsState.factions = [faction()];
    render(<Factions campaignName="test-campaign" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete "Iron Consortium"' }));
    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Delete Faction' })).toBeInTheDocument();
    expect(dialog()).toHaveTextContent('Iron Consortium');
    expect(screen.queryByRole('heading', { name: 'Edit Faction' })).not.toBeInTheDocument();
  });

  it('Cancel dismisses the dialog with zero delete requests and the row intact', () => {
    factionsState.factions = [faction()];
    render(<Factions campaignName="test-campaign" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete "Iron Consortium"' }));
    fireEvent.click(dialogCancel());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(factionsState.deleteFactionAction).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Edit faction: Iron Consortium')).toBeInTheDocument();
  });

  it('Escape dismisses the dialog with zero delete requests (modal-family parity)', () => {
    factionsState.factions = [faction()];
    render(<Factions campaignName="test-campaign" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete "Iron Consortium"' }));
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(factionsState.deleteFactionAction).not.toHaveBeenCalled();
  });

  it('confirming sends exactly one delete by faction id and closes the dialog', async () => {
    factionsState.factions = [faction({ id: 'f7', name: 'Iron Consortium' })];
    render(<Factions campaignName="test-campaign" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete "Iron Consortium"' }));
    fireEvent.click(dialogConfirm());
    expect(factionsState.deleteFactionAction).toHaveBeenCalledTimes(1);
    expect(factionsState.deleteFactionAction).toHaveBeenCalledWith('f7');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(factionsState.deleteFactionAction).toHaveBeenCalledTimes(1));
    expect(console.error).not.toHaveBeenCalled();
  });

  it('keyboard Enter on the row delete chip arms the dialog without opening the editor', () => {
    factionsState.factions = [faction()];
    render(<Factions campaignName="test-campaign" />);
    const chip = screen.getByRole('button', { name: 'Delete "Iron Consortium"' });
    fireEvent.keyDown(chip, { key: 'Enter' });
    // The chip stops propagation, so the row's open-editor keydown never fires.
    expect(screen.queryByRole('heading', { name: 'Edit Faction' })).not.toBeInTheDocument();
  });
});
