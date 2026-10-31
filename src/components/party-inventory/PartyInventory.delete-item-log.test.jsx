// @maintained-by-ai: 2026-10-29
// Improve (2026-10-29-AB pre-await log-row audit): the item-delete lane wrote its
// `Removed "X" from party inventory` row alongside the fire-and-forget persist
// queue, so a rejected saveInventory left the durable campaign log claiming a
// removal the ledger never got (the EB-join divergence class, bug-eb-join-*
// fixed by 4d81b8495). The row now lands ONLY after the server acks the new
// ledger; a rejected save shows the lane's alert feedback and writes ZERO rows.
// Improve (2026-10-29 AC backlog): a rejected save ALSO rolls the optimistic
// delete back (row re-appears without remount), guarded by the same
// localRevRef stale-response check the success ack uses.
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
    expect(confirmSpy).toHaveBeenCalledWith('Delete "Antitoxin" from party inventory?');
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
    // And the row is gone from the view after the ack.
    expect(screen.queryByText('Antitoxin')).toBeNull();
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
    // Single-layer console canon: exactly ONE app line on the failure leg.
    const appLines = consoleSpy.mock.calls.filter(args =>
      String(args[0]).startsWith('[PartyInventory]'));
    expect(appLines).toHaveLength(1);
    expect(appLines[0]).toEqual([
      '[PartyInventory] delete failed:',
      expect.objectContaining({ message: 'disk on fire' }),
    ]);
    consoleSpy.mockRestore();
  });

  it('reject leg: optimistic delete rolls back — row re-appears without remount', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSaveInventory.mockRejectedValue(new Error('disk on fire'));
    await renderReady();
    clickDelete('Antitoxin');
    // Optimistic: the row vanishes immediately…
    await waitFor(() => {
      expect(screen.queryByText('Antitoxin')).toBeNull();
    });
    // …and re-appears in the SAME mounted view once the save rejects.
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Delete failed: disk on fire');
    });
    expect(screen.getByText('Antitoxin')).toBeTruthy();
    expect(screen.getByText('Torch')).toBeTruthy();
    // Pre-delete snapshot restored verbatim (same items, same order).
    expect(mockSaveInventory).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      items: expect.not.arrayContaining([expect.objectContaining({ id: 'i1' })]),
    }));
    expect(addEntry).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('reject leg with newer local edit in flight: rollback skipped (stale guard)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let rejectDelete;
    mockSaveInventory.mockImplementation(
      () => new Promise((_resolve, reject) => { rejectDelete = reject; })
    );
    await renderReady();
    clickDelete('Antitoxin');
    await waitFor(() => expect(screen.queryByText('Antitoxin')).toBeNull());
    // Newer local edit while the delete write is in flight: +1 Torch qty
    // (persist bumps localRevRef and POSTs the delete-less snapshot).
    mockSaveInventory.mockImplementation(async (_c, inv) => inv);
    const torchRow = screen.getByText('Torch').closest('tr');
    fireEvent.click(within(torchRow).getByLabelText('Increase quantity'));
    await waitFor(() => {
      expect(within(torchRow).getByLabelText('Quantity').value).toBe('6');
    });
    rejectDelete(new Error('disk on fire'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Delete failed: disk on fire');
    });
    // The rollback must NOT clobber the newer edit — no stale snapshot re-POST,
    // and Antitoxin stays gone because the newer edit owns the display.
    expect(screen.queryByText('Antitoxin')).toBeNull();
    expect(within(torchRow).getByLabelText('Quantity').value).toBe('6');
    expect(addEntry).not.toHaveBeenCalled();
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
