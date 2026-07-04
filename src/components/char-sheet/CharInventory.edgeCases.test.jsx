import { render, screen } from '@testing-library/react';
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

const mockEquipmentData = [
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
];

function renderComponent(playerStats) {
  return render(<CharInventory playerStats={playerStats} />);
}

describe('CharInventory edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));

    loadEquipment.mockResolvedValue(mockEquipmentData);
  });

  describe('inventory section header', () => {
    it('should render the Inventory section header', () => {
      renderComponent({
        inventory: { magicItems: [], equipped: [], backpack: [] },
      });
      expect(screen.getByText('Inventory')).toBeInTheDocument();
    });
  });

  describe('magic item type rendering edge cases', () => {
    it('should render magic item type in italic without subtype', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Ring of Warmth',
              type: 'Ring',
              rarity: 'Uncommon',
              description: 'You are always warm.',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Ring of Warmth/)).toBeInTheDocument();
      expect(screen.getByText(/Uncommon/)).toBeInTheDocument();
    });

    it('should render magic item with subtype in parentheses', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Staff of Power',
              type: 'Staff',
              subtype: 'Magic Staff',
              rarity: 'Very Rare',
              description: 'A powerful staff.',
              requiresAttunement: true,
              attunementRequirements: 'Sorcerer',
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Staff of Power/)).toBeInTheDocument();
      expect(screen.getByText(/Magic Staff/)).toBeInTheDocument();
      expect(screen.getByText(/Very Rare/)).toBeInTheDocument();
    });

    it('should render magic item with quantity when present', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Potion of Healing',
              quantity: 3,
              type: 'Potion',
              rarity: 'Common',
              description: 'Restores HP.',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/qty 3/)).toBeInTheDocument();
    });

    it('should render magic item with undefined rarity gracefully', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Odd Item',
              type: 'Wondrous Item',
              description: 'Something odd.',
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Odd Item/)).toBeInTheDocument();
      expect(screen.getByText(/Wondrous Item/)).toBeInTheDocument();
    });
  });

  describe('backpack and equipped rendering', () => {
    it('should display parenthetical quantity in item text', () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Potions of Healing (3)'],
          backpack: ['Arrows (20)', 'Rations (5)'],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Arrows \(20\)/)).toBeInTheDocument();
      expect(screen.getByText(/Rations \(5\)/)).toBeInTheDocument();
      expect(screen.getByText(/Potions of Healing \(3\)/)).toBeInTheDocument();
    });

    it('should handle items without parenthetical quantities', () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Sword', 'Shield'],
          backpack: ['Rations'],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Sword/)).toBeInTheDocument();
      expect(screen.getByText(/Shield/)).toBeInTheDocument();
      expect(screen.getByText(/Rations/)).toBeInTheDocument();
    });

    it('should not render comma separator when only one item in a section', () => {
      const statsEquipped = {
        inventory: {
          magicItems: [],
          equipped: ['Longsword'],
          backpack: [],
        },
      };

      renderComponent(statsEquipped);
      const equippedSection = screen.getByText(/Equipped:/).parentElement;
      expect(equippedSection.textContent).not.toContain(',');

      const statsBackpack = {
        inventory: {
          magicItems: [],
          equipped: [],
          backpack: ['Rations'],
        },
      };

      renderComponent(statsBackpack);
      const backpackSection = screen.getByText(/Backpack:/).parentElement;
      expect(backpackSection.textContent).not.toContain(',');
    });

    it('should render comma separator between multiple items', () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Sword', 'Shield'],
          backpack: [],
        },
      };

      renderComponent(stats);
      const equippedSection = screen.getByText(/Equipped:/).parentElement;
      expect(equippedSection.textContent).toContain(',');
      expect(equippedSection.textContent).toContain('Sword');
      expect(equippedSection.textContent).toContain('Shield');
    });
  });
});
