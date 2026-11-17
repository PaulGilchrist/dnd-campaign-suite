// @maintained-by-ai: 2026-11-16
// Improve (party-inventory mixed mental models): an unnoticed-open .pi-modal-overlay used
// to silently swallow every background click while the currency steppers next to it wrote
// the party pool on their own (debounced). Now (a) the currency card states the two lanes
// in a hint line, (b) while ANY pi modal is open the background sections carry `inert`
// (dimmed via `.pi-container [inert]`, functionally dead) and the currency chips/steps
// take a real `disabled`, and (c) the Give modal answers Escape and a pure backdrop click
// through the shared useModalDismiss lanes — same handler as Cancel, zero writes.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';

const mockLoadInventory = vi.fn();
const mockSavePartyItems = vi.fn();
const mockAdjustCurrency = vi.fn();
const mockTransferInventory = vi.fn();
let confirmSpy = null;

vi.mock('../../services/campaign/inventoryService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadInventory: (...args) => mockLoadInventory(...args),
  savePartyItems: (...args) => mockSavePartyItems(...args),
  adjustCurrency: (...args) => mockAdjustCurrency(...args),
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
    { name: 'War Cleric', inventory: { backpack: [], equipped: [], gold: 10, magicItems: [] } },
  ],
};

const baseInventory = () => ({
  currency: { pp: 1, gp: 205, sp: 20, cp: 50 },
  items: [{ id: 'i1', name: 'Antitoxin', quantity: 2, description: 'Neutralises poison.' }],
});

beforeEach(() => {
  mockLoadInventory.mockReset().mockResolvedValue(baseInventory());
  mockSavePartyItems.mockReset().mockImplementation(async (_c, items) => ({ ...baseInventory(), items }));
  mockAdjustCurrency.mockReset().mockImplementation(async (_c, amount) => ({
    currency: { pp: 1, gp: 205, sp: 20, cp: 50 + (amount.cp || 0) },
    items: baseInventory().items,
  }));
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

function currencyCard() {
  return screen.getByText('Party Currency').closest('.pi-currency-card');
}

function openGiveModal(currency = 'Gold') {
  fireEvent.click(screen.getByTitle(`Give ${currency} to a player`));
  return screen.getByText('Give Currency to Player').closest('.pi-modal-overlay');
}

describe('PartyInventory modal-open background treatment', () => {
  it('currency card carries a hint naming the automatic party-pool save and the Give transfer', async () => {
    await renderReady();
    const hint = screen.getByText(/save to the party pool automatically/i);
    expect(hint.closest('.pi-currency-card')).toBe(currencyCard());
    expect(hint.textContent).toMatch(/Give opens a transfer/i);
  });

  it('Give modal open: background sections go inert, currency chips go disabled', async () => {
    await renderReady();
    openGiveModal();
    expect(currencyCard()).toHaveAttribute('inert');
    expect(document.querySelector('.pi-main')).toHaveAttribute('inert');
    expect(document.querySelector('.ct-header')).toHaveAttribute('inert');
    // Steppers AND the Give chips take a real disabled attribute (visible ct-btn styling,
    // functionally dead), not just an overlay sitting over live-looking controls.
    expect(screen.getByTitle('Add 1 cp').disabled).toBe(true);
    expect(screen.getByTitle('Remove 10 gp').disabled).toBe(true);
    expect(screen.getByTitle('Give Gold to a player').disabled).toBe(true);
  });

  it('the open modal itself is never inside an inert subtree', async () => {
    await renderReady();
    const overlay = openGiveModal();
    expect(overlay.closest('[inert]')).toBeNull();
    expect(screen.getByText('Give Currency to Player').closest('[inert]')).toBeNull();
  });

  it('a stepper click during the modal dwell writes nothing', async () => {
    await renderReady();
    openGiveModal();
    fireEvent.click(screen.getByTitle('Add 1 cp'));
    expect(mockSavePartyItems).not.toHaveBeenCalled();
    expect(mockAdjustCurrency).not.toHaveBeenCalled();
    expect(mockTransferInventory).not.toHaveBeenCalled();
    // Amount stays at the loaded balance.
    expect(screen.getByText('Party Currency').closest('.pi-currency-card')
      .querySelector('.pi-currency-row:last-of-type .pi-currency-amount').textContent).toBe('50');
  });

  it('Add Item modal open: the currency card background goes inert too', async () => {
    await renderReady();
    fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));
    await screen.findByText('Add Item', { selector: '.ct-modal-header h3' });
    expect(currencyCard()).toHaveAttribute('inert');
    expect(screen.getByTitle('Add 1 cp').disabled).toBe(true);
  });

  it('Escape on the Give modal closes it with zero writes and restores the background', async () => {
    await renderReady();
    const overlay = openGiveModal();
    fireEvent.keyDown(overlay.querySelector('.pi-modal'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Give Currency to Player')).toBeNull());
    expect(mockSavePartyItems).not.toHaveBeenCalled();
    expect(mockAdjustCurrency).not.toHaveBeenCalled();
    expect(mockTransferInventory).not.toHaveBeenCalled();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(currencyCard()).not.toHaveAttribute('inert');
    expect(document.querySelector('.pi-main')).not.toHaveAttribute('inert');
    expect(screen.getByTitle('Add 1 cp').disabled).toBe(false);
  });

  it('a pure backdrop mousedown+click dismisses; a drag released off the panel does not', async () => {
    await renderReady();
    const overlay = openGiveModal();
    fireEvent.mouseDown(overlay.querySelector('.pi-modal'));
    fireEvent.click(overlay);
    expect(screen.getByText('Give Currency to Player')).toBeTruthy();
    fireEvent.mouseDown(overlay);
    fireEvent.click(overlay);
    await waitFor(() => expect(screen.queryByText('Give Currency to Player')).toBeNull());
    expect(mockTransferInventory).not.toHaveBeenCalled();
  });

  it('Cancel closes with zero writes and the steppers work again afterwards', async () => {
    await renderReady();
    const overlay = openGiveModal();
    fireEvent.click(withinCancel(overlay));
    await waitFor(() => expect(screen.queryByText('Give Currency to Player')).toBeNull());
    expect(mockSavePartyItems).not.toHaveBeenCalled();
    expect(currencyCard()).not.toHaveAttribute('inert');
    // Steppers live again: a post-close click schedules the debounced party-pool
    // delta flush (atomic /adjust lane — never a full-document snapshot).
    fireEvent.click(screen.getByTitle('Add 1 cp'));
    await waitFor(() => expect(mockAdjustCurrency).toHaveBeenCalledTimes(1));
    expect(mockSavePartyItems).not.toHaveBeenCalled();
  });
});

function withinCancel(overlay) {
  return [...overlay.querySelectorAll('button')].find(b => b.textContent.trim() === 'Cancel');
}
