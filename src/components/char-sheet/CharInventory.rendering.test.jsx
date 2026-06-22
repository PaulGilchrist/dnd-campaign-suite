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

const basePlayerStats = {
  inventory: {
    magicItems: [
      {
        name: 'Magic Sword',
        quantity: 1,
        type: 'Weapon',
        subtype: 'Longsword',
        rarity: 'Uncommon',
        description: 'A magical sword that glows.',
        requiresAttunement: true,
        attunementRequirements: 'Warrior',
      },
    ],
    equipped: ['Longsword', 'Shield'],
    backpack: ['Rations (10)', 'Healing Potion'],
  },
};

function renderComponent(playerStats = basePlayerStats) {
  return render(<CharInventory playerStats={playerStats} />);
}

describe('CharInventory rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));

    loadEquipment.mockResolvedValue(mockEquipmentData);
  });

  describe('magic items rendering', () => {
    it('should render magic items section header', () => {
      renderComponent();
      expect(screen.getByText(/Magic Items:/)).toBeInTheDocument();
    });

    it('should render magic item details', () => {
      renderComponent();
      expect(screen.getByText(/Magic Sword/)).toBeInTheDocument();
      expect(screen.getByText(/qty 1/)).toBeInTheDocument();
      expect(screen.getByText(/Weapon/)).toBeInTheDocument();
      expect(screen.getByText(/Uncommon/)).toBeInTheDocument();
      expect(screen.getByText(/Warrior/)).toBeInTheDocument();
      const longswordElements = screen.getAllByText(/Longsword/);
      expect(longswordElements.length).toBeGreaterThan(0);
    });

    it('should render magic item without attunement requirements label when false', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Magic Ring',
              type: 'Ring',
              rarity: 'Rare',
              description: 'A magical ring.',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Magic Ring/)).toBeInTheDocument();
      expect(screen.queryByText(/requires attunement/)).not.toBeInTheDocument();
    });

    it('should render magic item with requires attunement when no custom requirements', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Amulet',
              type: 'Ring',
              rarity: 'Uncommon',
              description: 'A glowing amulet.',
              requiresAttunement: true,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Amulet/)).toBeInTheDocument();
      expect(screen.getByText(/requires attunement/)).toBeInTheDocument();
    });

    it('should render magic item without quantity label when missing', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Magic Ring',
              type: 'Ring',
              rarity: 'Rare',
              description: 'A magical ring.',
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Magic Ring/)).toBeInTheDocument();
      expect(screen.queryByText(/qty/)).not.toBeInTheDocument();
    });

    it('should render magic item without requires attunement text when requiresAttunement is undefined', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Amulet of Health',
              type: 'Ring',
              rarity: 'Uncommon',
              description: 'A mysterious item.',
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Amulet of Health/)).toBeInTheDocument();
      expect(screen.queryByText(/requires attunement/)).not.toBeInTheDocument();
    });

    it('should render magic item description with sanitizeHtml', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Cloak of Protection',
              type: 'Armor',
              subtype: 'Cloak',
              rarity: 'Uncommon',
              description: '<b>+1 to AC and saving throws</b>',
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Cloak of Protection/)).toBeInTheDocument();
      expect(screen.getByText(/\+1 to AC and saving throws/)).toBeInTheDocument();
    });

    it('should not render magic items section when magicItems is missing', () => {
      const stats = { inventory: {} };
      renderComponent(stats);
      expect(screen.queryByText(/Magic Items:/)).not.toBeInTheDocument();
    });

    it('should not render magic items section when magicItems is null', () => {
      const stats = { inventory: { magicItems: null, equipped: [], backpack: [] } };
      renderComponent(stats);
      expect(screen.queryByText(/Magic Items:/)).not.toBeInTheDocument();
    });

    it('should render magic item with array description joined by line breaks', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Multi-desc Item',
              type: 'Wondrous Item',
              rarity: 'Uncommon',
              description: ['First line.', 'Second line.', 'Third line.'],
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Multi-desc Item/)).toBeInTheDocument();
    });

    it('should render magic item with no description gracefully', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'No Desc Item',
              type: 'Potion',
              rarity: 'Common',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/No Desc Item/)).toBeInTheDocument();
      expect(screen.getByText(/Potion/)).toBeInTheDocument();
      expect(screen.getByText(/Common/)).toBeInTheDocument();
    });

    it('should render multiple magic items', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Ring of Protection',
              type: 'Ring',
              rarity: 'Uncommon',
              description: '+1 AC',
              requiresAttunement: true,
            },
            {
              name: 'Amulet of Health',
              type: 'Amulet',
              rarity: 'Rare',
              description: 'CON becomes 19',
              requiresAttuement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Ring of Protection/)).toBeInTheDocument();
      expect(screen.getByText(/Amulet of Health/)).toBeInTheDocument();
      expect(screen.getByText(/Uncommon/)).toBeInTheDocument();
      expect(screen.getByText(/Rare/)).toBeInTheDocument();
    });

    it('should not show qty label when quantity is 0 (falsy)', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Zero Quantity Ring',
              quantity: 0,
              type: 'Ring',
              rarity: 'Common',
              description: 'A common ring.',
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Zero Quantity Ring/)).toBeInTheDocument();
      expect(screen.queryByText(/qty 0/)).not.toBeInTheDocument();
    });

    it('should render magic item with subtype in parentheses', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Dagger of Venom',
              type: 'Weapon',
              subtype: 'Dagger',
              rarity: 'Uncommon',
              description: 'A poisoned dagger.',
              requiresAttunement: true,
              attunementRequirements: 'Rogue',
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Dagger of Venom/)).toBeInTheDocument();
      expect(screen.getByText(/Rogue/)).toBeInTheDocument();
      expect(screen.queryByText(/requires attunement/)).not.toBeInTheDocument();
    });
  });

  describe('equipped and backpack rendering', () => {
    it('should render equipped items section with comma separation', () => {
      renderComponent();
      expect(screen.getByText(/Equipped:/)).toBeInTheDocument();
      expect(screen.getByText('Shield')).toBeInTheDocument();
      const equippedSection = screen.getByText(/Equipped:/).parentElement;
      expect(equippedSection.textContent).toContain(',');
    });

    it('should render backpack items section', () => {
      renderComponent();
      expect(screen.getByText(/Backpack:/)).toBeInTheDocument();
      expect(screen.getByText(/Rations/)).toBeInTheDocument();
      expect(screen.getByText('Healing Potion')).toBeInTheDocument();
    });

    it('should not render equipped section when empty', () => {
      const stats = { inventory: { magicItems: [], equipped: [], backpack: [] } };
      renderComponent(stats);
      expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
    });

    it('should not render backpack section when empty', () => {
      const stats = { inventory: { magicItems: [], equipped: [], backpack: [] } };
      renderComponent(stats);
      expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();
    });

    it('should not render equipped section when missing from inventory', () => {
      const stats = { inventory: {} };
      renderComponent(stats);
      expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
    });

    it('should not render equipped section when equipped is null', () => {
      const stats = { inventory: { magicItems: [], equipped: null, backpack: null } };
      renderComponent(stats);
      expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();
    });
  });
});
