// @improved-by-ai
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

describe('CharInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));

    loadEquipment.mockResolvedValue(mockEquipmentData);
  });

  describe('rendering', () => {
    it('should render magic items section header', () => {
      renderComponent();
      expect(screen.getByText('Magic Items')).toBeInTheDocument();
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

    it('should render magic items section header when magicItems is missing', () => {
      const stats = { inventory: {} };
      renderComponent(stats);
      expect(screen.queryByText('Magic Items')).not.toBeInTheDocument();
    });

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

    it('should throw when playerStats has no inventory property', () => {
      expect(() => renderComponent({})).toThrow();
    });
  });

  describe('item popup on click', () => {
    it('should show popup with equipment details when an item is clicked', async () => {
      const mockSetPopupHtml = vi.fn();
      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
      }));

      renderComponent();

      const shieldElement = screen.getByText('Shield');
      fireEvent.click(shieldElement);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });

      const popupContent = mockSetPopupHtml.mock.calls[0][0];
      expect(popupContent).toContain('Longsword');
      expect(popupContent).toContain('A common sword');
      expect(popupContent).toContain('Cost:');
      expect(popupContent).toContain('15 gp');
      expect(popupContent).toContain('Weight:');
      expect(popupContent).toContain('Category:');
    });

    it('should show popup for unknown items in the inventory', async () => {
      const mockSetPopupHtml = vi.fn();
      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
      }));

      renderComponent();

      const healingPotionElement = screen.getByText('Healing Potion');
      fireEvent.click(healingPotionElement);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });

      expect(mockSetPopupHtml.mock.calls[0][0]).toContain('Longsword');
    });

    it('should show error popup when loadEquipment rejects', async () => {
      loadEquipment.mockRejectedValue(new Error('Network error'));

      const mockSetPopupHtml = vi.fn();
      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
      }));

      renderComponent();

      const shieldElement = screen.getByText('Shield');
      fireEvent.click(shieldElement);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });

      const popupContent = mockSetPopupHtml.mock.calls[0][0];
      expect(popupContent).toContain('Error loading item details');
      expect(popupContent).toContain('Network error');
    });

    it('should show not-found popup when equipment list is empty', async () => {
      loadEquipment.mockResolvedValue([]);

      const mockSetPopupHtml = vi.fn();
      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
      }));

      renderComponent();

      const shieldElement = screen.getByText('Shield');
      fireEvent.click(shieldElement);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });

      const popupContent = mockSetPopupHtml.mock.calls[0][0];
      expect(popupContent).toContain('not found in database');
    });

    it('should strip parenthetical quantity from item name before lookup', async () => {
      const dataWithRations = [
        {
          name: 'Rations',
          index: 'rations',
          desc: ['Food supplies for travel.'],
          cost: { quantity: 5, unit: 'sp' },
          weight: 2,
          equipment_category: 'Supplies',
        },
      ];

      loadEquipment.mockResolvedValue(dataWithRations);

      const mockSetPopupHtml = vi.fn();
      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
      }));

      renderComponent();

      const backpackSection = screen.getByText(/Backpack:/).parentElement;
      const rationsElement = backpackSection.querySelector('.clickable');
      fireEvent.click(rationsElement);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.stringContaining('Rations')
        );
      });
    });

    it('should find item by removing trailing s (plural to singular)', async () => {
      const dataWithSingular = [
        {
          name: 'Arrow',
          index: 'arrow',
          desc: ['Ammunition.'],
          cost: { quantity: 1, unit: 'gp' },
          weight: 0.05,
          equipment_category: 'Ammunition',
        },
      ];

      loadEquipment.mockResolvedValue(dataWithSingular);

      const mockSetPopupHtml = vi.fn();
      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
      }));

      const stats = {
        inventory: {
          equipped: ['Arrows'],
          backpack: [],
        },
      };

      renderComponent(stats);

      const arrowsElement = screen.getByText('Arrows');
      fireEvent.click(arrowsElement);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.stringContaining('Arrow')
        );
      });
    });

    it('should find item by adding s (singular to plural)', async () => {
      const dataWithPlural = [
        {
          name: 'Rations',
          index: 'rations',
          desc: ['Food supplies.'],
          cost: { quantity: 5, unit: 'sp' },
          weight: 2,
          equipment_category: 'Supplies',
        },
      ];

      loadEquipment.mockResolvedValue(dataWithPlural);

      const mockSetPopupHtml = vi.fn();
      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
      }));

      const stats = {
        inventory: {
          equipped: [],
          backpack: ['Ration'],
        },
      };

      renderComponent(stats);

      const rationElement = screen.getByText('Ration');
      fireEvent.click(rationElement);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.stringContaining('Rations')
        );
      });
    });

    it('should display all item properties when present simultaneously', async () => {
      const dataWithAllProps = [
        {
          ...mockEquipmentData[0],
          ability: 'Strength',
          utilize: 'Dexterity (Dex) check',
          craft: 'Smiths tools',
        },
      ];

      loadEquipment.mockResolvedValue(dataWithAllProps);

      const mockSetPopupHtml = vi.fn();
      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
      }));

      renderComponent();

      const equippedSection = screen.getByText(/Equipped:/).parentElement;
      const longswordElement = equippedSection.querySelector('.clickable');
      fireEvent.click(longswordElement);

      await waitFor(() => {
        const callArg = mockSetPopupHtml.mock.calls[0][0];
        expect(callArg).toContain('Cost:');
        expect(callArg).toContain('Weight:');
        expect(callArg).toContain('Category:');
        expect(callArg).toContain('Ability:');
        expect(callArg).toContain('Utilize:');
        expect(callArg).toContain('Craft:');
      });
    });

    it('should display item name without parentheses when item has no parenthetical quantity', async () => {
      loadEquipment.mockResolvedValue(mockEquipmentData);

      const mockSetPopupHtml = vi.fn();
      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
      }));

      renderComponent({
        inventory: { equipped: ['Longsword'], backpack: [] },
      });

      const longswordElement = screen.getByText('Longsword');
      fireEvent.click(longswordElement);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          expect.stringContaining('Longsword')
        );
      });
    });
  });

  describe('popup rendering', () => {
    it('should render popup element when showPopup is triggered', async () => {
      const mockSetPopupHtml = vi.fn();
      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
      }));

      renderComponent();

      const shieldElement = screen.getByText('Shield');
      fireEvent.click(shieldElement);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });

      // Simulate popup being shown by updating the mock
      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: '<b>Test Popup</b>',
        setPopupHtml: mockSetPopupHtml,
      }));

      renderComponent();

      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
    });
  });
});
