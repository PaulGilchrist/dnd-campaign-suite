// @maintained-by-ai: 2026-10-24
// Regression (bug-party-inventory-desc-autofill-wrong-key): handleNameChange and showItemPopup
// read `match.desc`, but every equipment.json entry stores authored text under `description` —
// the advertised "picked from equipment.json when the name matches" autofill was inert for all
// 289 entries. Disk honesty: the REAL public/data/equipment.json is fed through the mocked
// dataLoader (toolValidation.services.test.js precedent), so a wrong-key regression against
// fabricated `desc` fixtures cannot make these pins pass.
import { readFileSync } from 'fs';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PartyInventory from './PartyInventory.jsx';

const mockLoadInventory = vi.fn();
const mockSaveInventory = vi.fn();

vi.mock('../../services/campaign/inventoryService.js', async (importOriginal) => ({
  ...(await importOriginal()),
  loadInventory: (...args) => mockLoadInventory(...args),
  saveInventory: (...args) => mockSaveInventory(...args),
  transferInventory: vi.fn(),
}));

vi.mock('../../services/ui/sseClient.js', () => ({
  subscribeToSSE: () => () => {},
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(async () => []),
}));

import * as dataLoader from '../../services/ui/dataLoader.js';

const diskEquipment = JSON.parse(readFileSync('public/data/equipment.json', 'utf8'));
const acidRow = diskEquipment.find(eq => eq.name === 'Acid (vial)');

const defaultProps = {
  campaignName: 'test-campaign',
  characters: [],
  onBack: vi.fn(),
};

const emptyInventory = () => ({
  currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
  items: [],
});

async function renderReady(inventory = emptyInventory()) {
  mockLoadInventory.mockResolvedValue(inventory);
  const result = render(<PartyInventory {...defaultProps} />);
  await screen.findByText('Party Inventory');
  return result;
}

async function openAddModalAndType(name) {
  fireEvent.click(screen.getByRole('button', { name: /Add Item/ }));
  const nameInput = await screen.findByLabelText(/Name/);
  fireEvent.change(nameInput, { target: { value: name } });
  return nameInput;
}

beforeEach(() => {
  vi.resetAllMocks();
  dataLoader.loadEquipment.mockResolvedValue(diskEquipment);
  mockSaveInventory.mockImplementation(async (_c, inv) => inv);
});

describe('PartyInventory equipment description autofill', () => {
  it('fills the description with the equipment.json text when the exact name matches', async () => {
    // Disk anchor: fixture is real authored data, and the bug's zero-text extraction is impossible here.
    expect(Array.isArray(acidRow.description)).toBe(true);
    expect(acidRow.desc).toBeUndefined();

    await renderReady();
    await openAddModalAndType('Acid (vial)');

    const desc = screen.getByLabelText('Description');
    await waitFor(() => expect(desc.value).toContain('splash the contents of this vial'));
    // Paragraphs join with blank lines in the textarea (exact-text pin, both paragraphs).
    expect(desc.value).toBe(acidRow.description.join('\n\n'));
  });

  it('persists the autofilled description on save', async () => {
    await renderReady();
    await openAddModalAndType('Acid (vial)');
    await waitFor(() => expect(screen.getByLabelText('Description').value).toContain('acid damage'));

    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => {
      expect(mockSaveInventory).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            name: 'Acid (vial)',
            description: acidRow.description.join('\n\n'),
          }),
        ]),
      }));
    });
  });

  it('leaves a non-matching custom name editable with an empty description', async () => {
    await renderReady();
    await openAddModalAndType('Goblin Idol');
    await waitFor(() => expect(screen.getByLabelText('Description').value).toBe(''));

    const desc = screen.getByLabelText('Description');
    fireEvent.change(desc, { target: { value: 'crude carved idol' } });
    expect(desc.value).toBe('crude carved idol');
  });

  it('item popup shows the equipment.json text for a stored item without its own description', async () => {
    await renderReady({
      ...emptyInventory(),
      items: [{ id: 'i1', name: 'Acid (vial)', quantity: 1, description: '' }],
    });
    fireEvent.click(screen.getByRole('button', { name: 'Acid (vial)' }));
    expect(await screen.findByText(/splash the contents of this vial/i)).toBeTruthy();
  });
});
