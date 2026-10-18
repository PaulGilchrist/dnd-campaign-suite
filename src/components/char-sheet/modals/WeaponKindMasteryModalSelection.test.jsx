// @maintained-by-ai
// Selection lane for WeaponKindMasteryModal: click select/deselect at the cap, pre-selection
// from the `existing` prop, exact applyWeaponKindMastery call (weapons in click order,
// playerStats, campaignName), and backdrop-click guard.
// Other lanes: first-paint copy → WeaponKindMasteryModalInitial.test.jsx, maxKinds
// computation → ...MaxKinds.test.jsx, rows / meleeOnly / toggle / disabled-cap / count →
// ...WeaponList.test.jsx, result view / exact result copy / Skip / Done → ...Result.test.jsx,
// payload production → weaponKindMasteryHandler.test.js.

import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/automation/index.js', () => ({
  applyWeaponKindMastery: vi.fn(),
}));

import * as automation from '../../../services/automation/index.js';
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
  return screen.getByRole('checkbox', { name: new RegExp(name) });
}

async function waitForWeapons() {
  await waitFor(() => screen.getByRole('checkbox', { name: /Battleaxe/ }));
}

describe('WeaponKindMasteryModal — selection', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    resetWeaponsCache();
  });

  it('frees the slot for other weapons when the selected weapon is deselected at maxKinds 1', async () => {
    renderWithWeapons({ action: { automation: { maxKinds: 1 } } });
    await waitForWeapons();

    const battleaxe = checkboxFor('Battleaxe');
    const blowgun = checkboxFor('Blowgun');

    fireEvent.click(battleaxe);
    expect(battleaxe.checked).toBe(true);
    expect(blowgun.disabled).toBe(true);

    fireEvent.click(battleaxe);
    expect(battleaxe.checked).toBe(false);
    expect(blowgun.disabled).toBe(false);
  });

  it('pre-selects the weapons named in the existing prop', async () => {
    renderWithWeapons({ existing: ['Battleaxe', 'Club'] });
    await waitForWeapons();

    expect(screen.getAllByRole('checkbox')).toHaveLength(mockWeapons.length);
    expect(checkboxFor('Battleaxe').checked).toBe(true);
    expect(checkboxFor('Club').checked).toBe(true);
    expect(checkboxFor('Blowgun').checked).toBe(false);
    expect(checkboxFor('Longbow').checked).toBe(false);
  });

  it('calls applyWeaponKindMastery once with the selected weapons in click order, playerStats, and campaignName', async () => {
    // Honest fixture: matches weaponKindMasteryHandler.applySelections output for ['Club', 'Battleaxe'].
    automation.applyWeaponKindMastery.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Weapon Mastery',
        description: 'Weapon kinds set to: Club, Battleaxe. Mastery properties will be available when attacking with these weapons.',
      },
    });
    renderWithWeapons();
    await waitForWeapons();

    // Deliberately non-alphabetical order to pin pass-through of selection order.
    fireEvent.click(checkboxFor('Club'));
    fireEvent.click(checkboxFor('Battleaxe'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Select' }));
    });

    await waitFor(() => {
      expect(automation.applyWeaponKindMastery).toHaveBeenCalledTimes(1);
    });
    expect(automation.applyWeaponKindMastery).toHaveBeenCalledWith(
      ['Club', 'Battleaxe'],
      mockPlayerStats,
      mockCampaignName
    );
  });

  it('does not close when the overlay background is clicked', async () => {
    const onClose = vi.fn();
    renderWithWeapons({ onClose });
    await waitForWeapons();

    fireEvent.click(document.querySelector('.sp-overlay'));

    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
  });
});
