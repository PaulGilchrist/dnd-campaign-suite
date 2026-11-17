// @maintained-by-ai: 2026-11-17
// Improve (2026-10-29-AB pre-await log-row audit): the item-delete lane wrote its
// `Removed "X" from party inventory` row alongside the fire-and-forget persist
// queue, so a rejected save left the durable campaign log claiming a
// removal the ledger never got (the EB-join divergence class, bug-eb-join-*
// fixed by 4d81b8495). The row lands ONLY after the server acks the new
// ledger; a rejected save shows the lane's alert feedback and writes ZERO rows.
// Improve (2026-10-29 AC backlog): a rejected save ALSO rolls the optimistic
// delete back (row re-appears without remount), guarded by the same
// localRevRef stale-response check the success ack uses.
// Migration (bug-inventory-item-save-concurrent-snapshot-last-writer-wins): deletes are
// now atomic row-intents ({ action: 'delete', id }) on the serialized FIFO queue of the
// /inventory/item lane — the post-ack audit, rejection feedback and stale-guarded
// rollback semantics below are unchanged; a 409 (row already gone elsewhere) adopts the
// server's merged doc instead of rolling back a ghost.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';
import { addEntry } from '../../services/ui/logService.js';

const mockLoadInventory = vi.fn();
const mockApplyItemIntent = vi.fn();
const mockTransferInventory = vi.fn();

vi.mock('../../services/campaign/inventoryService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadInventory: (...args) => mockLoadInventory(...args),
  applyItemIntent: (...args) => mockApplyItemIntent(...args),
  adjustCurrency: vi.fn(),
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

// Fake per-row ledger mirroring POST /inventory/item: setQty rewrites just its row —
// unlike the retired snapshot lane it can NEVER delete rows it never mentioned.
let serverItems;

function ackFromLedger() {
  return { currency: baseInventory().currency, items: serverItems.map(i => ({ ...i })) };
}

async function renderReady() {
  render(<PartyInventory {...defaultProps} />);
  await screen.findByText('Party Inventory');
}

function clickDelete(name) {
  const row = screen.getByText(name).closest('tr');
  fireEvent.click(within(row).getByTitle('Delete item'));
}

function increaseQuantity(name) {
  fireEvent.click(within(screen.getByText(name).closest('tr')).getByLabelText(`Increase quantity of ${name}`));
}

describe('PartyInventory item-delete log ordering (pre-await audit)', () => {
  let confirmSpy = null;
  let alertSpy = null;

  beforeEach(() => {
    serverItems = baseInventory().items;
    mockLoadInventory.mockReset().mockResolvedValue(baseInventory());
    mockApplyItemIntent.mockReset().mockImplementation(async (_c, intent) => {
      if (intent.action === 'delete') serverItems = serverItems.filter(i => i.id !== intent.id);
      else if (intent.action === 'setQty') serverItems.find(i => i.id === intent.id).quantity = intent.quantity;
      return ackFromLedger();
    });
    mockTransferInventory.mockReset().mockResolvedValue({});
    addEntry.mockClear();
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('success leg: exactly ONE post-await Removed row after the delete intent acks', async () => {
    await renderReady();
    clickDelete('Antitoxin');
    expect(confirmSpy).toHaveBeenCalledWith('Delete "Antitoxin" from party inventory?');
    await waitFor(() => {
      // A single row-delete intent — no item list ever leaves this window.
      expect(mockApplyItemIntent).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        action: 'delete',
        id: 'i1',
        name: 'Antitoxin',
      }));
    });
    await waitFor(() => {
      expect(addEntry).toHaveBeenCalledTimes(1);
    });
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'inventory_transfer',
      message: 'Removed "Antitoxin" from party inventory',
    }));
    // Row is post-await: it could only have fired after the intent resolved.
    expect(addEntry.mock.calls.length).toBe(1);
    // And the row is gone from the view after the ack.
    expect(screen.queryByText('Antitoxin')).toBeNull();
  });

  it('reject leg: no success row, honest alert + console.error feedback', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApplyItemIntent.mockRejectedValue(new Error('disk on fire'));
    await renderReady();
    clickDelete('Antitoxin');
    await waitFor(() => {
      expect(mockApplyItemIntent).toHaveBeenCalled();
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
    mockApplyItemIntent.mockRejectedValue(new Error('disk on fire'));
    await renderReady();
    clickDelete('Antitoxin');
    // Optimistic: the row vanishes immediately…
    await waitFor(() => {
      expect(screen.queryByText('Antitoxin')).toBeNull();
    });
    // …and re-appears in the SAME mounted view once the intent rejects.
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Delete failed: disk on fire');
    });
    expect(screen.getByText('Antitoxin')).toBeTruthy();
    expect(screen.getByText('Torch')).toBeTruthy();
    // The server ledger kept the row — the intent never mentioned any other row.
    expect(mockApplyItemIntent).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ action: 'delete', id: 'i1' }));
    expect(serverItems.map(i => i.id)).toEqual(['i1', 'i2']);
    expect(addEntry).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('409 conflict leg: row already deleted elsewhere — merged truth adopted, no row, no ghost', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const conflict = new Error('Party item "Antitoxin" was deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.');
    conflict.status = 409;
    conflict.inventory = { ...baseInventory(), items: [serverItems[1]] };
    mockApplyItemIntent.mockRejectedValue(conflict);
    await renderReady();
    clickDelete('Antitoxin');
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('was deleted in another tab or session'));
    });
    // The rollback must NOT resurrect the row the other window deleted.
    expect(screen.queryByText('Antitoxin')).toBeNull();
    expect(screen.getByText('Torch')).toBeTruthy();
    expect(addEntry).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('reject leg with newer local edit in flight: rollback skipped (stale guard)', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let rejectDelete;
    mockApplyItemIntent.mockImplementationOnce(
      () => new Promise((_resolve, reject) => { rejectDelete = reject; })
    );
    await renderReady();
    clickDelete('Antitoxin');
    await waitFor(() => expect(screen.queryByText('Antitoxin')).toBeNull());
    // Newer local edit while the delete intent is in flight: +1 Torch qty. Under the
    // intent lane it rides the queue behind the delete as setQty {id:'i2', quantity:6}
    // — it no longer re-POSTs (and thereby server-side performs) the deletion.
    mockApplyItemIntent.mockImplementation(async (_c, intent) => {
      if (intent.action === 'setQty') serverItems.find(i => i.id === intent.id).quantity = intent.quantity;
      return ackFromLedger();
    });
    increaseQuantity('Torch');
    await waitFor(() => {
      expect(within(screen.getByText('Torch').closest('tr')).getByLabelText('Quantity').value).toBe('6');
    });
    rejectDelete(new Error('disk on fire'));
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Delete failed: disk on fire');
    });
    // Rollback skipped (newer edit owns the display), and the queued setQty ack carries
    // the SERVER truth: the delete was refused, so Antitoxin converges back — the qty
    // edit alone never deletes a row (the clobber-class law).
    await waitFor(() => {
      expect(screen.getByText('Antitoxin')).toBeTruthy();
    });
    expect(within(screen.getByText('Torch').closest('tr')).getByLabelText('Quantity').value).toBe('6');
    expect(mockApplyItemIntent).toHaveBeenNthCalledWith(2, 'test-campaign', expect.objectContaining({
      action: 'setQty',
      id: 'i2',
      quantity: 6,
    }));
    expect(addEntry).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('confirm cancel: zero mutation, zero row', async () => {
    confirmSpy.mockReturnValue(false);
    await renderReady();
    clickDelete('Antitoxin');
    await waitFor(() => expect(screen.getByText('Antitoxin')).toBeTruthy());
    expect(mockApplyItemIntent).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
  });
});
