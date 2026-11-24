// @maintained-by-ai: 2026-11-24
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
    // QA backlog 2026-11-24: the native confirm retired — the exact same copy
    // now rides the shared role="dialog" tier before the single POST.
    confirmSpy.mockImplementation(() => {
      throw new Error('native window.confirm fired on the To Party path');
    });
    await selectPlayer('War Cleric');
    fireEvent.click(screen.getByRole('button', {
      name: 'Move 1 cp from War Cleric to party inventory', exact: true,
    }));
    const dialog = await screen.findByRole('dialog', { name: 'Move to Party' });
    expect(dialog).toHaveTextContent('Move 1 cp from War Cleric to party inventory?');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, Move' }));
    expect(confirmSpy).not.toHaveBeenCalled();
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

  // Backlog 2026-11-17 CE: the four Give chips were the last CurrencyCard buttons still
  // relying on title alone, so their accessible name was a bare "Give" ×4. They now
  // mirror their titles like every sibling chip (dc1bf7b29 idiom).
  it('Give chips mirror their titles as accessible names (no bare "Give" ×4)', async () => {
    await renderReady();
    for (const coin of ['Platinum', 'Gold', 'Silver', 'Copper']) {
      const copy = `Give ${coin} to a player`;
      const give = screen.getByRole('button', { name: copy, exact: true });
      expect(give).toHaveAttribute('aria-label', copy);
      expect(give).toHaveAttribute('title', copy);
    }
    // Distinct names per coin: the bare "Give" name no longer resolves anywhere.
    expect(screen.queryAllByRole('button', { name: 'Give', exact: true })).toHaveLength(0);
  });

  it('the Move-to-Player modal stepper is labelled with its item name too', async () => {
    await renderReady();
    const row = screen.getByText('Goblin Idol').closest('tr');
    fireEvent.click(within(row).getByTitle('Move "Goblin Idol" to player'));
    const modal = (await screen.findByText('Move “Goblin Idol” to Player')).closest('.pi-modal');
    expect(within(modal).getByRole('button', { name: 'Increase quantity of Goblin Idol', exact: true })).toBeTruthy();
    expect(within(modal).getByRole('button', { name: 'Decrease quantity of Goblin Idol', exact: true })).toBeTruthy();
  });

  // QA backlog 2026-11-24 (QF): the row Edit/Move/Delete buttons used the generic
  // "Edit item"/"Move to player"/"Delete item" names on EVERY row, so an aria-keyed
  // locator could not address one row's control. Every row action button (Edit,
  // Move-to-player, Delete, Increase/Decrease steppers) now mirrors its title as an
  // item-named aria-label, delete's copy IS the confirm sentence minus "?" — and a
  // rename re-derives every label from the row's current name.
  it('every row action button carries intent + its item name in aria-label, mirroring title', async () => {
    await renderReady();
    for (const name of ['QA Lantern', 'Goblin Idol']) {
      const row = screen.getByText(name).closest('tr');
      for (const copy of [
        `Edit "${name}"`,
        `Move "${name}" to player`,
        `Delete "${name}" from party inventory`,
        `Increase quantity of ${name}`,
        `Decrease quantity of ${name}`,
      ]) {
        const button = within(row).getByRole('button', { name: copy, exact: true });
        expect(button).toHaveAttribute('aria-label', copy);
        expect(button).toHaveAttribute('title', copy);
      }
    }
    // Distinct per row: the generic page-wide names no longer resolve anywhere.
    for (const generic of ['Edit item', 'Move to player', 'Delete item']) {
      expect(screen.queryAllByRole('button', { name: generic, exact: true })).toHaveLength(0);
    }
    // The Delete label never drifts from its dialog: confirm copy = label + "?".
    fireEvent.click(within(screen.getByText('QA Lantern').closest('tr'))
      .getByRole('button', { name: 'Delete "QA Lantern" from party inventory', exact: true }));
    const dialog = screen.getByRole('dialog', { name: 'Delete Party Item' });
    expect(dialog).toHaveTextContent('Delete "QA Lantern" from party inventory?');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
  });

  it('labels follow the row’s current name after a rename', async () => {
    // Update intents ack the renamed doc so the row's live name drives the labels.
    mockApplyItemIntent.mockImplementation(async (_c, intent) => {
      const doc = baseInventory();
      if (intent.action === 'update') {
        doc.items = doc.items.map(i => (i.id === intent.item.id ? { ...i, ...intent.item } : i));
      }
      return doc;
    });
    await renderReady();
    fireEvent.click(within(screen.getByText('Goblin Idol').closest('tr'))
      .getByRole('button', { name: 'Edit "Goblin Idol"', exact: true }));
    const modal = (await screen.findByText('Edit Goblin Idol')).closest('.pi-modal');
    fireEvent.change(within(modal).getByLabelText(/Name/), { target: { value: 'Idol of Zar' } });
    fireEvent.click(within(modal).getByRole('button', { name: /Save/ }));

    // The renamed row's actions re-derive from the new name; the old names are gone.
    const renamed = await screen.findByRole('button', { name: 'Delete "Idol of Zar" from party inventory', exact: true });
    const row = renamed.closest('tr');
    for (const copy of ['Edit "Idol of Zar"', 'Move "Idol of Zar" to player', 'Increase quantity of Idol of Zar']) {
      expect(within(row).getByRole('button', { name: copy, exact: true })).toHaveAttribute('aria-label', copy);
    }
    expect(screen.queryAllByRole('button', { name: 'Delete "Goblin Idol" from party inventory', exact: true })).toHaveLength(0);
  });
});
