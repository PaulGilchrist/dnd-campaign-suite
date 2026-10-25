// @maintained-by-ai: 2026-10-24
// Improve (Item Move legs confirm): both item transfer legs executed silently while the
// currency Give modal confirmed named sums. Now the Move-to-Player modal submit fires a
// native window.confirm naming qty + item + destination player ("Move 2 × Hempen Rope to
// War Cleric?") and the From Players `To Party` leg names qty + item + source player +
// party destination — same Give idiom, same placement BEFORE any async write. Refusing
// either confirm performs zero POST/PUT/DELETE; accepting executes the atomic transfer
// exactly as before. Confirm fires only on the final submit click, never on modal open
// or qty/player input changes (no double-confirm friction).
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';

const mockLoadInventory = vi.fn();
const mockTransferInventory = vi.fn();
const mockSaveInventory = vi.fn();
let confirmSpy = null;

vi.mock('../../services/campaign/inventoryService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadInventory: (...args) => mockLoadInventory(...args),
  saveInventory: (...args) => mockSaveInventory(...args),
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
  onBack: vi.fn(),
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
  mockSaveInventory.mockReset().mockResolvedValue(afterPartyToPlayer());
  mockTransferInventory.mockReset().mockResolvedValue({
    inventory: afterPartyToPlayer(),
    character: { name: 'War Cleric', inventory: {} },
  });
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
});

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
    fireEvent.click(within(modal).getByLabelText('Increase quantity'));
    fireEvent.change(modalQtyInput(modal), { target: { value: '1' } });
    fireEvent.change(modal.querySelector('select'), { target: { value: 'War Cleric' } });
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('submit confirms naming qty, item and destination player before the transfer POST', async () => {
    await renderReady();
    const modal = openMoveModal();
    fireEvent.click(modalSubmit(modal));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Move 2 × Hempen Rope to War Cleric?');
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
    confirmSpy.mockReturnValue(false);
    const modal = openMoveModal();
    fireEvent.change(modalQtyInput(modal), { target: { value: '1' } });
    fireEvent.click(modalSubmit(modal));
    expect(confirmSpy).toHaveBeenCalledWith('Move 1 × Hempen Rope to War Cleric?');
  });

  it('refusing performs zero writes and keeps the modal open', async () => {
    await renderReady();
    confirmSpy.mockReturnValue(false);
    const modal = openMoveModal();
    fireEvent.click(modalSubmit(modal));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(mockTransferInventory).not.toHaveBeenCalled();
    expect(mockSaveInventory).not.toHaveBeenCalled();
    expect(screen.getByText('Move “Hempen Rope” to Player')).toBeTruthy();
  });

  it('accepting executes the atomic transfer exactly as before and closes the modal', async () => {
    await renderReady();
    const modal = openMoveModal();
    fireEvent.click(modalSubmit(modal));
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
    return screen.getByRole('button', { name: /To Party/ });
  }

  it('refusing `To Party` confirms naming qty, item, source player and party destination — zero writes', async () => {
    const toParty = await openPlayerBackpack();
    confirmSpy.mockReturnValue(false);
    fireEvent.click(toParty);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Move 2 × Hempen Rope from War Cleric to party inventory?');
    expect(mockTransferInventory).not.toHaveBeenCalled();
    expect(mockSaveInventory).not.toHaveBeenCalled();
  });

  it('accepting `To Party` executes the player-to-party transfer exactly as before', async () => {
    const toParty = await openPlayerBackpack();
    fireEvent.click(toParty);
    expect(confirmSpy).toHaveBeenCalledWith('Move 2 × Hempen Rope from War Cleric to party inventory?');
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
