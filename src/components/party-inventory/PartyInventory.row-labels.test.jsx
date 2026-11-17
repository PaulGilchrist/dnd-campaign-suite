// @maintained-by-ai: 2026-11-17
// Improve (backlog 2026-11-17 CD): every From Players `To Party` button was an
// undifferentiated `.pi-move-btn` (row identified only by ancestor text) and the item
// stepper pair was UNTITLED while sharing its class with the currency chips, so
// `.pi-container .pi-step-btn` hit disabled chips first and a "Copper row" click took
// three tries. Now each To Party button carries title/aria-label equal to the exact
// copy its native confirm computes (minus "?"), each stepper is labelled
// `Decrease/Increase quantity of <item>`, and the currency chips mirror their existing
// titles as accessible names too — so an exact-name query resolves ONE row's control
// screen-wide. Confirm copy itself is unchanged.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';

const mockLoadInventory = vi.fn();
const mockTransferInventory = vi.fn();
const mockApplyItemIntent = vi.fn();
let confirmSpy = null;

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
  characters: [
    {
      name: 'War Cleric',
      inventory: {
        backpack: ['Hempen Rope'],
        equipped: [],
        gold: 10,
        magicItems: [],
        currency: { pp: 0, gp: 10, sp: 0, cp: 1 },
        itemMeta: { 'Hempen Rope': { quantity: 2 } },
      },
    },
  ],
};

const baseInventory = () => ({
  currency: { pp: 0, gp: 5, sp: 0, cp: 0 },
  items: [
    { id: 'a1', name: 'QA Lantern', quantity: 1, description: '' },
    { id: 'a2', name: 'Goblin Idol', quantity: 3, description: '' },
  ],
});

async function renderReady() {
  render(<PartyInventory {...defaultProps} />);
  await screen.findByText('Party Inventory');
}

async function selectPlayer(name) {
  await renderReady();
  fireEvent.change(screen.getByLabelText('Choose player'), { target: { value: name } });
}

beforeEach(() => {
  mockLoadInventory.mockReset().mockResolvedValue(baseInventory());
  mockApplyItemIntent.mockReset().mockImplementation(async () => baseInventory());
  mockTransferInventory.mockReset().mockResolvedValue({
    inventory: baseInventory(),
    character: { name: 'War Cleric', inventory: {} },
  });
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
});

afterEach(() => {
  confirmSpy.mockRestore();
});

describe('PartyInventory row-scoped accessible names', () => {
  it('each To Party button is titled/labelled with its own confirm copy and resolves by exact name', async () => {
    await selectPlayer('War Cleric');
    for (const copy of [
      'Move 1 cp from War Cleric to party inventory',
      'Move 10 gp from War Cleric to party inventory',
      'Move 2 × Hempen Rope from War Cleric to party inventory',
    ]) {
      const button = screen.getByRole('button', { name: copy, exact: true });
      expect(button).toHaveAttribute('aria-label', copy);
      expect(button).toHaveAttribute('title', copy);
      expect(button.textContent).toContain('To Party');
    }
  });

  it('confirm copy is unchanged (label + "?") and the scoped click still moves only that coin row', async () => {
    confirmSpy.mockReturnValue(true);
    await selectPlayer('War Cleric');
    fireEvent.click(screen.getByRole('button', {
      name: 'Move 1 cp from War Cleric to party inventory', exact: true,
    }));
    expect(confirmSpy).toHaveBeenCalledWith('Move 1 cp from War Cleric to party inventory?');
    await waitFor(() => {
      expect(mockTransferInventory).toHaveBeenCalledWith('test-campaign', {
        direction: 'player-to-party',
        playerName: 'War Cleric',
        currency: { cp: 1 },
      });
    });
  });

  it('item steppers carry item-named titles/labels and an exact-name query resolves ONE row beside the chips', async () => {
    await renderReady();
    const increase = screen.getByRole('button', { name: 'Increase quantity of QA Lantern', exact: true });
    expect(increase).toHaveAttribute('aria-label', 'Increase quantity of QA Lantern');
    expect(increase).toHaveAttribute('title', 'Increase quantity of QA Lantern');
    const decrease = screen.getByRole('button', { name: 'Decrease quantity of Goblin Idol', exact: true });
    expect(decrease).toHaveAttribute('aria-label', 'Decrease quantity of Goblin Idol');
    // Clicking the name-resolved stepper still posts exactly that row's setQty intent.
    fireEvent.click(increase);
    await waitFor(() => {
      expect(mockApplyItemIntent).toHaveBeenCalledWith('test-campaign', {
        action: 'setQty', id: 'a1', quantity: 2, name: 'QA Lantern',
      });
    });
  });

  it('currency chips mirror their titles as accessible names (no bare +/− glyph names)', async () => {
    await renderReady();
    for (const copy of ['Add 1 cp', 'Remove 10 gp', 'Add 100 sp', 'Remove 1 pp']) {
      const chip = screen.getByRole('button', { name: copy, exact: true });
      expect(chip).toHaveAttribute('aria-label', copy);
      expect(chip).toHaveAttribute('title', copy);
    }
  });

  it('the Move-to-Player modal stepper is labelled with its item name too', async () => {
    await renderReady();
    const row = screen.getByText('Goblin Idol').closest('tr');
    fireEvent.click(within(row).getByTitle('Move to player'));
    const modal = (await screen.findByText('Move “Goblin Idol” to Player')).closest('.pi-modal');
    expect(within(modal).getByRole('button', { name: 'Increase quantity of Goblin Idol', exact: true })).toBeTruthy();
    expect(within(modal).getByRole('button', { name: 'Decrease quantity of Goblin Idol', exact: true })).toBeTruthy();
  });
});
