// @maintained-by-ai: 2026-10-14
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';

const mockLoadInventory = vi.fn();
const mockSaveInventory = vi.fn();
const mockTransferInventory = vi.fn();
let sseHandler = null;

vi.mock('../../services/campaign/inventoryService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadInventory: (...args) => mockLoadInventory(...args),
  saveInventory: (...args) => mockSaveInventory(...args),
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

const baseInventory = () => ({
  currency: { pp: 1, gp: 50, sp: 20, cp: 0 },
  items: [
    { id: 'i2', name: 'Torch', quantity: 5, description: '' },
    { id: 'i1', name: 'Antitoxin', quantity: 1, description: 'venom' },
  ],
});

beforeEach(() => {
  mockLoadInventory.mockReset().mockResolvedValue(baseInventory());
  mockSaveInventory.mockReset().mockImplementation(async (_c, inv) => inv);
  mockTransferInventory.mockReset().mockResolvedValue({ inventory: baseInventory(), character: { name: 'War Cleric', inventory: {} } });
  sseHandler = null;
});

async function renderReady(props = defaultProps) {
  const result = render(<PartyInventory {...props} />);
  await screen.findByText('Party Inventory');
  return result;
}

async function selectPlayer(name) {
  fireEvent.change(screen.getByLabelText('Choose player'), { target: { value: name } });
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

  it('adds currency via stepper chips without the user computing the total', async () => {
    await renderReady();
    fireEvent.click(screen.getByTitle('Add 10 gp'));
    await waitFor(() => {
      expect(mockSaveInventory).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        currency: expect.objectContaining({ gp: 60 }),
      }));
    });
  });

  it('disables the remove chip when it would go below zero', async () => {
    await renderReady();
    expect(screen.getByTitle('Remove 100 cp').disabled).toBe(true);
    expect(screen.getByTitle('Remove 10 sp').disabled).toBe(false);
  });

  it('gives item-row action buttons aria-labels matching their titles', async () => {
    await renderReady();
    const row = screen.getByText('Antitoxin').closest('tr');
    // Multiple rows → multiple matches page-wide is expected; within(row) resolves one.
    const edit = within(row).getByRole('button', { name: 'Edit item' });
    const move = within(row).getByRole('button', { name: 'Move to player' });
    const del = within(row).getByRole('button', { name: 'Delete item' });
    for (const [btn, label] of [[edit, 'Edit item'], [move, 'Move to player'], [del, 'Delete item']]) {
      expect(btn).toHaveAttribute('aria-label', label);
      expect(btn).toHaveAttribute('title', label);
    }
    expect(screen.getAllByRole('button', { name: 'Edit item' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Delete item' })).toHaveLength(2);
    // Icon-only Edit/Delete carry no visible text; accessible name comes from aria-label.
    expect(edit.textContent).toBe('');
    expect(del.textContent).toBe('');
    // Click behavior unchanged: role+name click still opens the prefilled edit modal.
    fireEvent.click(edit);
    const modal = (await screen.findByText('Edit Antitoxin')).closest('.pi-modal');
    expect(within(modal).getByDisplayValue('Antitoxin')).toBeInTheDocument();
    fireEvent.click(within(modal).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('Edit Antitoxin')).not.toBeInTheDocument();
  });

  it('moves an item to a player through the move modal', async () => {
    await renderReady();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const row = screen.getByText('Torch').closest('tr');
    fireEvent.click(within(row).getByTitle('Move to player'));
    fireEvent.click(await screen.findByRole('button', { name: /Move to Player/ }));
    expect(confirmSpy).toHaveBeenCalledWith('Move 5 × Torch to War Cleric?');
    await waitFor(() => {
      expect(mockTransferInventory).toHaveBeenCalledWith('test-campaign', {
        direction: 'party-to-player',
        playerName: 'War Cleric',
        itemName: 'Torch',
        quantity: 5,
      });
    });
    confirmSpy.mockRestore();
  });

  it('lists the player backpack and moves an item to the party with quantity from itemMeta', async () => {
    await renderReady();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await selectPlayer('War Cleric');
    // Backpack entries without itemMeta still list, defaulting to ×1
    expect(await screen.findByText("Thieves' Tools")).toBeTruthy();
    expect(screen.getByText('×1')).toBeTruthy();
    const ropeRow = screen.getByText('Rope, Hempen').closest('li');
    fireEvent.click(within(ropeRow).getByRole('button', { name: /To Party/ }));
    expect(confirmSpy).toHaveBeenCalledWith('Move 3 × Rope, Hempen from War Cleric to party inventory?');
    await waitFor(() => {
      expect(mockTransferInventory).toHaveBeenCalledWith('test-campaign', {
        direction: 'player-to-party',
        playerName: 'War Cleric',
        itemName: 'Rope, Hempen',
        quantity: 3,
      });
    });
    confirmSpy.mockRestore();
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

  it('allows free-text names not present in equipment.json', async () => {
    await renderReady();
    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));
    const nameInput = screen.getByLabelText(/Name/);
    fireEvent.change(nameInput, { target: { value: 'Goblin Idol' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => {
      expect(mockSaveInventory).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({ name: 'Goblin Idol' }),
        ]),
      }));
    });
  });

  it('deletes an item after confirmation', async () => {
    await renderReady();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const row = screen.getByText('Antitoxin').closest('tr');
    fireEvent.click(within(row).getByTitle('Delete item'));
    await waitFor(() => {
      expect(mockSaveInventory).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        items: expect.not.arrayContaining([expect.objectContaining({ id: 'i1' })]),
      }));
    });
    window.confirm.mockRestore();
  });

  it('live-updates from SSE inventory events', async () => {
    await renderReady();
    const next = baseInventory();
    next.items.push({ id: 'i3', name: 'Ziggurat Map', quantity: 1, description: '' });
    await act(async () => {
      sseHandler({ key: 'inventory-test-campaign', data: next });
    });
    expect(await screen.findByText('Ziggurat Map')).toBeTruthy();
  });
});
