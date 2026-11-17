// @maintained-by-ai: 2026-11-17
// Regression (bug-player-currency-give-is-one-way-invisible): Give wrote currency into
// the character file (inventory.currency) and audited the move, but the From Players
// pane listed backpack items only — coins were write-only with zero read/return UI.
// The pane now renders one row per non-zero coin (purse resolution mirrors the
// server's characterCurrency rule: {pp,gp,sp,cp} block, else positive gold as gp)
// whose `To Party` rides the existing atomic player-to-party transfer lane with the
// same confirm + directional audit idioms as the item return.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';
import { addEntry } from '../../services/ui/logService.js';

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
    {
      name: 'Fey Ranger',
      inventory: {
        backpack: [],
        equipped: [],
        gold: 25,
        magicItems: [],
      },
    },
  ],
};

const poolWithoutCopper = () => ({
  currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
  items: [{ id: 'item-1', name: 'Hempen Rope', quantity: 2, description: '' }],
});

const poolAfterCopperReturn = () => {
  const next = poolWithoutCopper();
  next.currency = { pp: 0, gp: 0, sp: 0, cp: 1 };
  return next;
};

beforeEach(() => {
  mockLoadInventory.mockReset().mockResolvedValue(poolWithoutCopper());
  mockApplyItemIntent.mockReset().mockImplementation(async (_c, intent) => ({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: intent.item ? [intent.item] : [] }));
  mockTransferInventory.mockReset().mockResolvedValue({
    inventory: poolWithoutCopper(),
    character: { name: 'War Cleric', inventory: {} },
  });
  addEntry.mockClear();
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  confirmSpy.mockRestore();
});

function panel() {
  return document.querySelector('.pi-players-panel');
}

async function renderReady() {
  render(<PartyInventory {...defaultProps} />);
  await screen.findByText('Party Inventory');
}

async function selectPlayer(name) {
  await renderReady();
  fireEvent.change(screen.getByLabelText('Choose player'), { target: { value: name } });
}

describe('PartyInventory From Players currency rows (read-back)', () => {
  it('renders one row per non-zero coin with a To Party control, above the items', async () => {
    await selectPlayer('War Cleric');
    const rows = Array.from(panel().querySelectorAll('.pi-player-items li')).map(li => ({
      name: li.querySelector('.pi-player-item-name').textContent.trim(),
      qty: li.querySelector('.pi-player-item-qty').textContent.trim(),
      button: li.querySelector('button').textContent.trim(),
    }));
    expect(rows).toEqual([
      { name: 'Gold', qty: '10 gp', button: 'To Party' },
      { name: 'Copper', qty: '1 cp', button: 'To Party' },
      { name: 'Hempen Rope', qty: '×2', button: 'To Party' },
    ]);
  });

  it('resolves a gold-only character (no currency block) as a Gold gp row, mirroring the server debit rule', async () => {
    await selectPlayer('Fey Ranger');
    expect(within(panel()).getByText('Gold')).toBeTruthy();
    expect(within(panel()).getByText('25 gp')).toBeTruthy();
    expect(within(panel()).queryByText('Nothing in Fey Ranger’s backpack.')).toBeNull();
  });

  it('keeps the empty-backpack message for a player with neither items nor coins', async () => {
    render(<PartyInventory {...defaultProps} characters={[{ name: 'Pauper', inventory: { backpack: [], gold: 0 } }]} />);
    await screen.findByText('Party Inventory');
    fireEvent.change(screen.getByLabelText('Choose player'), { target: { value: 'Pauper' } });
    expect(within(panel()).getByText('Nothing in Pauper’s backpack.')).toBeTruthy();
    expect(within(panel()).queryAllByRole('button', { name: /To Party/ })).toHaveLength(0);
  });
});

describe('PartyInventory currency `To Party` return lane', () => {
  function copperToParty() {
    const copperRow = Array.from(panel().querySelectorAll('.pi-player-items li'))
      .find(li => li.textContent.includes('Copper'));
    return within(copperRow).getByRole('button', { name: /To Party/ });
  }

  it('confirms naming coin, amount, source player and party destination before any write', async () => {
    await selectPlayer('War Cleric');
    confirmSpy.mockReturnValue(false);
    fireEvent.click(copperToParty());
    expect(confirmSpy).toHaveBeenCalledWith('Move 1 cp from War Cleric to party inventory?');
    expect(mockTransferInventory).not.toHaveBeenCalled();
    expect(mockApplyItemIntent).not.toHaveBeenCalled();
  });

  it('accepting transfers via the atomic player-to-party lane with a cp-only currency payload', async () => {
    await selectPlayer('War Cleric');
    fireEvent.click(copperToParty());
    await waitFor(() => {
      expect(mockTransferInventory).toHaveBeenCalledWith('test-campaign', {
        direction: 'player-to-party',
        playerName: 'War Cleric',
        currency: { cp: 1 },
      });
    });
  });

  it('audits a directional inventory_transfer row and refreshes the party pool to show the returned coin', async () => {
    await selectPlayer('War Cleric');
    mockLoadInventory.mockResolvedValueOnce(poolAfterCopperReturn());
    fireEvent.click(copperToParty());
    await waitFor(() => {
      expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'inventory_transfer',
        message: '1 cp moved from War Cleric to party inventory',
      }));
    });
    const card = screen.getByText('Party Currency').closest('.pi-currency-card');
    await waitFor(() => {
      expect(within(card).getByText('1')).toBeTruthy();
    });
  });
});
