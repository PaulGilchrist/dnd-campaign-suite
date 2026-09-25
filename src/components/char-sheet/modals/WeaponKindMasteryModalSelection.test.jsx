// @improved-by-ai
// @cleaned-by-ai
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../services/automation/index.js', () => ({
  applyWeaponKindMastery: vi.fn(),
}));

import * as automation from '../../../services/automation/index.js';
import WeaponKindMasteryModal from './WeaponKindMasteryModal.jsx';

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
  return { ...render(<WeaponKindMasteryModal {...makeProps(overrides)} />) };
}

describe('WeaponKindMasteryModal', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('weapon selection', () => {
    it('allows deselecting a weapon to free up a slot', async () => {
      const props = makeProps({
        action: { automation: { maxKinds: 1 } },
      });
      renderWithWeapons(props);
      await waitFor(() => screen.getByText('Battleaxe'));
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      expect(checkboxes[1].disabled).toBe(true);
      fireEvent.click(checkboxes[0]);
      expect(checkboxes[1].disabled).toBe(false);
    });

    it('pre-selects weapons from the existing prop', async () => {
      renderWithWeapons({ existing: ['Battleaxe', 'Club'] });
      await waitFor(() => screen.getByText('Battleaxe'));
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes[0].checked).toBe(true);
      expect(checkboxes[2].checked).toBe(true);
      expect(checkboxes[1].checked).toBe(false);
    });
  });

  describe('handleSelect / applyWeaponKindMastery', () => {
    it('calls applyWeaponKindMastery with selected weapons, playerStats, and campaignName', async () => {
      automation.applyWeaponKindMastery.mockResolvedValue({
        type: 'popup',
        payload: {
          type: 'automation_info',
          name: 'Weapon Mastery',
          description: 'Weapon kinds set to: Battleaxe, Club.',
        },
      });
      renderWithWeapons();
      await waitFor(() => screen.getByText('Battleaxe'));
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      fireEvent.click(checkboxes[0]);
      fireEvent.click(checkboxes[2]);
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Select' }));
      });
      await waitFor(() => {
        expect(automation.applyWeaponKindMastery).toHaveBeenCalledWith(
          ['Battleaxe', 'Club'],
          mockPlayerStats,
          mockCampaignName
        );
      });
    });
  });

  describe('close behavior', () => {
    it('does not call onClose when the overlay background is clicked', async () => {
      const onClose = vi.fn();
      renderWithWeapons({ onClose });
      await waitFor(() => screen.getByText('Battleaxe'));
      const overlay = document.querySelector('.sp-overlay');
      fireEvent.click(overlay);
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    });
  });
});
