// @maintained-by-ai: 2026-10-29
// Improve (2026-10-29-AB pre-await log-row audit): the item-delete lane wrote its
// `Removed "X" from party inventory` row alongside the fire-and-forget persist
// queue, so a rejected saveInventory left the durable campaign log claiming a
// removal the ledger never got (the EB-join divergence class, bug-eb-join-*
// fixed by 4d81b8495). The row now lands ONLY after the server acks the new
// ledger; a rejected save shows the lane's alert feedback and writes ZERO rows.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';
import { addEntry } from '../../services/ui/logService.js';

const mockLoadInventory = vi.fn();
const mockSaveInventory = vi.fn();
const mockTransferInventory = vi.fn();

vi.mock('../../services/campaign/inventoryService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadInventory: (...args) => mockLoadInventory(...args),
  saveInventory: (...args) => mockSaveInventory(...args),
  transferInventory: (...args) => mockTransferInventory(...args),
}));

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: () => () => {},
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn().mockResolvedValue([]),
}));

const defaultProps = {
  campaignName: 'test-campaign',
  isLocalhost: true,
  characters: [{ name: 'War Cleric', inventory: { backpack: [], equipped: [], gold: 0, magicItems: [] } }],
  onBack: vi.fn(),
};

const baseInventory = () => ({
  currency: { pp: 0, gp: 10, sp: 0, cp: 0 },
  items: [
    { id: 'i1', name: 'Antitoxin', quantity: 1, description: 'venom' },
    { id: 'i2', name: 'Torch', quantity: 5, description: '' },
  ],
});

async function renderReady() {
  render(<PartyInventory {...defaultProps} />);
  await screen.findByText('Party Inventory');
}

function clickDelete(name) {
  const row = screen.getByText(name).closest('tr');
  fireEvent.click(within(row).getByTitle('Delete item'));
}

describe('PartyInventory item-delete log ordering (pre-await audit)', () => {
  let confirmSpy = null;
  let alertSpy = null;

  beforeEach(() => {
    mockLoadInventory.mockReset().mockResolvedValue(baseInventory());
    mockSaveInventory.mockReset().mockImplementation(async (_c, inv) => inv);
    mockTransferInventory.mockReset().mockResolvedValue({});
    addEntry.mockClear();
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('success leg: exactly ONE post-await Removed row after the save acks', async () => {
    await renderReady();
    clickDelete('Antitoxin');
    await waitFor(() => {
      expect(mockSaveInventory).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        items: expect.not.arrayContaining([expect.objectContaining({ id: 'i1' })]),
      }));
    });
    await waitFor(() => {
      expect(addEntry).toHaveBeenCalledTimes(1);
    });
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'inventory_transfer',
      message: 'Removed "Antitoxin" from party inventory',
    }));
    // Row is post-await: it could only have fired after the save resolved.
    expect(addEntry.mock.calls.length).toBe(1);
  });

  it('reject leg: no success row, honest alert + console.error feedback', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSaveInventory.mockRejectedValue(new Error('disk on fire'));
    await renderReady();
    clickDelete('Antitoxin');
    await waitFor(() => {
      expect(mockSaveInventory).toHaveBeenCalled();
    });
    // Let the rejection chain settle.
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Delete failed: disk on fire');
    });
    expect(addEntry).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[PartyInventory] delete failed:',
      expect.objectContaining({ message: 'disk on fire' }),
    );
    consoleSpy.mockRestore();
  });

  it('confirm cancel: zero mutation, zero row', async () => {
    confirmSpy.mockReturnValue(false);
    await renderReady();
    clickDelete('Antitoxin');
    await waitFor(() => expect(screen.getByText('Antitoxin')).toBeTruthy());
    expect(mockSaveInventory).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
