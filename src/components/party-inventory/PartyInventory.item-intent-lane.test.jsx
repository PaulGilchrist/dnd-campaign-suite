// @maintained-by-ai: 2026-11-17
// Regression (bug-inventory-item-save-concurrent-snapshot-last-writer-wins): every item
// write (modal Save / qty stepper / qty-set / Delete) used to POST the tab's CURRENT FULL
// item list, and the server replaced inventory.items verbatim — so with two GM windows
// open, an add/edit/step/delete made in window A after window B last synced silently
// vanished when B's stale snapshot landed (live-forced twice 2026-11-17, once with a
// genuinely hot SSE echo; zero console errors, zero toast either way). Item writes are
// now per-row intents on the atomic /inventory/item lane (the /adjust model): each POST
// carries ONE add/update/setQty/delete and the server merges it onto ITS ledger, so a
// stale view can neither erase a concurrent row nor resurrect a deleted one (409 +
// merged-doc adoption, Notes-family copy). Server-side merge/409 law pinned in
// server/routes/inventory.item-intent.test.js; this file locks the CLIENT wire shape.
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';
import { addEntry } from '../../services/ui/logService.js';

const mockLoadInventory = vi.fn();
const mockApplyItemIntent = vi.fn();

vi.mock('../../services/campaign/inventoryService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadInventory: (...args) => mockLoadInventory(...args),
  applyItemIntent: (...args) => mockApplyItemIntent(...args),
  adjustCurrency: vi.fn(),
  transferInventory: vi.fn(),
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
  characters: [],
};

const lantern = { id: 'a1', name: 'QA Lantern', quantity: 1, description: 'steady flame' };
const CURRENCY = { pp: 0, gp: 11, sp: 0, cp: 1 };

// Fake server ledger mirroring POST /inventory/item: intents merge onto the CURRENT
// server list; rows an intent never mentions survive by construction.
let serverItems;

function applyIntent(intent) {
  const byName = (a, b) => a.name.localeCompare(b.name);
  if (intent.action === 'add' || intent.action === 'update') {
    const row = { name: intent.item.name, quantity: intent.item.quantity, description: intent.item.description };
    const index = serverItems.findIndex(i => i.id === intent.item.id);
    if (index >= 0) serverItems[index] = { ...serverItems[index], ...row };
    else serverItems.push({ id: intent.item.id, ...row });
  } else if (intent.action === 'setQty') {
    const target = serverItems.find(i => i.id === intent.id);
    if (!target) {
      const conflict = new Error(`Party item "${intent.name}" was deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.`);
      conflict.status = 409;
      conflict.inventory = { currency: { ...CURRENCY }, items: serverItems.map(i => ({ ...i })) };
      throw conflict;
    }
    target.quantity = intent.quantity;
  } else if (intent.action === 'delete') {
    const target = serverItems.find(i => i.id === intent.id);
    if (!target) {
      const conflict = new Error(`Party item "${intent.name}" was deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.`);
      conflict.status = 409;
      conflict.inventory = { currency: { ...CURRENCY }, items: serverItems.map(i => ({ ...i })) };
      throw conflict;
    }
    serverItems = serverItems.filter(i => i.id !== intent.id);
  }
  // The route re-sorts the ledger on every accepted write.
  serverItems = [...serverItems].sort(byName);
  return { currency: { ...CURRENCY }, items: serverItems.map(i => ({ ...i })) };
}

async function renderReady() {
  render(<PartyInventory {...defaultProps} />);
  await screen.findByText('Party Inventory');
}

function rowOf(name) {
  return within(screen.getByText(name).closest('tr'));
}

async function addItem(name, quantity = 1) {
  fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));
  const nameInput = await screen.findByLabelText(/Name/);
  fireEvent.change(nameInput, { target: { value: name } });
  const modal = nameInput.closest('.pi-modal');
  if (quantity !== 1) {
    // Row steppers share the 'Quantity' label — always scope to the modal.
    fireEvent.change(within(modal).getByLabelText('Quantity'), { target: { value: String(quantity) } });
  }
  fireEvent.click(within(modal).getByRole('button', { name: /Save/ }));
}

beforeEach(() => {
  serverItems = [{ ...lantern }];
  mockLoadInventory.mockReset().mockResolvedValue({ currency: { ...CURRENCY }, items: [{ ...lantern }] });
  mockApplyItemIntent.mockReset().mockImplementation(async (_c, intent) => applyIntent(intent));
  addEntry.mockReset().mockResolvedValue(undefined);
});

describe('PartyInventory item-intent lane (snapshot-clobber regression)', () => {
  let alertSpy = null;
  let consoleSpy = null;

  beforeEach(() => {
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    alertSpy.mockRestore();
    consoleSpy.mockRestore();
  });

  it('a qty step posts ONE setQty intent — a row a concurrent window added survives on the ledger', async () => {
    await renderReady();
    // Window A added 'QA Concurrent Coin' on the SERVER after this window last synced
    // (its echo has not repainted yet — the exact clobber-window state).
    serverItems.push({ id: 'coin1', name: 'QA Concurrent Coin', quantity: 1, description: '' });

    fireEvent.click(rowOf('QA Lantern').getByLabelText('Increase quantity'));
    await waitFor(() => expect(mockApplyItemIntent).toHaveBeenCalledTimes(1));

    // The wire carries only the single-row intent — no item list can clobber anything.
    expect(mockApplyItemIntent).toHaveBeenCalledWith('test-campaign', {
      action: 'setQty', id: 'a1', quantity: 2, name: 'QA Lantern',
    });
    expect(JSON.stringify(mockApplyItemIntent.mock.calls[0][1])).not.toContain('items');
    // The server merged additively: A's concurrent add is STILL on the ledger…
    expect(serverItems.map(i => i.name)).toEqual(['QA Concurrent Coin', 'QA Lantern']);
    // …and the ack this window adopts shows it instead of the stale view.
    expect(await screen.findByText('QA Concurrent Coin')).toBeTruthy();
    expect(rowOf('QA Lantern').getByLabelText('Quantity').value).toBe('2');
  });

  it('a modal add posts ONE add intent with the locally minted id — never a full list', async () => {
    await renderReady();
    // Same clobber-window setup: another window's row exists server-side only.
    serverItems.push({ id: 'coin1', name: 'QA Concurrent Coin', quantity: 1, description: '' });

    await addItem('Goblin Idol');
    await waitFor(() => expect(mockApplyItemIntent).toHaveBeenCalledTimes(1));
    const [campaign, intent] = mockApplyItemIntent.mock.calls[0];
    expect(campaign).toBe('test-campaign');
    expect(intent).toEqual({
      action: 'add',
      item: { id: expect.any(String), name: 'Goblin Idol', quantity: 1, description: '' },
    });
    expect(serverItems.map(i => i.name)).toEqual(['Goblin Idol', 'QA Concurrent Coin', 'QA Lantern']);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('a modal edit posts ONE update intent keyed by the row id', async () => {
    await renderReady();
    fireEvent.click(rowOf('QA Lantern').getByRole('button', { name: 'Edit item' }));
    const modal = (await screen.findByText('Edit QA Lantern')).closest('.pi-modal');
    fireEvent.change(within(modal).getByLabelText('Description'), { target: { value: 'cap is off' } });
    fireEvent.click(within(modal).getByRole('button', { name: /Save/ }));

    await waitFor(() => expect(mockApplyItemIntent).toHaveBeenCalledTimes(1));
    expect(mockApplyItemIntent).toHaveBeenCalledWith('test-campaign', {
      action: 'update',
      item: { id: 'a1', name: 'QA Lantern', quantity: 1, description: 'cap is off' },
    });
  });

  it('adding a name that matches a stored row posts update on THAT row (historic modal merge behaviour)', async () => {
    await renderReady();
    await addItem('QA Lantern', 4);
    await waitFor(() => expect(mockApplyItemIntent).toHaveBeenCalledTimes(1));
    expect(mockApplyItemIntent).toHaveBeenCalledWith('test-campaign', {
      action: 'update',
      item: { id: 'a1', name: 'QA Lantern', quantity: 4, description: '' },
    });
    // One row, quantity replaced — no duplicate row minted.
    expect(serverItems).toHaveLength(1);
    expect(serverItems[0]).toEqual({ id: 'a1', name: 'QA Lantern', quantity: 4, description: '' });
  });

  it('a delete posts ONE row-delete intent and its audit row lands post-ack', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderReady();
    serverItems.push({ id: 'coin1', name: 'QA Concurrent Coin', quantity: 1, description: '' });

    fireEvent.click(rowOf('QA Lantern').getByTitle('Delete item'));
    await waitFor(() => expect(mockApplyItemIntent).toHaveBeenCalledWith('test-campaign', {
      action: 'delete', id: 'a1', name: 'QA Lantern', previous: expect.anything(),
    }));
    await waitFor(() => expect(addEntry).toHaveBeenCalledTimes(1));
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'inventory_transfer',
      message: 'Removed "QA Lantern" from party inventory',
    }));
    // The concurrent window's row survived the delete (intent named only its target).
    expect(serverItems.map(i => i.name)).toEqual(['QA Concurrent Coin']);
    confirmSpy.mockRestore();
  });

  it('a setQty racing a concurrent delete 409s loudly and adopts the merged truth — no resurrection', async () => {
    await renderReady();
    // The other window's delete has landed on the server but the echo is undelivered.
    serverItems = [];

    fireEvent.click(rowOf('QA Lantern').getByLabelText('Increase quantity'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith(
      'Save failed: Party item "QA Lantern" was deleted in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.'
    ));
    // Stale view replaced by the merged doc: the ghost row is gone, nothing re-POSTed.
    expect(screen.queryByText('QA Lantern')).toBeNull();
    expect(mockApplyItemIntent).toHaveBeenCalledTimes(1);
    expect(addEntry).not.toHaveBeenCalled();
  });

  it('intents serialize FIFO — a held add is followed by the queued setQty, in click order', async () => {
    await renderReady();
    let resolveAdd = null;
    mockApplyItemIntent
      .mockImplementationOnce(() => new Promise(resolve => { resolveAdd = resolve; }))
      .mockImplementation(async (_c, intent) => applyIntent(intent));

    await addItem('QA Censer');
    await waitFor(() => expect(mockApplyItemIntent).toHaveBeenCalledTimes(1)); // add in flight
    // A step on the still-unacked optimistic row queues behind the add and resolves
    // the SAME locally-minted id (the server keeps client ids — no temp-id drift).
    const censerRow = await screen.findByText('QA Censer');
    fireEvent.click(within(censerRow.closest('tr')).getByLabelText('Increase quantity'));
    expect(mockApplyItemIntent).toHaveBeenCalledTimes(1); // serialized: nothing sent yet
    const addIntent = mockApplyItemIntent.mock.calls[0][1];
    const mergedOfAdd = applyIntent(addIntent);
    await act(async () => { resolveAdd(mergedOfAdd); });
    await waitFor(() => expect(mockApplyItemIntent).toHaveBeenCalledTimes(2));
    const [campaign, secondIntent] = mockApplyItemIntent.mock.calls[1];
    expect(campaign).toBe('test-campaign');
    expect(secondIntent.action).toBe('setQty');
    expect(secondIntent.quantity).toBe(2);
    expect(secondIntent.id).toBe(addIntent.item.id);
    await waitFor(() => {
      expect(serverItems.find(i => i.name === 'QA Censer').quantity).toBe(2);
    });
    expect(serverItems.map(i => i.name)).toEqual(['QA Censer', 'QA Lantern']);
    expect(alertSpy).not.toHaveBeenCalled();
  });
});
