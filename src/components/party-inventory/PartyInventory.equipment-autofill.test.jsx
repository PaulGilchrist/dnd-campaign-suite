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
  isLocalhost: true,
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

// Backlog 2026-10-24: autofill was exact-name only, so PHB sort-order input
// ("Rope, Hempen") kept an empty description while disk carries "Hempen Rope".
// Matching is now case-insensitive + comma-inversion tolerant (single split outside
// parens); the item name the user typed is still stored verbatim on create.
describe('PartyInventory equipment autofill — inversion & case tolerance', () => {
  const ropeRow = diskEquipment.find(eq => eq.name === 'Hempen Rope');
  const ropeText = ropeRow.description.join('\n\n');

  it('comma-inverted "Rope, Hempen" autofills the same description as exact "Hempen Rope"', async () => {
    await renderReady();
    const nameInput = await openAddModalAndType('Rope, Hempen');

    const desc = screen.getByLabelText('Description');
    await waitFor(() => expect(desc.value).toBe(ropeText));
    expect(desc.value).toContain('hemp or silk');

    // Case variants re-typed on the same form stay byte-identical.
    fireEvent.change(nameInput, { target: { value: 'hempen rope' } });
    expect(screen.getByLabelText('Description').value).toBe(ropeText);
    fireEvent.change(nameInput, { target: { value: 'HEMPEN ROPE' } });
    expect(screen.getByLabelText('Description').value).toBe(ropeText);

    // Exact disk name still autofills byte-identically (no f23ce822e regression).
    fireEvent.change(nameInput, { target: { value: 'Hempen Rope' } });
    expect(screen.getByLabelText('Description').value).toBe(ropeText);
  });

  it('stores the typed name verbatim when a comma-inverted match autofills the description', async () => {
    await renderReady();
    await openAddModalAndType('Rope, Hempen');
    await waitFor(() => expect(screen.getByLabelText('Description').value).toBe(ropeText));

    fireEvent.click(screen.getByRole('button', { name: /Save/ }));
    await waitFor(() => {
      expect(mockSaveInventory).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        items: expect.arrayContaining([
          // Name is NEVER rewritten to the canonical "Hempen Rope" — only the description autofills.
          expect.objectContaining({ name: 'Rope, Hempen', description: ropeText }),
        ]),
      }));
    });
  });

  it('a non-matching name keeps the free text verbatim with an empty editable description', async () => {
    await renderReady();
    await openAddModalAndType('QA Nonsense Widget 9000');

    const desc = screen.getByLabelText('Description');
    expect(desc.value).toBe('');
    expect(desc.disabled).toBe(false);

    fireEvent.change(desc, { target: { value: 'nonsense made up whole' } });
    expect(desc.value).toBe('nonsense made up whole');

    const save = screen.getByRole('button', { name: /Save/ });
    expect(save.disabled).toBe(false); // miss never blocks the save
    fireEvent.click(save);
    await waitFor(() => {
      expect(mockSaveInventory).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        items: expect.arrayContaining([
          expect.objectContaining({
            name: 'QA Nonsense Widget 9000',
            description: 'nonsense made up whole',
          }),
        ]),
      }));
    });
  });

  it('does not substring-match: "Rope" alone autofills nothing (conservative normalization)', async () => {
    await renderReady();
    await openAddModalAndType('Rope');
    expect(screen.getByLabelText('Description').value).toBe('');
  });

  it('parenthesized thousands-separator names stay verbatim keys: exact "Agate (1,000 gp)" still autofills', async () => {
    const agateRow = diskEquipment.find(eq => eq.name === 'Agate (1,000 gp)');
    await renderReady();
    await openAddModalAndType('Agate (1,000 gp)');
    await waitFor(() => expect(screen.getByLabelText('Description').value).toBe(agateRow.description.join('\n\n')));
  });

  it('resolves multiple entries normalizing to the same key deterministically — first in data order wins', async () => {
    // Fabricated duplicate fixtures ON PURPOSE: real disk has zero normalization
    // collisions (verified by python sweep), so the ordering rule is only exercisable here.
    dataLoader.loadEquipment.mockResolvedValue([
      { index: 'hempen-rope', name: 'Hempen Rope', description: ['FIRST in data order'] },
      { index: 'rope-hempen-2', name: 'rope,  hempen', description: ['SECOND must lose'] },
    ]);
    await renderReady();
    await openAddModalAndType('Rope, Hempen');
    await waitFor(() => expect(screen.getByLabelText('Description').value).toBe('FIRST in data order'));
  });
});
