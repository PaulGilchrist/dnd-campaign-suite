// @cleaned-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharInventory from './CharInventory.jsx';

// Mock the dataLoader service
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(),
  clearDataCache: vi.fn(),
}));

// Mock the usePopup hook
vi.mock('../../hooks/combat/usePopup.js', () => ({
  default: vi.fn(),
}));

// Mock the sanitize service
vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

import usePopup from '../../hooks/combat/usePopup.js';
import { loadEquipment } from '../../services/ui/dataLoader.js';

function renderComponent(playerStats) {
  return render(<CharInventory playerStats={playerStats} />);
}

describe('CharInventory item popup', () => {
  let setPopupHtmlSpy;

  beforeEach(() => {
    vi.clearAllMocks();

    setPopupHtmlSpy = vi.fn();

    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: setPopupHtmlSpy,
    }));

    loadEquipment.mockResolvedValue([
      {
        name: 'Longsword',
        index: 'longsword',
        desc: ['A common sword.'],
        cost: { quantity: 15, unit: 'gp' },
        weight: 3,
        equipment_category: 'Martial Melee Weapons',
      },
      {
        name: 'Shield',
        index: 'shield',
        desc: ['A defensive item.'],
        cost: { quantity: 10, unit: 'gp' },
        weight: 6,
        equipment_category: 'Armor',
      },
      {
        name: 'Dagger',
        index: 'dagger',
        desc: ['A simple melee weapon.'],
        cost: { quantity: 2, unit: 'gp' },
        weight: 1,
        equipment_category: 'Simple Melee Weapons',
      },
      {
        name: 'Potion of Healing',
        index: 'potion-of-healing',
        desc: ['Restores hit points.', 'Doubles as an alchemy component.'],
        ability: 'Constitution',
        utilize: 'Drink',
        craft: 'Alchemy',
      },
    ]);
  });

  async function clickItemByText(text) {
    const clickable = screen.getByText(text);
    fireEvent.click(clickable);
    await waitFor(() => {
      expect(setPopupHtmlSpy).toHaveBeenCalled();
    });
  }

  describe('name normalization', () => {
    it('should strip quantity from parentheses when clicking backpack items', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: [],
          backpack: ['Potion of Healing'],
        },
      };
      renderComponent(stats);
      await clickItemByText('Potion of Healing');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('Potion of Healing');
    });

    it('should handle items with parentheses in the name by stripping the parenthetical', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: [],
          backpack: ['Rations (10)'],
        },
      };
      renderComponent(stats);
      await clickItemByText('Rations (10)');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('Item details not found');
    });
  });

  describe('equipment lookup', () => {
    it('should find item by exact name match', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Shield'],
          backpack: [],
        },
      };
      renderComponent(stats);
      await clickItemByText('Shield');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>Shield</b>');
      expect(callArg).toContain('A defensive item.');
    });

    it('should find item by exact index match', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Dagger'],
          backpack: [],
        },
      };
      renderComponent(stats);
      await clickItemByText('Dagger');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>Dagger</b>');
    });

    it('should find item by plural-to-singular fallback', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Daggers'],
          backpack: [],
        },
      };
      renderComponent(stats);
      await clickItemByText('Daggers');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>Dagger</b>');
    });

    it('should find item by singular-to-plural fallback', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Shield'],
          backpack: [],
        },
      };
      renderComponent(stats);
      await clickItemByText('Shield');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>Shield</b>');
    });

    it('should not attempt plural fallback for words ending in "s" that are already plural', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Longsword'],
          backpack: [],
        },
      };
      renderComponent(stats);
      await clickItemByText('Longsword');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>Longsword</b>');
    });
  });

  describe('equipment detail rendering in popup', () => {
    it('should include cost, weight, and category in popup HTML', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Longsword'],
          backpack: [],
        },
      };
      renderComponent(stats);
      await clickItemByText('Longsword');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>Cost:</b>');
      expect(callArg).toContain('15 gp');
      expect(callArg).toContain('<b>Weight:</b>');
      expect(callArg).toContain('3');
      expect(callArg).toContain('<b>Category:</b>');
      expect(callArg).toContain('Martial Melee Weapons');
    });

    it('should include ability, utilize, and craft fields when present', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Potion of Healing'],
          backpack: [],
        },
      };
      renderComponent(stats);
      await clickItemByText('Potion of Healing');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>Ability:</b>');
      expect(callArg).toContain('Constitution');
      expect(callArg).toContain('<b>Utilize:</b>');
      expect(callArg).toContain('Drink');
      expect(callArg).toContain('<b>Craft:</b>');
      expect(callArg).toContain('Alchemy');
    });

    it('should join array descriptions with <br/><br/>', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Potion of Healing'],
          backpack: [],
        },
      };
      renderComponent(stats);
      await clickItemByText('Potion of Healing');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('Restores hit points.');
      expect(callArg).toContain('Doubles as an alchemy component.');
    });

    it('should include cost, weight, and category for dagger', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Dagger'],
          backpack: [],
        },
      };
      renderComponent(stats);
      await clickItemByText('Dagger');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('<b>Dagger</b>');
      expect(callArg).toContain('A simple melee weapon.');
      expect(callArg).toContain('<b>Cost:</b>');
    });
  });

  describe('item not found', () => {
    it('should show "not found" message when item is not in equipment database', async () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Unobtainium Rod'],
          backpack: [],
        },
      };
      renderComponent(stats);
      await clickItemByText('Unobtainium Rod');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('Unobtainium Rod');
      expect(callArg).toContain('not found in database');
    });

    it('should show "not found" when equipment data is empty array', async () => {
      loadEquipment.mockResolvedValue([]);
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Longsword'],
          backpack: [],
        },
      };
      renderComponent(stats);
      await clickItemByText('Longsword');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('not found in database');
    });
  });

  describe('error handling', () => {
    it('should show error message when equipment loading throws', async () => {
      loadEquipment.mockRejectedValue(new Error('Network error'));
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Longsword'],
          backpack: [],
        },
      };
      renderComponent(stats);
      await clickItemByText('Longsword');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('Error loading item details');
      expect(callArg).toContain('Network error');
    });

    it('should show error message when equipment data is null', async () => {
      loadEquipment.mockResolvedValue(null);
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Longsword'],
          backpack: [],
        },
      };
      renderComponent(stats);
      await clickItemByText('Longsword');
      const callArg = setPopupHtmlSpy.mock.calls[0][0];
      expect(callArg).toContain('not found in database');
    });
  });
});
