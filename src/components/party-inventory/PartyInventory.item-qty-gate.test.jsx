// @maintained-by-ai 2026-11-24: 2026-11-24
// QA backlog 2026-11-24 (improve party-inventory-qty-silent-normalize): #pi-item-qty
// silently rewrote invalid input — 0/−3/1.5/blank became 1 at the keystroke AND again
// before the POST, so the user typed a number and stored a different one with zero
// feedback. The chosen face mirrors the blank-name gate: the field keeps whatever was
// typed and Save stays DISABLED until Quantity is a whole number ≥ 1. A non-positive-
// integer can therefore never reach the intent lane — nothing to silently normalize.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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

let serverItems;

function applyIntent(intent) {
  if (intent.action === 'add' || intent.action === 'update') {
    const row = { name: intent.item.name, quantity: intent.item.quantity, description: intent.item.description };
    const index = serverItems.findIndex(i => i.id === intent.item.id);
    if (index >= 0) serverItems[index] = { ...serverItems[index], ...row };
    else serverItems.push({ id: intent.item.id, ...row });
  } else if (intent.action === 'setQty') {
    serverItems.find(i => i.id === intent.id).quantity = intent.quantity;
  }
  return { currency: { ...CURRENCY }, items: serverItems.map(i => ({ ...i })) };
}

async function renderReady() {
  render(<PartyInventory {...defaultProps} />);
  await screen.findByText('Party Inventory');
}

// Row steppers share the 'Quantity' accessible name — reach the editor through its
// role=dialog (aria-labelledby = pi-item-title) and scope every field query to it.
async function openEditor(title) {
  const modal = await screen.findByRole('dialog', { name: title });
  return {
    modal,
    qty: within(modal).getByLabelText('Quantity'),
    name: within(modal).getByLabelText(/Name/),
    save: within(modal).getByRole('button', { name: /Save/ }),
  };
}

async function openAddEditor() {
  fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));
  return openEditor('Add Item');
}

async function openEditEditor() {
  fireEvent.click(within(screen.getByText('QA Lantern').closest('tr')).getByRole('button', { name: 'Edit "QA Lantern"', exact: true }));
  return openEditor('Edit QA Lantern');
}

beforeEach(() => {
  serverItems = [{ ...lantern }];
  mockLoadInventory.mockReset().mockResolvedValue({ currency: { ...CURRENCY }, items: [{ ...lantern }] });
  mockApplyItemIntent.mockReset().mockImplementation(async (_c, intent) => applyIntent(intent));
  addEntry.mockReset().mockResolvedValue(undefined);
});

describe('PartyInventory item-quantity Save gate (no silent normalization)', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('Add Item: every invalid qty keeps the field VERBATIM, disables Save, and clicking it posts nothing', async () => {
    await renderReady();
    const { qty, name, save } = await openAddEditor();
    fireEvent.change(name, { target: { value: 'QA Gate Probe' } });

    for (const bad of ['0', '-3', '1.5', '']) {
      fireEvent.change(qty, { target: { value: bad } });
      // No silent rewrite: the field still shows exactly what was typed.
      expect(qty.value).toBe(bad);
      expect(save.disabled).toBe(true);
      // Disabled form controls swallow the click: the POST lane never arms.
      fireEvent.click(save);
      expect(mockApplyItemIntent).not.toHaveBeenCalled();
    }
  });

  it('Add Item: a whole number ≥ 1 re-enables Save and posts the EXACT typed integer as a number', async () => {
    await renderReady();
    const { qty, name, save } = await openAddEditor();
    fireEvent.change(name, { target: { value: 'QA Gate Probe' } });
    fireEvent.change(qty, { target: { value: '0' } });
    expect(save.disabled).toBe(true);

    fireEvent.change(qty, { target: { value: '3' } });
    expect(qty.value).toBe('3');
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => expect(mockApplyItemIntent).toHaveBeenCalledTimes(1));
    expect(mockApplyItemIntent).toHaveBeenCalledWith('test-campaign', {
      action: 'add',
      item: { id: expect.any(String), name: 'QA Gate Probe', quantity: 3, description: '' },
    });
    expect(serverItems.find(i => i.name === 'QA Gate Probe').quantity).toBe(3);
  });

  it('Add Item: the mirrored blank-name half of the gate still holds (control)', async () => {
    await renderReady();
    const { qty, name, save } = await openAddEditor();
    // qty valid, name blank/whitespace-only → Save stays disabled (same idiom).
    fireEvent.change(qty, { target: { value: '2' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(name, { target: { value: '   ' } });
    expect(save.disabled).toBe(true);
    fireEvent.change(name, { target: { value: 'QA Gate Probe' } });
    expect(save.disabled).toBe(false);
  });

  it('Edit item: identical gate on the same field — invalid qty posts nothing, a valid one updates the row', async () => {
    await renderReady();
    const { qty, save } = await openEditEditor();
    // Seeded from the row as the number 1; the field reads back intact.
    expect(qty.value).toBe('1');

    for (const bad of ['0', '-3', '1.5', '']) {
      fireEvent.change(qty, { target: { value: bad } });
      expect(qty.value).toBe(bad);
      expect(save.disabled).toBe(true);
      fireEvent.click(save);
    }
    expect(mockApplyItemIntent).not.toHaveBeenCalled();

    fireEvent.change(qty, { target: { value: '4' } });
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => expect(mockApplyItemIntent).toHaveBeenCalledWith('test-campaign', {
      action: 'update',
      item: { id: 'a1', name: 'QA Lantern', quantity: 4, description: 'steady flame' },
    }));
    expect(serverItems.find(i => i.id === 'a1').quantity).toBe(4);
  });
});
