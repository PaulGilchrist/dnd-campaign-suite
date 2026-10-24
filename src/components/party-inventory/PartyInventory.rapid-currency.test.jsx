// @maintained-by-ai: 2026-10-24
// Regression (bug-party-inventory-currency-rapid-click-collapse): rapid chip clicks in a
// single synchronous task each read the SAME stale closure snapshot of `inventory`, so
// +1×3 collapsed to +1 and +100×2 collapsed to +100 — every click POSTed the same
// collapsed full-store snapshot, silently dropping GM intent. Also pins the serialized
// persist queue: one in-flight POST per endpoint, burst coalesced into a trailing POST
// with the latest snapshot, and stale POST echoes dropped via revision stamp (playbook §39).
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';

const mockLoadInventory = vi.fn();
const mockSaveInventory = vi.fn();
let sseHandler = null;

vi.mock('../../services/campaign/inventoryService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadInventory: (...args) => mockLoadInventory(...args),
  saveInventory: (...args) => mockSaveInventory(...args),
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
  characters: [
    { name: 'War Cleric', inventory: { backpack: [], equipped: [], gold: 10, magicItems: [] } },
  ],
  onBack: vi.fn(),
};

const baseInventory = () => ({
  currency: { pp: 0, gp: 50, sp: 0, cp: 0 },
  items: [],
});

beforeEach(() => {
  mockLoadInventory.mockReset().mockResolvedValue(baseInventory());
  mockSaveInventory.mockReset().mockImplementation(async (_c, inv) => inv);
  sseHandler = null;
});

async function renderReady() {
  render(<PartyInventory {...defaultProps} />);
  await screen.findByText('Party Inventory');
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
  it('accumulates three same-frame +1 clicks to +3 in the UI and persists +3', async () => {
    await renderReady();
    tripleClick('Add 1 gp');

    // Every click lands immediately in the displayed balance: 50 + 3 = 53.
    expect(goldAmount()).toBe('53');

    // The burst sits behind the 400ms trailing debounce, then flushes as ONE POST of the
    // latest snapshot — never three identical collapsed POSTs.
    await waitFor(() => {
      expect(mockSaveInventory).toHaveBeenCalledTimes(1);
      expect(mockSaveInventory.mock.calls[0][1].currency.gp).toBe(53);
    });
    // Responses settling must not revert the display (stale echoes dropped).
    await waitFor(() => expect(goldAmount()).toBe('53'));
    mockSaveInventory.mock.calls.forEach(([, inv]) => expect(inv.currency.gp).toBeGreaterThanOrEqual(51));
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
      expect(mockSaveInventory).toHaveBeenCalledTimes(1);
      expect(mockSaveInventory.mock.calls[0][1].currency.gp).toBe(250);
    });
  });

  it('drops a stale POST echo when a newer local edit queues mid-flight', async () => {
    mockLoadInventory.mockResolvedValueOnce({
      currency: { pp: 0, gp: 50, sp: 0, cp: 0 },
      items: [{ id: 'i1', name: 'Rope, Hempen', quantity: 1, description: '' }],
    });
    await renderReady();
    // The debounced +1-burst flush hangs in flight carrying gp 51.
    let resolveFirst;
    mockSaveInventory.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
    fireEvent.click(screen.getByTitle('Add 1 gp'));
    await waitFor(() => expect(mockSaveInventory).toHaveBeenCalledTimes(1));

    // A newer edit queues behind the hang (currency chips are disabled mid-flight,
    // so the item stepper drives the queue).
    fireEvent.click(screen.getByLabelText('Increase quantity'));
    expect(goldAmount()).toBe('51');
    expect(mockSaveInventory).toHaveBeenCalledTimes(1); // never posts early

    // The hung POST lands LAST with its OLD full-store snapshot (gp 50 / qty 1) — a
    // classic replace-route reorder. It must be ignored, never resurrected over 51/2.
    await act(async () => {
      resolveFirst({ currency: { pp: 0, gp: 50, sp: 0, cp: 0 }, items: [{ id: 'i1', name: 'Rope, Hempen', quantity: 1, description: '' }] });
    });
    await waitFor(() => {
      expect(mockSaveInventory).toHaveBeenCalledTimes(2);
      expect(mockSaveInventory.mock.calls[1][1].currency.gp).toBe(51);
      expect(mockSaveInventory.mock.calls[1][1].items[0].quantity).toBe(2);
    });
    expect(goldAmount()).toBe('51');
  });

  it('clamps subtract clicks at zero', async () => {
    await renderReady();
    // Chips are disabled while a POST is in flight — wait for re-enable between clicks.
    for (let i = 0; i < 5; i++) {
      await waitFor(() => expect(screen.getByTitle('Remove 10 gp').disabled).toBe(false));
      fireEvent.click(screen.getByTitle('Remove 10 gp'));
    }
    await waitFor(() => expect(goldAmount()).toBe('0'));
    expect(screen.getByTitle('Remove 10 gp').disabled).toBe(true);
    await waitFor(() => {
      mockSaveInventory.mock.calls.forEach(([, inv]) => expect(inv.currency.gp).toBeGreaterThanOrEqual(0));
    });
  });

  it('live-updates from SSE without clobbering the amount chip semantics', async () => {
    await renderReady();
    const next = baseInventory();
    next.currency.gp = 400;
    await act(async () => {
      sseHandler({ key: 'inventory-test-campaign', data: next });
    });
    expect(await within(screen.getByText('Gold').closest('.pi-currency-row')).findByText('400')).toBeTruthy();
    // Adjustments after an SSE adoption build on the adopted value.
    fireEvent.click(screen.getByTitle('Add 1 gp'));
    await waitFor(() => expect(goldAmount()).toBe('401'));
  });
});
