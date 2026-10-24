// @maintained-by-ai: 2026-10-24
// Improve (.pi-modal Give default 0 + confirm sum): the Give modal prefilled the focused
// currency from the party balance (1 in source, full balance observed live) and submitted
// with no confirmation — one accidental Enter moved money. Now every amount input defaults
// to 0, the submit control is disabled until any amount > 0, and a native window.confirm
// names the player + exact sums BEFORE the /inventory/transfer POST. Cancel = no POST.
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';

const mockLoadInventory = vi.fn();
const mockTransferInventory = vi.fn();
let confirmSpy = null;

vi.mock('../../services/campaign/inventoryService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadInventory: (...args) => mockLoadInventory(...args),
  saveInventory: vi.fn().mockImplementation(async (_c, inv) => inv),
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
  characters: [
    { name: 'War Cleric', inventory: { backpack: [], equipped: [], gold: 10, magicItems: [] } },
  ],
  onBack: vi.fn(),
};

// gp mirrors the incident balance (205) that used to ride into the focused input.
const baseInventory = () => ({
  currency: { pp: 1, gp: 205, sp: 20, cp: 50 },
  items: [],
});

beforeEach(() => {
  mockLoadInventory.mockReset().mockResolvedValue(baseInventory());
  mockTransferInventory.mockReset().mockResolvedValue({
    inventory: baseInventory(),
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

function openGiveModal(currency = 'Gold') {
  fireEvent.click(screen.getByTitle(`Give ${currency} to a player`));
  return screen.getByText('Give Currency to Player').closest('.pi-modal');
}

function giveInputs(modal) {
  return [...modal.querySelectorAll('.pi-currency-give-row input')];
}

function submitButton(modal) {
  return within(modal).getByRole('button', { name: /Give/ });
}

describe('PartyInventory Give modal default-0 + confirm', () => {
  it('opens with every currency input at 0 — never the party balance', async () => {
    await renderReady();
    const modal = openGiveModal('Gold');
    expect(giveInputs(modal).map(i => i.value)).toEqual(['0', '0', '0', '0']);
  });

  it('disables submit while all amounts are 0/empty, enables once any amount > 0', async () => {
    await renderReady();
    const modal = openGiveModal();
    expect(submitButton(modal).disabled).toBe(true);
    fireEvent.change(giveInputs(modal)[1], { target: { value: '' } });
    expect(submitButton(modal).disabled).toBe(true);
    fireEvent.change(giveInputs(modal)[1], { target: { value: '50' } });
    expect(submitButton(modal).disabled).toBe(false);
  });

  it('Enter or click at all-zero fires neither confirm nor transfer', async () => {
    await renderReady();
    const modal = openGiveModal();
    fireEvent.keyDown(giveInputs(modal)[1], { key: 'Enter' });
    fireEvent.click(submitButton(modal));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(mockTransferInventory).not.toHaveBeenCalled();
  });

  it('confirms naming player and exact sum BEFORE the POST; cancel means no POST', async () => {
    await renderReady();
    confirmSpy.mockReturnValue(false);
    const modal = openGiveModal();
    fireEvent.change(giveInputs(modal)[1], { target: { value: '50' } });
    fireEvent.click(submitButton(modal));
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy).toHaveBeenCalledWith('Give 50 gp to War Cleric?');
    expect(mockTransferInventory).not.toHaveBeenCalled();
    // modal stays open with the amount intact — the GM can fix or Cancel explicitly
    expect(screen.getByText('Give Currency to Player')).toBeTruthy();
    expect(giveInputs(screen.getByText('Give Currency to Player').closest('.pi-modal'))[1].value).toBe('50');
  });

  it('accept executes the atomic party-to-player transfer and closes the modal', async () => {
    await renderReady();
    const modal = openGiveModal();
    fireEvent.change(giveInputs(modal)[1], { target: { value: '50' } });
    fireEvent.click(submitButton(modal));
    expect(confirmSpy).toHaveBeenCalledWith('Give 50 gp to War Cleric?');
    await waitFor(() => {
      expect(mockTransferInventory).toHaveBeenCalledWith('test-campaign', {
        direction: 'party-to-player',
        playerName: 'War Cleric',
        currency: { gp: 50 },
      });
    });
    expect(screen.queryByText('Give Currency to Player')).toBeNull();
  });

  it('names every non-zero currency in CURRENCIES order in the confirm message', async () => {
    await renderReady();
    confirmSpy.mockReturnValue(false);
    const modal = openGiveModal();
    const inputs = giveInputs(modal);
    fireEvent.change(inputs[2], { target: { value: '20' } });
    fireEvent.change(inputs[1], { target: { value: '50' } });
    fireEvent.click(submitButton(modal));
    expect(confirmSpy).toHaveBeenCalledWith('Give 50 gp, 20 sp to War Cleric?');
    expect(mockTransferInventory).not.toHaveBeenCalled();
  });
});
