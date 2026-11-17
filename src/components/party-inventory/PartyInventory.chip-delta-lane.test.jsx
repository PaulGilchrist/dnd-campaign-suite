// @maintained-by-ai: 2026-11-17
// Regression (bug-inventory-chip-cross-tab-full-doc-clobber): currency-chip writes used
// to POST the tab's WHOLE inventory snapshot through the 400ms trailing debounce, so two
// GM windows pressing within the debounce window each carried only their own view and
// the later full-doc POST silently erased the earlier press (2×+1 cp → 1; +100 gp ∥
// +10 cp → one face evaporated, zero feedback, zero audit). The chip lane is now an
// additive signed-delta flush on the atomic server /adjust route: every press lands on
// the SERVER's current ledger, and every accepted batch writes an audit row.
// The server-side additive/clamp law is pinned in server/routes/inventory.test.js.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';
import { addEntry } from '../../services/ui/logService.js';

const mockLoadInventory = vi.fn();
const mockSavePartyItems = vi.fn();
const mockAdjustCurrency = vi.fn();
let sseHandler = null;

vi.mock('../../services/campaign/inventoryService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadInventory: (...args) => mockLoadInventory(...args),
  savePartyItems: (...args) => mockSavePartyItems(...args),
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
  characters: [],
};

// Fake server ledger mirroring the real /adjust route: clamped-and-added onto the
// CURRENT server currency, items never touched, merged doc echoed back.
let serverCurrency;

beforeEach(() => {
  serverCurrency = { pp: 0, gp: 50, sp: 0, cp: 0 };
  mockLoadInventory.mockReset().mockImplementation(async () => ({
    currency: { ...serverCurrency },
    items: [],
  }));
  mockSavePartyItems.mockReset().mockImplementation(async (_c, items) => ({ currency: { ...serverCurrency }, items }));
  mockAdjustCurrency.mockReset().mockImplementation(async (_c, amount) => {
    for (const key of ['pp', 'gp', 'sp', 'cp']) {
      serverCurrency[key] = Math.max(0, serverCurrency[key] + (amount[key] || 0));
    }
    return { currency: { ...serverCurrency }, items: [] };
  });
  addEntry.mockReset().mockResolvedValue(undefined);
  sseHandler = null;
});

async function renderReady() {
  render(<PartyInventory {...defaultProps} />);
  await screen.findByText('Party Currency');
}

function coinRow(label) {
  return screen.getByText(label).closest('.pi-currency-row');
}

function coinAmount(label) {
  return coinRow(label).querySelector('.pi-currency-amount').textContent;
}

// Real timers: let the 400 ms trailing debounce elapse plus the response chain settle.
async function pastDebounceAsync() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 500));
  });
}

describe('PartyInventory chip delta lane (cross-tab clobber regression)', () => {
  it('a burst after a remote echo posts the +1 DELTA again — never a whole-document snapshot', async () => {
    await renderReady();
    // Window-A first press: +1 cp flushed as a delta.
    fireEvent.click(screen.getByTitle('Add 1 cp'));
    await waitFor(() => expect(mockAdjustCurrency).toHaveBeenCalledTimes(1));
    expect(mockAdjustCurrency.mock.calls[0][1]).toEqual({ pp: 0, gp: 0, sp: 0, cp: 1 });
    // The merged server doc echoes back (cp 1) — exactly what the OTHER window's
    // SSE-adopted view now shows.
    await act(async () => {
      sseHandler({ key: 'inventory-test-campaign', data: { currency: { ...serverCurrency }, items: [] } });
    });
    expect(coinAmount('Copper')).toBe('1');
    // Window-A second press: must POST { cp: 1 } AGAIN (additive), not the cp:2
    // snapshot — a snapshot would clobber window B's concurrent press.
    fireEvent.click(screen.getByTitle('Add 1 cp'));
    await waitFor(() => expect(mockAdjustCurrency).toHaveBeenCalledTimes(2));
    expect(mockAdjustCurrency.mock.calls[1][1]).toEqual({ pp: 0, gp: 0, sp: 0, cp: 1 });
    // Both ledger writes landed additively on the fake server: 2×+1 cp → 2.
    expect(serverCurrency.cp).toBe(2);
    // Chips NEVER touch the full-document items lane.
    expect(mockSavePartyItems).not.toHaveBeenCalled();
  });

  it('merges a mixed-sign burst into ONE net signed delta', async () => {
    await renderReady();
    act(() => {
      screen.getByTitle('Add 10 gp').click();
      screen.getByTitle('Remove 1 gp').click();
    });
    expect(coinAmount('Gold')).toBe('59');
    await waitFor(() => {
      expect(mockAdjustCurrency).toHaveBeenCalledTimes(1);
      expect(mockAdjustCurrency.mock.calls[0][1]).toEqual({ pp: 0, gp: 9, sp: 0, cp: 0 });
    });
    expect(serverCurrency.gp).toBe(59);
  });

  it('a removal chip above the balance is honestly gated — zero POSTs, zero rows', async () => {
    mockLoadInventory.mockResolvedValueOnce({ currency: { pp: 0, gp: 0, sp: 0, cp: 5 }, items: [] });
    serverCurrency.cp = 5;
    await renderReady();
    const remove10 = screen.getByTitle('Remove 10 cp');
    expect(remove10.disabled).toBe(true); // 5 < 10 — the DOM gate, mirrored by the delta queue
    fireEvent.click(remove10);
    await pastDebounceAsync();
    expect(mockAdjustCurrency).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(coinAmount('Copper')).toBe('5');
  });

  it('every accepted batch writes exactly one audit row naming the signed per-coin deltas', async () => {
    await renderReady();
    act(() => {
      screen.getByTitle('Add 100 gp').click();
      screen.getByTitle('Remove 1 cp').click();
    });
    await waitFor(() => {
      expect(addEntry).toHaveBeenCalledTimes(1);
    });
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'inventory_transfer',
      message: 'Party currency adjusted: +100 gp',
    }));
    // The −1 cp chip is honestly disabled at the zero floor — no POST, no row.
    expect(mockAdjustCurrency).toHaveBeenCalledTimes(1);
    expect(mockAdjustCurrency.mock.calls[0][1]).toEqual({ pp: 0, gp: 100, sp: 0, cp: 0 });
  });

  it('a rejected flush fails loudly (console.error + alert) and writes no audit row', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mockAdjustCurrency.mockRejectedValueOnce(new Error('adjust down'));
    await renderReady();
    fireEvent.click(screen.getByTitle('Add 1 gp'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Currency save failed: adjust down'));
    expect(addEntry).not.toHaveBeenCalled();
    const appLines = consoleSpy.mock.calls.filter(args => String(args[0]).startsWith('[PartyInventory]'));
    expect(appLines).toHaveLength(1);
    consoleSpy.mockRestore();
    alertSpy.mockRestore();
  });
});
