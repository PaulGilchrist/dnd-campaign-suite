import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const baseProps = {
  action: undefined,
  playerStats: mockPlayerStats,
  campaignName: mockCampaignName,
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function renderWithWeapons(overrides, weaponsToMock = mockWeapons) {
  const fetchMock = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(weaponsToMock),
  });
  globalThis.fetch = fetchMock;
  return render(<WeaponKindMasteryModal {...makeProps(overrides)} />);
}

async function waitForWeapons() {
  await waitFor(() => screen.getByText('Battleaxe'));
}

describe('WeaponKindMasteryModal', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    resetWeaponsCache();
  });

  describe('weapon list', () => {
    it('renders all weapons when meleeOnly is false', async () => {
      renderWithWeapons();
      await waitForWeapons();

      expect(screen.getByRole('checkbox', { name: /Battleaxe/ })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Blowgun/ })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Club/ })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Longbow/ })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Shortsword/ })).toBeInTheDocument();
    });

    it('renders only melee weapons when meleeOnly is true', async () => {
      const meleeWeapons = [
        { name: 'Battleaxe', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Topple' },
        { name: 'Blowgun', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Ranged', mastery: 'Sap' },
        { name: 'Club', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee', mastery: 'Slow' },
      ];
      renderWithWeapons({ meleeOnly: true }, meleeWeapons);
      await waitFor(() => screen.getByText('Battleaxe'));

      expect(screen.getByRole('checkbox', { name: /Battleaxe/ })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /Club/ })).toBeInTheDocument();
      expect(screen.queryByRole('checkbox', { name: /Blowgun/ })).not.toBeInTheDocument();
    });

    it('renders weapon category, range, and mastery info for each weapon', async () => {
      renderWithWeapons();
      await waitForWeapons();

      const battleaxeLabel = screen.getByRole('checkbox', { name: /Battleaxe/ }).closest('label');
      expect(battleaxeLabel.textContent).toContain('[Martial Melee]');
      expect(battleaxeLabel.textContent).toContain('Topple');
    });

    it('renders "—" when a weapon has no mastery property', async () => {
      const weaponsWithNoMastery = [
        { name: 'Test Weapon', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee' },
      ];
      renderWithWeapons({}, weaponsWithNoMastery);
      await waitFor(() => screen.getByText('Test Weapon'));

      const label = screen.getByRole('checkbox', { name: /Test Weapon/ }).closest('label');
      expect(label.textContent).toContain('—');
    });

    it('renders weapons sorted alphabetically by name', async () => {
      const unsortedWeapons = [
        { name: 'Zweihander', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Push' },
        { name: 'Axe', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee', mastery: 'Slow' },
        { name: 'Mace', equipment_category: 'Weapon', weapon_category: 'Simple', weapon_range: 'Melee', mastery: 'Topple' },
      ];
      renderWithWeapons({}, unsortedWeapons);
      await waitFor(() => screen.getByText('Axe'));

      const checkboxes = screen.getAllByRole('checkbox');
      const names = checkboxes.map(cb => {
        const strong = cb.parentElement?.querySelector('strong');
        return strong?.textContent?.trim() || '';
      });
      expect(names).toEqual(['Axe', 'Mace', 'Zweihander']);
    });

    it('filters out non-weapon and incomplete items', async () => {
      const mixedItems = [
        { name: 'Potion', equipment_category: 'Adventuring Gear' },
        { name: 'Test Weapon', equipment_category: 'Weapon', weapon_range: 'Melee' },
        { name: 'Test Weapon 2', equipment_category: 'Weapon', weapon_category: 'Simple' },
        { name: 'Battleaxe', equipment_category: 'Weapon', weapon_category: 'Martial', weapon_range: 'Melee', mastery: 'Topple' },
      ];
      renderWithWeapons({}, mixedItems);
      await waitFor(() => screen.getByText('Battleaxe'));

      expect(screen.getByText('Battleaxe')).toBeInTheDocument();
      expect(screen.queryByText('Potion')).not.toBeInTheDocument();
      expect(screen.queryByText('Test Weapon')).not.toBeInTheDocument();
      expect(screen.queryByText('Test Weapon 2')).not.toBeInTheDocument();
    });

    it('toggles weapon selection and Select button state when checkbox is clicked', async () => {
      renderWithWeapons();
      await waitForWeapons();

      const battleaxeCheckbox = screen.getByRole('checkbox', { name: /Battleaxe/ });
      expect(battleaxeCheckbox.checked).toBe(false);
      expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();

      await fireEvent.click(battleaxeCheckbox);
      expect(battleaxeCheckbox.checked).toBe(true);
      expect(screen.getByRole('button', { name: 'Select' })).toBeEnabled();

      await fireEvent.click(battleaxeCheckbox);
      expect(battleaxeCheckbox.checked).toBe(false);
      expect(screen.getByRole('button', { name: 'Select' })).toBeDisabled();
    });

    it('disables unchecked weapons when max kinds limit is reached', async () => {
      const props = makeProps({
        action: { automation: { maxKinds: 2 } },
      });
      renderWithWeapons(props);
      await waitForWeapons();

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(5);

      await fireEvent.click(checkboxes[0]);
      await fireEvent.click(checkboxes[1]);

      expect(checkboxes[2].disabled).toBe(true);
      expect(checkboxes[3].disabled).toBe(true);
      expect(checkboxes[4].disabled).toBe(true);
    });

    it('renders "Selected: X/Y" count after selecting weapons', async () => {
      const props = makeProps({
        action: { automation: { maxKinds: 3 } },
      });
      renderWithWeapons(props);
      await waitForWeapons();

      const battleaxeCheckbox = screen.getByRole('checkbox', { name: /Battleaxe/ });
      await fireEvent.click(battleaxeCheckbox);

      const clubCheckbox = screen.getByRole('checkbox', { name: /Club/ });
      await fireEvent.click(clubCheckbox);

      expect(screen.getByText(/Selected: 2\/3/)).toBeInTheDocument();
    });
  });
});
