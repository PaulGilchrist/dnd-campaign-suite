// @maintained-by-ai: 2026-10-24
// Improve (Item Move legs confirm): both item transfer legs executed silently while the
// currency Give modal confirmed named sums. The Move-to-Player modal submit now arms the
// SHARED in-app confirm naming qty + item + destination player ("Move 2 × Hempen Rope to
// War Cleric?") and the From Players `To Party` leg names qty + item + source player +
// party destination — same chrome, same placement BEFORE any async write (QA backlog
// 2026-11-24: both native window.confirms retired with the lane sweep; a native confirm
// firing here is a regression). Refusing (Cancel/Escape/backdrop) performs zero
// POST/PUT/DELETE; confirming executes the atomic transfer exactly as before. The ask
// fires only on the final submit click, never on modal open or qty/player input changes.
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
        backpack: ['Hempen Rope', 'Hempen Rope'],
        equipped: [],
        gold: 10,
        magicItems: [],
      },
    },
  ],
};

const baseInventory = () => ({
  currency: { pp: 1, gp: 205, sp: 20, cp: 50 },
  items: [{ id: 'item-1', name: 'Hempen Rope', quantity: 2, description: 'Fibrous cord.' }],
});

const afterPartyToPlayer = () => ({
  currency: baseInventory().currency,
  items: [],
});

beforeEach(() => {
  mockLoadInventory.mockReset().mockResolvedValue(baseInventory());
  mockApplyItemIntent.mockReset().mockResolvedValue(afterPartyToPlayer());
  mockTransferInventory.mockReset().mockResolvedValue({
    inventory: afterPartyToPlayer(),
    character: { name: 'War Cleric', inventory: {} },
  });
  // A native confirm that FIRES on these lanes is a regression — make it loud.
  confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => {
    throw new Error('native window.confirm fired on an item-move path');
  });
});

// Shared in-app confirm helpers (the dialog's accessible name differs from the
// editor modal behind it so queries never collide).
function openConfirm(title, copy) {
  const dialog = screen.getByRole('dialog', { name: title });
  if (copy) expect(dialog).toHaveTextContent(copy);
  return dialog;
}
const yes = (dialog) => fireEvent.click(within(dialog).getByRole('button', { name: /Yes, / }));
const no = (dialog) => fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

afterEach(() => {
  confirmSpy.mockRestore();
});

async function renderReady() {
  render(<PartyInventory {...defaultProps} />);
  await screen.findByText('Party Inventory');
}

function openMoveModal(itemName = 'Hempen Rope') {
  fireEvent.click(screen.getByTitle('Move to player'));
  return screen.getByText(`Move “${itemName}” to Player`).closest('.pi-modal');
}

function modalQtyInput(modal) {
  return within(modal).getByLabelText('Quantity');
}

function modalSubmit(modal) {
  return within(modal).getByRole('button', { name: /Move to Player/ });
}

describe('PartyInventory party→player Move confirm', () => {
  it('opening the Move modal and editing qty/player fire NO confirm', async () => {
    await renderReady();
    const modal = openMoveModal();
    expect(confirmSpy).not.toHaveBeenCalled();
    fireEvent.click(within(modal).getByLabelText('Increase quantity of Hempen Rope'));
    fireEvent.change(modalQtyInput(modal), { target: { value: '1' } });
    fireEvent.change(modal.querySelector('select'), { target: { value: 'War Cleric' } });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('submit confirms naming qty, item and destination player before the transfer POST', async () => {
    await renderReady();
    const modal = openMoveModal();
    fireEvent.click(modalSubmit(modal));
    yes(openConfirm('Move to Player', 'Move 2 × Hempen Rope to War Cleric?'));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockTransferInventory).toHaveBeenCalledWith('test-campaign', {
        direction: 'party-to-player',
        playerName: 'War Cleric',
        itemName: 'Hempen Rope',
        quantity: 2,
      });
    });
  });

  it('confirm reflects a changed qty from the modal state', async () => {
    await renderReady();
    const modal = openMoveModal();
    fireEvent.change(modalQtyInput(modal), { target: { value: '1' } });
    fireEvent.click(modalSubmit(modal));
    openConfirm('Move to Player', 'Move 1 × Hempen Rope to War Cleric?');
  });

  it('refusing performs zero writes and keeps the modal open', async () => {
    await renderReady();
    const modal = openMoveModal();
    fireEvent.click(modalSubmit(modal));
    no(openConfirm('Move to Player'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockTransferInventory).not.toHaveBeenCalled();
    expect(mockApplyItemIntent).not.toHaveBeenCalled();
    expect(screen.getByText('Move “Hempen Rope” to Player')).toBeTruthy();
  });

  it('accepting executes the atomic transfer exactly as before and closes the modal', async () => {
    await renderReady();
    const modal = openMoveModal();
    fireEvent.click(modalSubmit(modal));
    yes(openConfirm('Move to Player'));
    await waitFor(() => {
      expect(mockTransferInventory).toHaveBeenCalledWith('test-campaign', {
        direction: 'party-to-player',
        playerName: 'War Cleric',
        itemName: 'Hempen Rope',
        quantity: 2,
      });
    });
    expect(screen.queryByText('Move “Hempen Rope” to Player')).toBeNull();
  });
});

describe('PartyInventory player→party `To Party` confirm', () => {
  async function openPlayerBackpack() {
    await renderReady();
    fireEvent.change(screen.getByLabelText('Choose player'), { target: { value: 'War Cleric' } });
    // The purse lane (currency rows) now also renders a `To Party` button for this
    // gold-carrying fixture; item rows label themselves with their own confirm copy.
    return screen.getByRole('button', {
      name: 'Move 2 × Hempen Rope from War Cleric to party inventory', exact: true,
    });
  }

  it('refusing `To Party` confirms naming qty, item, source player and party destination — zero writes', async () => {
    const toParty = await openPlayerBackpack();
    fireEvent.click(toParty);
    no(openConfirm('Move to Party', 'Move 2 × Hempen Rope from War Cleric to party inventory?'));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockTransferInventory).not.toHaveBeenCalled();
    expect(mockApplyItemIntent).not.toHaveBeenCalled();
  });

  it('accepting `To Party` executes the player-to-party transfer exactly as before', async () => {
    const toParty = await openPlayerBackpack();
    fireEvent.click(toParty);
    yes(openConfirm('Move to Party', 'Move 2 × Hempen Rope from War Cleric to party inventory?'));
    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockTransferInventory).toHaveBeenCalledWith('test-campaign', {
        direction: 'player-to-party',
        playerName: 'War Cleric',
        itemName: 'Hempen Rope',
        quantity: 2,
      });
    });
  });
});
