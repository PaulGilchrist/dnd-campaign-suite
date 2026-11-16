// @maintained-by-ai
// Row-level delete affordance + shared DeleteConfirmModal tier (backlog
// 2026-11-16 XD): every settlement row carries a `Delete "<name>"` aria-button
// (MapsManager chip pattern) that arms the role="dialog" confirm WITHOUT
// opening the editor (row click-through is stopped). The native
// `window.confirm('Delete Settlement "X"?')` tier is retired — pressing any
// delete affordance fires zero native dialogs. Cancel/Escape are fully inert
// (zero delete requests); confirming deletes exactly once by settlement name.
// The in-form footer Delete arming the same dialog is pinned by
// Settlements.saveDelete.test.jsx — do not duplicate that leg here.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import Settlements from './Settlements.jsx';

const settlementMockStore = {
  items: [],
  loading: false,
  loadItems: vi.fn(),
  deleteItem: vi.fn(),
};

vi.mock('../../hooks/useEntityManagement.js', () => ({
  useEntityManagement: () => settlementMockStore,
}));

vi.mock('../common/PreviewToggle.jsx', () => ({
  default: function PreviewToggle({ id }) {
    return <div data-testid={`preview-toggle-${id}`} />;
  },
}));

vi.mock('../../services/campaign/settlementGenerator.js', () => ({
  generateSettlement: vi.fn(),
}));

vi.mock('../../services/campaign/settlementsService.js', () => ({
  loadSettlements: vi.fn(),
  saveSettlement: vi.fn(),
  deleteSettlement: vi.fn(),
}));

const makeSettlement = (name) => ({
  name,
  size: 'town',
  population: '',
  tags: '',
  services: [],
  description: '',
  atmosphere: '',
  government: '',
  notableNPCs: [],
  rumors: [],
  notes: '',
  threat: '',
});

describe('Settlements row-level delete (DeleteConfirmModal tier)', () => {
  const dialog = () => screen.getByRole('dialog');
  const dialogConfirm = () => within(dialog()).getByRole('button', { name: 'Yes, Delete Permanently' });
  const dialogCancel = () => within(dialog()).getByRole('button', { name: 'Cancel' });

  beforeEach(() => {
    vi.clearAllMocks();
    settlementMockStore.items = [];
    settlementMockStore.loading = false;
    settlementMockStore.loadItems.mockResolvedValue(undefined);
    settlementMockStore.deleteItem.mockResolvedValue({});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('every row carries an aria-labelled Delete button mirroring the row name', () => {
    settlementMockStore.items = [makeSettlement('Ironhaven'), makeSettlement('Emberfall')];
    render(<Settlements campaignName="test" />);
    expect(screen.getByRole('button', { name: 'Delete "Ironhaven"' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete "Emberfall"' })).toBeInTheDocument();
  });

  it('row delete opens the shared dialog naming the settlement, without opening the editor, and fires zero native confirms', () => {
    settlementMockStore.items = [makeSettlement('Ironhaven')];
    render(<Settlements campaignName="test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete "Ironhaven"' }));
    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'Delete Settlement' })).toBeInTheDocument();
    expect(dialog()).toHaveTextContent('Ironhaven');
    expect(screen.queryByRole('heading', { name: 'Edit Settlement' })).not.toBeInTheDocument();
  });

  it('Cancel dismisses the dialog with zero delete requests and the row intact', () => {
    settlementMockStore.items = [makeSettlement('Ironhaven')];
    render(<Settlements campaignName="test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete "Ironhaven"' }));
    fireEvent.click(dialogCancel());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(settlementMockStore.deleteItem).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /edit settlement: ironhaven/i })).toBeInTheDocument();
  });

  it('Escape dismisses the dialog with zero delete requests (modal-family parity)', () => {
    settlementMockStore.items = [makeSettlement('Ironhaven')];
    render(<Settlements campaignName="test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete "Ironhaven"' }));
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(settlementMockStore.deleteItem).not.toHaveBeenCalled();
  });

  it('confirming sends exactly one delete by settlement name and closes the dialog', async () => {
    settlementMockStore.items = [makeSettlement('Ironhaven')];
    render(<Settlements campaignName="test" />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete "Ironhaven"' }));
    fireEvent.click(dialogConfirm());
    expect(settlementMockStore.deleteItem).toHaveBeenCalledTimes(1);
    expect(settlementMockStore.deleteItem).toHaveBeenCalledWith('Ironhaven');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(settlementMockStore.deleteItem).toHaveBeenCalledTimes(1));
    expect(console.error).not.toHaveBeenCalled();
  });

  it('keyboard Enter on the row delete chip does not open the editor (propagation stopped)', () => {
    settlementMockStore.items = [makeSettlement('Ironhaven')];
    render(<Settlements campaignName="test" />);
    const chip = screen.getByRole('button', { name: 'Delete "Ironhaven"' });
    fireEvent.keyDown(chip, { key: 'Enter' });
    expect(screen.queryByRole('heading', { name: 'Edit Settlement' })).not.toBeInTheDocument();
  });
});
