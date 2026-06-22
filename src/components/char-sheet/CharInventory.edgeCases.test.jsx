// @improved-by-ai
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
import { sanitizeHtml } from '../../services/ui/sanitize.js';

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

  describe('section header rendering', () => {
    it('should render the Inventory section header', () => {
      renderComponent({
        inventory: { magicItems: [], equipped: [], backpack: [] },
      });
      expect(screen.getByText('Inventory')).toBeInTheDocument();
    });

    it('should render section header even with no inventory data at all', () => {
      renderComponent({ inventory: {} });
      expect(screen.getByText('Inventory')).toBeInTheDocument();
    });
  });

  describe('null/undefined safety', () => {
    it('should throw when playerStats is undefined', () => {
      expect(() => {
        render(<CharInventory />);
      }).toThrow();
    });

    it('should throw when playerStats.inventory is null', () => {
      expect(() => {
        render(<CharInventory playerStats={{ inventory: null }} />);
      }).toThrow();
    });

    it('should throw when playerStats.inventory is undefined', () => {
      expect(() => {
        render(<CharInventory playerStats={{}} />);
      }).toThrow();
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

    it('should render magic item with quantity when it is a large number', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Magic Stone',
              quantity: 100,
              type: 'Weapon',
              rarity: 'Common',
              description: 'A stone.',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/qty 100/)).toBeInTheDocument();
    });

    it('should render magic item description as sanitized HTML', () => {
      sanitizeHtml.mockReturnValue('<b>Sanitized output</b>');

      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Test Item',
              type: 'Wondrous Item',
              rarity: 'Common',
              description: '<script>alert("xss")</script>Safe content',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Test Item/)).toBeInTheDocument();
      expect(sanitizeHtml).toHaveBeenCalledWith('<script>alert("xss")</script>Safe content');
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

  describe('backpack items with parenthetical quantities', () => {
    it('should display parenthetical quantity in backpack item text', () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: [],
          backpack: ['Arrows (20)', 'Rations (5)'],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Arrows \(20\)/)).toBeInTheDocument();
      expect(screen.getByText(/Rations \(5\)/)).toBeInTheDocument();
    });

    it('should display parenthetical quantity in equipped item text', () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Potions of Healing (3)'],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Potions of Healing \(3\)/)).toBeInTheDocument();
    });

    it('should handle backpack items without parenthetical quantities', () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: [],
          backpack: ['Sword', 'Shield'],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Sword/)).toBeInTheDocument();
      expect(screen.getByText(/Shield/)).toBeInTheDocument();
    });
  });

  describe('single item rendering', () => {
    it('should not render comma separator when only one equipped item', () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Longsword'],
          backpack: [],
        },
      };

      renderComponent(stats);
      const equippedSection = screen.getByText(/Equipped:/).parentElement;
      expect(equippedSection.textContent).not.toContain(',');
    });

    it('should not render comma separator when only one backpack item', () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: [],
          backpack: ['Rations'],
        },
      };

      renderComponent(stats);
      const backpackSection = screen.getByText(/Backpack:/).parentElement;
      expect(backpackSection.textContent).not.toContain(',');
    });

    it('should render exactly two items with one comma separator', () => {
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

  describe('empty inventory object', () => {
    it('should render only section header with completely empty inventory', () => {
      renderComponent({ inventory: {} });
      expect(screen.getByText('Inventory')).toBeInTheDocument();
      expect(screen.queryByText(/Magic Items:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();
    });

    it('should render nothing for empty arrays', () => {
      renderComponent({
        inventory: { magicItems: [], equipped: [], backpack: [] },
      });
      expect(screen.getByText('Inventory')).toBeInTheDocument();
      expect(screen.queryByText(/Magic Items:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();
    });
  });

  describe('magic items with only requiresAttunement true, no custom requirements', () => {
    it('should show "(requires attunement)" text', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Cloak of Protection',
              type: 'Armor',
              rarity: 'Uncommon',
              description: '+1 AC.',
              requiresAttunement: true,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/requires attunement/)).toBeInTheDocument();
    });

    it('should not show "(requires attunement)" when requiresAttunement is false', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Ring of Protection',
              type: 'Ring',
              rarity: 'Uncommon',
              description: '+1 AC.',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.queryByText(/requires attunement/)).not.toBeInTheDocument();
    });
  });
});
