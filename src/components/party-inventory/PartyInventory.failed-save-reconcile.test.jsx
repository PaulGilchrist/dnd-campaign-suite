// @maintained-by-ai: 2026-11-17
// Regression (backlog FH): a non-409 save failure used to leave the optimistic row
// drifted — only the DELETE intent rolled back via intent.previous, so a failed stepper
// press kept showing qty 2 while the server held 1, with no convergence affordance until
// reload; the next setQty is ABSOLUTE, so it silently adopted the drift as new truth.
// The flushPersist catch now reconciles the intent's row back to the last known SERVER
// snapshot (serverSnapshotRef — fed only by load/ack/SSE/409-adoption/transfer results,
// never an optimistic local edit). A failed add whose id the server never learned is a
// phantom row and drops. Delete keeps its own intent.previous rollback untouched.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';

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

// Minimal fake ledger: only the setQty family needs real merge semantics here
// (snapshot-freshness + no-drift-adoption proofs); failures reject BEFORE the
// ledger is ever touched, which is itself the "server never absorbed it" proof.
let serverItems;

function applyIntent(intent) {
  if (intent.action === 'setQty') {
    const target = serverItems.find(i => i.id === intent.id);
    if (target) target.quantity = intent.quantity;
  } else if (intent.action === 'update') {
    const index = serverItems.findIndex(i => i.id === intent.item.id);
    if (index >= 0) {
      serverItems[index] = { ...serverItems[index], ...intent.item };
    }
  } else if (intent.action === 'delete') {
    serverItems = serverItems.filter(i => i.id !== intent.id);
  }
  return { currency: { ...CURRENCY }, items: serverItems.map(i => ({ ...i })) };
}

function serverError(message = 'disk on fire') {
  const error = new Error(message);
  error.status = 500;
  return error;
}

async function renderReady() {
  render(<PartyInventory {...defaultProps} />);
  await screen.findByText('Party Inventory');
}

function rowOf(name) {
  return within(screen.getByText(name).closest('tr'));
}

function qtyOf(name) {
  return rowOf(name).getByLabelText('Quantity').value;
}

beforeEach(() => {
  serverItems = [{ ...lantern }];
  mockLoadInventory.mockReset().mockResolvedValue({ currency: { ...CURRENCY }, items: [{ ...lantern }] });
  mockApplyItemIntent.mockReset().mockImplementation(async (_c, intent) => applyIntent(intent));
});

describe('PartyInventory failed-save reconcile (drift-convergence backlog)', () => {
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

  it('a failed stepper press still alerts verbatim AND reconciles the row back to the server qty', async () => {
    mockApplyItemIntent.mockRejectedValueOnce(serverError());
    await renderReady();

    fireEvent.click(rowOf('QA Lantern').getByLabelText('Increase quantity of QA Lantern'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Save failed: disk on fire'));
    // No reload: the row converges to the last known server snapshot (1), not the
    // optimistic 2 — and the fake ledger was never touched (no POST applied).
    await waitFor(() => expect(qtyOf('QA Lantern')).toBe('1'));
    expect(serverItems[0].quantity).toBe(1);
  });

  it('after a failed setQty the NEXT press is built on the reconciled base — drift is never adopted', async () => {
    mockApplyItemIntent
      .mockRejectedValueOnce(serverError())
      .mockImplementation(async (_c, intent) => applyIntent(intent));
    await renderReady();

    fireEvent.click(rowOf('QA Lantern').getByLabelText('Increase quantity of QA Lantern'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(qtyOf('QA Lantern')).toBe('1'));

    // Re-press: absolute setQty derived from the RECONCILED qty (1 + 1 = 2), not the
    // stale optimistic 2 + 1 = 3 the pre-fix view would have shown.
    fireEvent.click(rowOf('QA Lantern').getByLabelText('Increase quantity of QA Lantern'));
    await waitFor(() => expect(mockApplyItemIntent).toHaveBeenCalledTimes(2));
    expect(mockApplyItemIntent.mock.calls[1][1]).toEqual({
      action: 'setQty', id: 'a1', quantity: 2, name: 'QA Lantern',
    });
    await waitFor(() => expect(qtyOf('QA Lantern')).toBe('2'));
    expect(serverItems[0].quantity).toBe(2);
  });

  it('reconcile uses the LATEST snapshot — a failed step lands on the last COMMITTED qty, not the load-time one', async () => {
    mockApplyItemIntent
      .mockImplementationOnce(async (_c, intent) => applyIntent(intent))
      .mockRejectedValueOnce(serverError());
    await renderReady();

    fireEvent.click(rowOf('QA Lantern').getByLabelText('Increase quantity of QA Lantern'));
    await waitFor(() => expect(qtyOf('QA Lantern')).toBe('2')); // acked, snapshot now qty 2

    fireEvent.click(rowOf('QA Lantern').getByLabelText('Increase quantity of QA Lantern'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Save failed: disk on fire'));
    // Rolls back to 2 (server truth after the first success), not to 1 (load-time doc).
    await waitFor(() => expect(qtyOf('QA Lantern')).toBe('2'));
    expect(serverItems[0].quantity).toBe(2);
  });

  it('a failed item edit restores the pre-edit server values, not the uncommitted edit', async () => {
    mockApplyItemIntent.mockRejectedValueOnce(serverError());
    await renderReady();

    fireEvent.click(rowOf('QA Lantern').getByRole('button', { name: 'Edit item' }));
    const modal = (await screen.findByText('Edit QA Lantern')).closest('.pi-modal');
    fireEvent.change(within(modal).getByLabelText(/Name/), { target: { value: 'QA Ghost Lantern' } });
    fireEvent.change(within(modal).getByLabelText('Quantity'), { target: { value: '7' } });
    fireEvent.click(within(modal).getByRole('button', { name: /Save/ }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Save failed: disk on fire'));
    // The drifted row is gone and the server row is back, name AND quantity intact.
    await waitFor(() => expect(screen.getByText('QA Lantern')).toBeTruthy());
    expect(screen.queryByText('QA Ghost Lantern')).toBeNull();
    expect(qtyOf('QA Lantern')).toBe('1');
    expect(mockApplyItemIntent).toHaveBeenCalledWith('test-campaign', {
      action: 'update',
      item: { id: 'a1', name: 'QA Ghost Lantern', quantity: 7, description: 'steady flame' },
    });
    expect(serverItems[0]).toEqual({ ...lantern });
  });

  it('failed delete keeps its intent.previous rollback — row re-appears, Delete failed alert', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockApplyItemIntent.mockRejectedValueOnce(serverError('vault locked'));
    await renderReady();

    fireEvent.click(rowOf('QA Lantern').getByTitle('Delete item'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Delete failed: vault locked'));
    await waitFor(() => expect(screen.getByText('QA Lantern')).toBeTruthy());
    expect(serverItems.map(i => i.name)).toEqual(['QA Lantern']);
    confirmSpy.mockRestore();
  });

  it('a failed add drops its phantom row — the server never learned that id', async () => {
    mockApplyItemIntent.mockRejectedValueOnce(serverError());
    await renderReady();

    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));
    const nameInput = await screen.findByLabelText(/Name/);
    fireEvent.change(nameInput, { target: { value: 'QA Ghost Censer' } });
    const modal = nameInput.closest('.pi-modal');
    fireEvent.click(within(modal).getByRole('button', { name: /Save/ }));

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Save failed: disk on fire'));
    await waitFor(() => expect(screen.queryByText('QA Ghost Censer')).toBeNull());
    // The pre-existing server row is untouched by the phantom drop.
    expect(screen.getByText('QA Lantern')).toBeTruthy();
    expect(serverItems.map(i => i.name)).toEqual(['QA Lantern']);
  });
});
