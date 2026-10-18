// @maintained-by-ai
// Weapon-list lane for WeaponKindMasteryModal: rows rendered from the fetched equipment list
// (meleeOnly filter, alphabetical sort, invalid-row filtering), row metadata copy including the
// "no mastery" dash, toggle ↔ Select-button ↔ Selected-counter gating, and disable-at-cap
// enforcement (multiple unchecked disabled, clicks on disabled are inert).
// Other lanes: first-paint copy → ...Initial.test.jsx, maxKinds computation → ...MaxKinds.test.jsx,
// deselect-frees-slot / preselect / exact payload order / backdrop → ...Selection.test.jsx,
// result view / Done / Skip → ...Result.test.jsx, payload production → weaponKindMasteryHandler.test.js.

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/automation/index.js', () => ({
  applyWeaponKindMastery: vi.fn(),
}));

import WeaponKindMasteryModal from './WeaponKindMasteryModal.jsx';
import { resetWeaponsCache } from './weapon-kind-mastery-cache.js';

const mockPlayerStats = {
  name: 'Fighter1',
  level: 5,
  class: {
    class_levels: [
      { level: 1, weapon_mastery: 2 },
      { level: 5, weapon_mastery: 3 },
    ],
  },
};
const mockCampaignName = 'test-campaign';

const mockWeapons = [
  { name: 'Battleaxe', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Topple' },
  { name: 'Blowgun', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Ranged', mastery: 'Sap' },
  { name: 'Club', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee', mastery: 'Slow' },
  { name: 'Longbow', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Ranged', mastery: 'Vex' },
  { name: 'Shortsword', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Vex' },
];

function renderWithWeapons(overrides = {}, weaponsToMock = mockWeapons) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(weaponsToMock),
  });
  return render(
    <WeaponKindMasteryModal
      action={undefined}
      playerStats={mockPlayerStats}
      campaignName={mockCampaignName}
      onClose={vi.fn()}
      {...overrides}
    />
  );
}

function checkboxFor(name) {
  return screen.getByRole('checkbox', { name: new RegExp(`^${name}`) });
}

async function waitForWeapons() {
  await waitFor(() => screen.getByRole('checkbox', { name: /^Battleaxe/ }));
}

describe('WeaponKindMasteryModal — weapon list', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    resetWeaponsCache();
  });

  it.each([
    ['meleeOnly=false', false, ['Battleaxe', 'Blowgun', 'Club', 'Longbow', 'Shortsword'], []],
    ['meleeOnly=true', true, ['Battleaxe', 'Club', 'Shortsword'], ['Blowgun', 'Longbow']],
  ])('renders one checkbox row per weapon, meleeOnly=%s', async (_label, meleeOnly, expected, absent) => {
    renderWithWeapons({ meleeOnly });
    await waitFor(() => screen.getAllByRole('checkbox', { name: new RegExp(`^${expected[0]}`) }));

    expect(screen.getAllByRole('checkbox')).toHaveLength(expected.length);
    expected.forEach(name => {
      expect(checkboxFor(name)).toBeInTheDocument();
    });
    absent.forEach(name => {
      expect(screen.queryByRole('checkbox', { name: new RegExp(`^${name}`) })).not.toBeInTheDocument();
    });
  });

  it('renders category, range, and mastery on each row, dashing missing mastery', async () => {
    const weapons = [
      ...mockWeapons,
      { name: 'Test Weapon', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee' },
    ];
    renderWithWeapons({}, weapons);
    await waitFor(() => screen.getByRole('checkbox', { name: /^Test Weapon/ }));

    const battleaxeLabel = checkboxFor('Battleaxe').closest('label');
    expect(battleaxeLabel.textContent).toContain('[Martial Melee]');
    expect(battleaxeLabel.textContent).toContain('Mastery: Topple');

    const testLabel = checkboxFor('Test Weapon').closest('label');
    expect(testLabel.textContent).toContain('[Simple Melee]');
    expect(testLabel.textContent).toContain('Mastery: —');
  });

  it('sorts weapons alphabetically regardless of fetch order', async () => {
    const unsorted = [
      { name: 'Zweihander', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Push' },
      { name: 'Axe', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee', mastery: 'Slow' },
      { name: 'Mace', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee', mastery: 'Topple' },
    ];
    renderWithWeapons({}, unsorted);
    await waitFor(() => screen.getByRole('checkbox', { name: /^Axe/ }));

    const expectedOrder = ['Axe', 'Mace', 'Zweihander'];
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(expectedOrder.length);
    expectedOrder.forEach((name, i) => {
      expect(checkboxes[i]).toBe(checkboxFor(name));
    });
  });

  it('filters out non-weapon and incomplete rows', async () => {
    const mixedItems = [
      { name: 'Potion', equipment_category: 'Adventuring Gear' },
      { name: 'Test Weapon', equipment_category: 'Weapon', weapon_range: 'Melee' },
      { name: 'Test Weapon 2', equipment_category: 'Weapon', weapon_category: 'Simple' },
      { name: 'Battleaxe', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Topple' },
    ];
    renderWithWeapons({}, mixedItems);
    await waitFor(() => screen.getByRole('checkbox', { name: /^Battleaxe/ }));

    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    ['Potion', 'Test Weapon', 'Test Weapon 2'].forEach(name => {
      expect(screen.queryByRole('checkbox', { name: new RegExp(`^${name}\\b`) })).not.toBeInTheDocument();
    });
  });

  it('toggles selection, Select button state, and the Selected counter together', async () => {
    renderWithWeapons({ meleeOnly: false });
    await waitForWeapons();

    const battleaxe = checkboxFor('Battleaxe');
    expect(battleaxe.checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();
    expect(screen.getByText('Selected: 0/2')).toBeInTheDocument();

    fireEvent.click(battleaxe);
    expect(battleaxe.checked).toBe(true);
    expect(screen.getByRole('button', { name: 'Select' })).toBeEnabled();
    expect(screen.getByText('Selected: 1/2')).toBeInTheDocument();

    fireEvent.click(battleaxe);
    expect(battleaxe.checked).toBe(false);
    expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();
    expect(screen.getByText('Selected: 0/2')).toBeInTheDocument();
  });

  it('disables every unchecked weapon at the maxKinds cap and ignores clicks on them', async () => {
    renderWithWeapons({ meleeOnly: false, action: { automation: { maxKinds: 2 } } });
    await waitForWeapons();
    expect(screen.getAllByRole('checkbox')).toHaveLength(5);

    fireEvent.click(checkboxFor('Battleaxe'));
    fireEvent.click(checkboxFor('Club'));

    expect(screen.getByText('Selected: 2/2')).toBeInTheDocument();
    ['Battleaxe', 'Club'].forEach(name => {
      const cb = checkboxFor(name);
      expect(cb.checked).toBe(true);
      expect(cb).toBeEnabled();
    });
    ['Blowgun', 'Longbow', 'Shortsword'].forEach(name => {
      expect(checkboxFor(name)).toBeDisabled();
    });

    // Clicking a disabled row must not add a third kind (deselect-frees-slot lives in Selection lane)
    fireEvent.click(checkboxFor('Blowgun'));
    expect(checkboxFor('Blowgun').checked).toBe(false);
    expect(screen.getByText('Selected: 2/2')).toBeInTheDocument();
  });
});
