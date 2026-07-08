// @cleaned-by-ai
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
    it('should render magic items section header and item details', () => {
      renderComponent();
      expect(screen.getByText(/Magic Items:/)).toBeInTheDocument();
      expect(screen.getByText(/Magic Sword/)).toBeInTheDocument();
      expect(screen.getByText(/qty 1/)).toBeInTheDocument();
      expect(screen.getByText(/Weapon/)).toBeInTheDocument();
      expect(screen.getByText(/Uncommon/)).toBeInTheDocument();
      expect(screen.getByText(/Warrior/)).toBeInTheDocument();
    });

    it('should show "requires attunement" when requiresAttunement is true without custom requirements', () => {
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

    it('should not render quantity label when quantity is missing or zero', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Magic Ring',
              type: 'Ring',
              rarity: 'Rare',
              description: 'A magical ring.',
            },
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
      expect(screen.getByText(/Magic Ring/)).toBeInTheDocument();
      expect(screen.getByText(/Zero Quantity Ring/)).toBeInTheDocument();
      expect(screen.queryByText(/qty/)).not.toBeInTheDocument();
    });

    it('should not render magic items section when magicItems is null or missing', () => {
      const stats = { inventory: {} };
      renderComponent(stats);
      expect(screen.queryByText(/Magic Items:/)).not.toBeInTheDocument();
    });

    it('should render magic items without subtype when subtype is missing', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Ring of Protection',
              type: 'Ring',
              rarity: 'Rare',
              description: 'A protective ring.',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };
      renderComponent(stats);
      expect(screen.getByText(/Ring of Protection/)).toBeInTheDocument();
      expect(screen.getByText(/Rare/)).toBeInTheDocument();
      expect(screen.queryByText(/\(/)).not.toBeInTheDocument();
    });

    it('should render magic items without requiresAttunement when false', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Potion of Healing',
              type: 'Potion',
              rarity: 'Common',
              description: 'Restores hit points.',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };
      renderComponent(stats);
      expect(screen.getByText(/Potion of Healing/)).toBeInTheDocument();
      expect(screen.queryByText(/requires attunement/)).not.toBeInTheDocument();
    });

    it('should render magic item description with sanitizeHtml passthrough', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Enchanted Wand',
              type: 'Wand',
              rarity: 'Uncommon',
              description: '<b>Channeled spell</b> that fires magic.',
              requiresAttunement: true,
              attunementRequirements: 'Spellcaster',
            },
          ],
          equipped: [],
          backpack: [],
        },
      };
      renderComponent(stats);
      expect(screen.getByText(/Enchanted Wand/)).toBeInTheDocument();
      expect(screen.getByText(/Spellcaster/)).toBeInTheDocument();
    });

    it('should render single equipped item without trailing comma', () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: ['Dagger'],
          backpack: [],
        },
      };
      renderComponent(stats);
      expect(screen.getByText(/Equipped:/)).toBeInTheDocument();
      expect(screen.getByText('Dagger')).toBeInTheDocument();
    });

    it('should render single backpack item without trailing comma', () => {
      const stats = {
        inventory: {
          magicItems: [],
          equipped: [],
          backpack: ['Torch'],
        },
      };
      renderComponent(stats);
      expect(screen.getByText(/Backpack:/)).toBeInTheDocument();
      expect(screen.getByText('Torch')).toBeInTheDocument();
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

    it('should not render equipped or backpack sections when arrays are empty, null, or missing', () => {
      const emptyStats = { inventory: { magicItems: [], equipped: [], backpack: [] } };
      renderComponent(emptyStats);
      expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();

      const nullStats = { inventory: { magicItems: [], equipped: null, backpack: null } };
      renderComponent(nullStats);
      expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();

      const missingStats = { inventory: {} };
      renderComponent(missingStats);
      expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();
    });
  });
});
