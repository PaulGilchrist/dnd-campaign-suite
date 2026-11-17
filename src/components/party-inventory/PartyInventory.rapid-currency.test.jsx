// @maintained-by-ai: 2026-11-17
// Regression (bug-party-inventory-currency-rapid-click-collapse): rapid chip clicks in a
// single synchronous task each read the SAME stale closure snapshot of `inventory`, so
// +1×3 collapsed to +1 and +100×2 collapsed to +100 — every click POSTed the same
// collapsed snapshot, silently dropping GM intent. The burst now sits behind the 400ms
// trailing debounce and flushes as ONE signed per-coin DELTA on the atomic /adjust lane
// (bug-inventory-chip-cross-tab-full-doc-clobber: the whole-document snapshot POST is
// gone — two GM windows pressing in the same window land additively server-side).
// Also pins the serialized items queue: one in-flight intent POST per endpoint, stale
// POST echoes dropped via revision stamp (playbook §39).
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';

const mockLoadInventory = vi.fn();
const mockApplyItemIntent = vi.fn();
const mockAdjustCurrency = vi.fn();
let sseHandler = null;

vi.mock('../../services/campaign/inventoryService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadInventory: (...args) => mockLoadInventory(...args),
  applyItemIntent: (...args) => mockApplyItemIntent(...args),
  adjustCurrency: (...args) => mockAdjustCurrency(...args),
  transferInventory: vi.fn(),
}));

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: (_campaign, handler) => {
    sseHandler = handler;
    return () => { sseHandler = null; };
  },
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
  characters: [
    { name: 'War Cleric', inventory: { backpack: [], equipped: [], gold: 10, magicItems: [] } },
  ],
};

const baseInventory = () => ({
  currency: { pp: 0, gp: 50, sp: 0, cp: 0 },
  items: [],
});

// Fake server ledger: adjust behaves like the real route — clamped-and-added onto
// the CURRENT server currency, the same merged document then SSE-echoes back.
let serverCurrency;
let serverItems;

beforeEach(() => {
  serverCurrency = { ...baseInventory().currency };
  serverItems = [];
  mockLoadInventory.mockReset().mockImplementation(async () => ({
    currency: { ...serverCurrency },
    items: serverItems,
  }));
  mockApplyItemIntent.mockReset().mockImplementation(async (_c, intent) => {
    if (intent.action === 'setQty') serverItems = serverItems.map(i => i.id === intent.id ? { ...i, quantity: intent.quantity } : i);
    else if (intent.action === 'delete') serverItems = serverItems.filter(i => i.id !== intent.id);
    else serverItems = [...serverItems, intent.item];
    return { currency: { ...serverCurrency }, items: serverItems };
  });
  mockAdjustCurrency.mockReset().mockImplementation(async (_c, amount) => {
    for (const key of ['pp', 'gp', 'sp', 'cp']) {
      serverCurrency[key] = Math.max(0, serverCurrency[key] + (amount[key] || 0));
    }
    return { currency: { ...serverCurrency }, items: serverItems };
  });
  sseHandler = null;
});

async function renderReady() {
  render(<PartyInventory {...defaultProps} />);
  await screen.findByText('Party Currency');
}

function goldAmount() {
  return screen.getByText('Gold').closest('.pi-currency-row').querySelector('.pi-currency-amount').textContent;
}

// Three clicks dispatched inside ONE synchronous block: React batches the updates, so the
// handler closure is identical across all three — this is the exact live repro (page.evaluate
// b.click(); b.click(); b.click()) that collapsed +1×3 → +1 on the stale-closure build.
function tripleClick(title) {
  const button = screen.getByTitle(title);
  act(() => {
    button.click();
    button.click();
    button.click();
  });
}

describe('PartyInventory rapid currency clicks', () => {
  it('accumulates three same-frame +1 clicks to +3 in the UI and persists +3 as a delta', async () => {
    await renderReady();
    tripleClick('Add 1 gp');

    // Every click lands immediately in the displayed balance: 50 + 3 = 53.
    expect(goldAmount()).toBe('53');

    // The burst sits behind the 400ms trailing debounce, then flushes as ONE signed
    // delta POST — never a document snapshot, never three collapsed POSTs.
    await waitFor(() => {
      expect(mockAdjustCurrency).toHaveBeenCalledTimes(1);
      expect(mockAdjustCurrency.mock.calls[0][1]).toEqual({ pp: 0, gp: 3, sp: 0, cp: 0 });
    });
    // The chip lane must never touch the item-intent lane.
    expect(mockApplyItemIntent).not.toHaveBeenCalled();
    // And the fake server ledger converges additively: 50 + 3 = 53.
    await waitFor(() => expect(serverCurrency.gp).toBe(53));
  });

  it('accumulates two same-frame +100 clicks to +200', async () => {
    await renderReady();
    const button = screen.getByTitle('Add 100 gp');
    act(() => {
      button.click();
      button.click();
    });
    expect(goldAmount()).toBe('250');
    await waitFor(() => {
      expect(mockAdjustCurrency).toHaveBeenCalledTimes(1);
      expect(mockAdjustCurrency.mock.calls[0][1].gp).toBe(200);
    });
  });

  it('merges a hanging currency flush with a concurrent item edit — both lanes land', async () => {
    mockLoadInventory.mockResolvedValueOnce({
      currency: { pp: 0, gp: 50, sp: 0, cp: 0 },
      items: [{ id: 'i1', name: 'Rope, Hempen', quantity: 1, description: '' }],
    });
    serverItems = [{ id: 'i1', name: 'Rope, Hempen', quantity: 1, description: '' }];
    await renderReady();
    // The debounced +1-burst flush hangs in flight carrying delta gp 1.
    let resolveAdjust;
    mockAdjustCurrency.mockImplementationOnce(() => new Promise(resolve => { resolveAdjust = resolve; }));
    fireEvent.click(screen.getByTitle('Add 1 gp'));
    await waitFor(() => expect(mockAdjustCurrency).toHaveBeenCalledTimes(1));

    // A newer ITEM edit rides its own queue independently — the currency delta lane
    // can never block or clobber it (the old shared full-doc queue made it wait).
    // It posts ONE setQty intent, not an item-list snapshot.
    fireEvent.click(screen.getByLabelText('Increase quantity'));
    await waitFor(() => expect(mockApplyItemIntent).toHaveBeenCalledTimes(1));
    expect(mockApplyItemIntent.mock.calls[0][1]).toEqual({ action: 'setQty', id: 'i1', quantity: 2, name: 'Rope, Hempen' });

    // The hung adjust lands LAST: the server applied +1 onto ITS ledger and the SSE
    // echo carries the merged truth (gp 51, qty 2) — both lanes converge additively,
    // and the adjust's now-stale ack (revision moved) is dropped, never resurrecting
    // the pre-edit view (playbook §39 guard).
    await act(async () => {
      serverCurrency.gp = 51;
      const merged = { currency: { ...serverCurrency }, items: serverItems };
      resolveAdjust(merged);
      sseHandler({ key: 'inventory-test-campaign', data: merged });
    });
    expect(goldAmount()).toBe('51');
    expect(screen.getByLabelText('Quantity').value).toBe('2');
  });

  it('clamps subtract clicks at zero and flushes one negative delta', async () => {
    await renderReady();
    // Five same-frame-rate −10 presses from 50 merge into ONE burst flush of −50.
    const button = screen.getByTitle('Remove 10 gp');
    act(() => {
      for (let i = 0; i < 5; i++) button.click();
    });
    await waitFor(() => expect(goldAmount()).toBe('0'));
    await waitFor(() => {
      expect(mockAdjustCurrency).toHaveBeenCalledTimes(1);
      expect(mockAdjustCurrency.mock.calls[0][1]).toEqual({ pp: 0, gp: -50, sp: 0, cp: 0 });
    });
    // The floor chip stays honestly disabled at zero, and the ledger never went below.
    expect(screen.getByTitle('Remove 10 gp').disabled).toBe(true);
    expect(serverCurrency.gp).toBe(0);
  });

  it('live-updates from SSE without clobbering the amount chip semantics', async () => {
    await renderReady();
    const next = baseInventory();
    next.currency.gp = 400;
    serverCurrency.gp = 400; // the echo came FROM the server ledger
    await act(async () => {
      sseHandler({ key: 'inventory-test-campaign', data: next });
    });
    expect(await within(screen.getByText('Gold').closest('.pi-currency-row')).findByText('400')).toBeTruthy();
    // Adjustments after an SSE adoption build on the adopted value — and the flush
    // posts the +1 DELTA, never the 401 snapshot.
    fireEvent.click(screen.getByTitle('Add 1 gp'));
    await waitFor(() => expect(goldAmount()).toBe('401'));
    await waitFor(() => {
      expect(mockAdjustCurrency).toHaveBeenCalledTimes(1);
      expect(mockAdjustCurrency.mock.calls[0][1]).toEqual({ pp: 0, gp: 1, sp: 0, cp: 0 });
    });
  });
});
