// @maintained-by-ai
// Regression lock for bug-player-clients-can-write-party-inventory — the Party
// Inventory view must be READ-ONLY on non-localhost (network) clients: no +/-
// currency chips, no Give, no Add Item, no item-row qty stepper/Edit/Move/Delete
// affordances (the server additionally 403s every write lane, see
// server/routes/inventory-localhost-guard.test.js). The treasury balances and the
// player→party contribution panel (PlayersPanel "To Party") stay visible — that
// lane debits the player's OWN resources and can never mint party wealth.
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';

const mockLoadInventory = vi.fn();

vi.mock('../../services/campaign/inventoryService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadInventory: (...args) => mockLoadInventory(...args),
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

const baseProps = {
  campaignName: 'test-campaign',
  characters: [
    {
      name: 'War Cleric',
      inventory: {
        backpack: ['Rope, Hempen'],
        equipped: ['Mace'],
        gold: 10,
        magicItems: [],
        itemMeta: { 'Rope, Hempen': { quantity: 3, description: '50 ft' } },
      },
    },
  ],
  onBack: vi.fn(),
};

const baseInventory = () => ({
  currency: { pp: 0, gp: 50, sp: 20, cp: 5 },
  items: [
    { id: 'i1', name: 'Antitoxin', quantity: 1, description: 'venom' },
    { id: 'i2', name: 'Torch', quantity: 5, description: '' },
  ],
});

async function renderReady(props) {
  const result = render(<PartyInventory {...baseProps} {...props} />);
  await screen.findByText('Party Inventory');
  return result;
}

beforeEach(() => {
  mockLoadInventory.mockReset().mockResolvedValue(baseInventory());
});

describe('PartyInventory — non-localhost (player) view is read-only for party writes', () => {
  it('hides every currency adjust chip and Give button', async () => {
    await renderReady({ isLocalhost: false });

    for (const currency of ['pp', 'gp', 'sp', 'cp']) {
      for (const amount of [1, 10, 100]) {
        expect(screen.queryByTitle(`Add ${amount} ${currency}`)).toBeNull();
        expect(screen.queryByTitle(`Remove ${amount} ${currency}`)).toBeNull();
      }
    }
    expect(screen.queryByText('Give')).toBeNull();
  });

  it('still renders the read-only treasury balances', async () => {
    await renderReady({ isLocalhost: false });

    const card = screen.getByText('Party Currency').closest('.pi-currency-card');
    expect(within(card).getByText('50')).toBeTruthy();
    expect(within(card).getByText('20')).toBeTruthy();
  });

  it('hides Add Item, the Actions column, and row qty steppers but keeps item rows', async () => {
    await renderReady({ isLocalhost: false });

    expect(screen.queryByText('Add Item')).toBeNull();
    expect(screen.queryByText('Actions')).toBeNull();
    expect(screen.queryByLabelText('Increase quantity')).toBeNull();
    expect(screen.queryByLabelText('Decrease quantity')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit item' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Move to player' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete item' })).toBeNull();
    expect(screen.queryByText('Quantity')).toBeNull();

    // Items themselves stay visible for the players to read.
    expect(screen.getByText('Antitoxin')).toBeTruthy();
    expect(screen.getByText('Torch')).toBeTruthy();
  });

  it('keeps the player→party contribution lane (From Players / To Party) open', async () => {
    await renderReady({ isLocalhost: false });

    expect(screen.getByText('From Players')).toBeTruthy();
    expect(screen.getByLabelText('Choose player')).toBeTruthy();
  });

  it('omits the Add Item hint from the empty-state copy on the player view', async () => {
    mockLoadInventory.mockResolvedValue({ currency: { pp: 0, gp: 0, sp: 0, cp: 0 }, items: [] });
    await renderReady({ isLocalhost: false });

    const empty = screen.getByText('No shared items yet.');
    expect(empty.textContent).not.toMatch(/Add Item/i);
  });
});

describe('PartyInventory — localhost GM view unchanged', () => {
  it('renders chips, Give, Add Item and row actions', async () => {
    await renderReady({ isLocalhost: true });

    expect(screen.getByTitle('Add 100 gp')).toBeTruthy();
    expect(screen.getByTitle('Remove 100 gp')).toBeTruthy();
    expect(screen.getByText('Add Item')).toBeTruthy();
    expect(screen.getAllByText('Give').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Edit item' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Move to player' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Delete item' }).length).toBeGreaterThan(0);
  });

  it('fails closed: missing isLocalhost prop never renders write affordances', async () => {
    await renderReady({});

    expect(screen.queryByText('Add Item')).toBeNull();
    expect(screen.queryByTitle('Add 100 gp')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete item' })).toBeNull();
  });
});
