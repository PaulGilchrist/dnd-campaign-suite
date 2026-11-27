// @maintained-by-ai 2026-11-26
// Core-view smoke tests for PartyInventory. Lane-level behaviors live in the
// sibling suites: currency chips/debounce (chip-delta-lane, currency-debounce,
// rapid-currency), move/give confirms (move-confirmation, give-confirmation),
// add/edit/delete intents + reconcile (item-intent-lane, delete-item-log,
// failed-save-reconcile, stale-save-banner), labels (row-labels), autofill
// (equipment-autofill), read-only view (localhost-readonly), modal background
// (modal-background), player purse (player-currency).
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';

const mockLoadInventory = vi.fn();
const mockApplyItemIntent = vi.fn();
const mockAdjustCurrency = vi.fn();
const mockTransferInventory = vi.fn();
let sseHandler = null;

vi.mock('../../services/campaign/inventoryService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadInventory: (...args) => mockLoadInventory(...args),
  applyItemIntent: (...args) => mockApplyItemIntent(...args),
  adjustCurrency: (...args) => mockAdjustCurrency(...args),
  transferInventory: (...args) => mockTransferInventory(...args),
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
  loadEquipment: vi.fn().mockResolvedValue([
    { index: 'rope-hempen', name: 'Rope, Hempen', equipment_category: 'Adventuring Gear', description: ['50 feet of hempen rope.'] },
    { index: 'torch', name: 'Torch', equipment_category: 'Adventuring Gear', description: ['Burns for 1 hour.'] },
  ]),
}));

const defaultProps = {
  campaignName: 'test-campaign',
  isLocalhost: true,
  characters: [
    {
      name: 'War Cleric',
      inventory: {
        backpack: ["Thieves' Tools", 'Rope, Hempen'],
        equipped: ['Mace'],
        gold: 10,
        magicItems: [],
        itemMeta: { 'Rope, Hempen': { quantity: 3, description: '50 ft' } },
      },
    },
  ],
};

// Server shape: items arrive deliberately UNsorted (Torch before Antitoxin) so
// the view's name sort is observable.
const baseInventory = () => ({
  currency: { pp: 1, gp: 50, sp: 20, cp: 0 },
  items: [
    { id: 'i2', name: 'Torch', quantity: 5, description: '' },
    { id: 'i1', name: 'Antitoxin', quantity: 1, description: 'venom' },
  ],
});

beforeEach(() => {
  mockLoadInventory.mockReset().mockResolvedValue(baseInventory());
  mockApplyItemIntent.mockReset().mockResolvedValue(baseInventory());
  mockAdjustCurrency.mockReset().mockResolvedValue(baseInventory());
  mockTransferInventory.mockReset().mockResolvedValue({ inventory: baseInventory() });
  sseHandler = null;
});

async function renderReady(props = defaultProps) {
  const result = render(<PartyInventory {...props} />);
  await screen.findByText('Party Inventory');
  return result;
}

describe('PartyInventory', () => {
  it('renders currency totals and items sorted by name', async () => {
    await renderReady();
    const card = screen.getByText('Party Currency').closest('.pi-currency-card');
    expect(within(card).getByText('50')).toBeTruthy();
    const rows = screen.getAllByRole('row');
    const itemNames = rows.slice(1).map(r => r.cells[0].textContent.trim());
    expect(itemNames).toEqual(['Antitoxin', 'Torch']);
  });

  it('lists the selected player backpack with itemMeta quantities and a ×1 default', async () => {
    await renderReady();
    fireEvent.change(screen.getByLabelText('Choose player'), { target: { value: 'War Cleric' } });
    expect(await screen.findByText("Thieves' Tools")).toBeTruthy();
    // itemMeta quantity drives the row's default move amount…
    expect(screen.getByRole('button', {
      name: 'Move 3 × Rope, Hempen from War Cleric to party inventory', exact: true,
    })).toBeInTheDocument();
    // …and a backpack entry with no itemMeta at all defaults to 1.
    expect(screen.getByRole('button', {
      name: "Move 1 × Thieves' Tools from War Cleric to party inventory", exact: true,
    })).toBeInTheDocument();
  });

  it('offers equipment suggestions while typing a new item name and fills its description', async () => {
    await renderReady();
    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));
    const nameInput = screen.getByLabelText(/Name/);
    fireEvent.focus(nameInput);
    fireEvent.change(nameInput, { target: { value: 'Rope' } });
    const suggestion = await screen.findByText('Rope, Hempen');
    fireEvent.mouseDown(suggestion);
    expect(nameInput.value).toBe('Rope, Hempen');
    const desc = screen.getByLabelText('Description');
    await waitFor(() => expect(desc.value).toContain('hempen rope'));
  });

  it('live-updates the item table from SSE inventory events', async () => {
    await renderReady();
    const next = baseInventory();
    next.items = next.items.filter(i => i.name !== 'Antitoxin');
    next.items.push({ id: 'i3', name: 'Ziggurat Map', quantity: 1, description: '' });
    await act(async () => {
      sseHandler({ key: 'inventory-test-campaign', data: next });
    });
    // Additions and removals from another window's write both repaint here.
    expect(await screen.findByText('Ziggurat Map')).toBeTruthy();
    expect(screen.queryByText('Antitoxin')).not.toBeInTheDocument();
  });
});
