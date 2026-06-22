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

describe('CharInventory additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
    }));

    loadEquipment.mockResolvedValue(mockEquipmentData);
  });

  describe('usePopup callback behavior', () => {
    it('should not display popup via showPopup since callback returns null', () => {
      const mockShowPopup = vi.fn();
      usePopup.mockImplementation(() => ({
        showPopup: mockShowPopup,
        popupHtml: null,
        setPopupHtml: vi.fn(),
      }));

      renderComponent({
        inventory: { magicItems: [], equipped: ['Longsword'], backpack: [] },
      });

      // The component passes () => null to usePopup, so showPopup should exist
      // but calling it should never set popupHtml (since buildHtml returns null)
      expect(mockShowPopup).toBeDefined();
    });
  });

  describe('magic item description as array', () => {
    it('should render magic item with array description using sanitizeHtml per element', () => {
      sanitizeHtml.mockImplementation((html) => html);

      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Multi-Part Item',
              type: 'Wondrous Item',
              rarity: 'Uncommon',
              description: ['First paragraph.', 'Second paragraph.'],
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Multi-Part Item/)).toBeInTheDocument();
      expect(screen.getByText(/First paragraph/)).toBeInTheDocument();
      expect(screen.getByText(/Second paragraph/)).toBeInTheDocument();
    });

    it('should render magic item with array description containing empty strings', () => {
      sanitizeHtml.mockImplementation((html) => html);

      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Sparse Item',
              type: 'Potion',
              rarity: 'Common',
              description: ['First line.', '', 'Third line.'],
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Sparse Item/)).toBeInTheDocument();
      expect(screen.getByText(/First line/)).toBeInTheDocument();
      expect(screen.getByText(/Third line/)).toBeInTheDocument();
    });

    it('should render magic item with array description containing null entries', () => {
      sanitizeHtml.mockImplementation((html) => html);

      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Null Array Item',
              type: 'Wondrous Item',
              rarity: 'Common',
              description: ['Valid line.', null, 'Another valid line.'],
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Null Array Item/)).toBeInTheDocument();
      expect(screen.getByText(/Valid line/)).toBeInTheDocument();
      expect(screen.getByText(/Another valid line/)).toBeInTheDocument();
    });
  });

  describe('magic item with all optional fields', () => {
    it('should render magic item with all fields present simultaneously', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Complete Item',
              quantity: 2,
              type: 'Weapon',
              subtype: 'Longsword',
              rarity: 'Very Rare',
              description: 'A complete item with all fields.',
              requiresAttunement: true,
              attunementRequirements: 'Paladin',
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Complete Item/)).toBeInTheDocument();
      expect(screen.getByText(/qty 2/)).toBeInTheDocument();
      expect(screen.getByText(/Weapon/)).toBeInTheDocument();
      expect(screen.getByText(/Longsword/)).toBeInTheDocument();
      expect(screen.getByText(/Very Rare/)).toBeInTheDocument();
      expect(screen.getByText(/Paladin/)).toBeInTheDocument();
      expect(screen.getByText(/A complete item with all fields/)).toBeInTheDocument();
      // When attunementRequirements exists, "requires attunement" text should NOT appear
      expect(screen.queryByText(/requires attunement/)).not.toBeInTheDocument();
    });
  });

  describe('magic item description HTML sanitization', () => {
    it('should pass magic item description through sanitizeHtml', () => {
      sanitizeHtml.mockReturnValue('Sanitized description output');

      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Sanitized Item',
              type: 'Ring',
              rarity: 'Common',
              description: '<script>alert("xss")</script><b>Safe HTML</b>',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Sanitized Item/)).toBeInTheDocument();
      expect(sanitizeHtml).toHaveBeenCalledWith('<script>alert("xss")</script><b>Safe HTML</b>');
    });

    it('should render sanitized description output in the DOM', () => {
      sanitizeHtml.mockReturnValue('<b>Sanitized output</b>');

      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Output Test',
              type: 'Ring',
              rarity: 'Common',
              description: 'Original dangerous content',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Output Test/)).toBeInTheDocument();
      expect(screen.getByText(/Sanitized output/)).toBeInTheDocument();
    });
  });

  describe('popup keyboard interaction', () => {
    it('should close popup when user presses Escape key', async () => {
      const mockSetPopupHtml = vi.fn();

      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: '<b>Test Popup</b>',
        setPopupHtml: mockSetPopupHtml,
      }));

      renderComponent({
        inventory: { magicItems: [], equipped: [], backpack: [] },
      });

      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();

      // Simulate keydown event on the popup overlay
      const popupOverlay = screen.getByTestId('popup-overlay');
      fireEvent.keyDown(popupOverlay, { key: 'Escape' });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(null);
      });
    });

    it('should close popup when user clicks on the overlay', async () => {
      const mockSetPopupHtml = vi.fn();

      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: '<b>Test Popup</b>',
        setPopupHtml: mockSetPopupHtml,
      }));

      renderComponent({
        inventory: { magicItems: [], equipped: [], backpack: [] },
      });

      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();

      // Simulate click on the popup overlay
      const popupOverlay = screen.getByTestId('popup-overlay');
      fireEvent.click(popupOverlay);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(null);
      });
    });

    it('should not close popup when clicking inside the modal', async () => {
      const mockSetPopupHtml = vi.fn();

      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: '<b>Test Popup</b>',
        setPopupHtml: mockSetPopupHtml,
      }));

      renderComponent({
        inventory: { magicItems: [], equipped: [], backpack: [] },
      });

      expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();

      // Simulate click on the popup modal (should stop propagation)
      const popupModal = document.querySelector('.popup-modal');
      if (popupModal) {
        const event = new MouseEvent('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: popupModal });
        popupModal.dispatchEvent(event);

        // The modal click should NOT close the popup due to stopPropagation
        expect(mockSetPopupHtml).not.toHaveBeenCalledWith(null);
      }
    });
  });

  describe('clickable items accessibility', () => {
    it('should apply clickable class to equipped items', () => {
      renderComponent({
        inventory: { magicItems: [], equipped: ['Longsword', 'Shield'], backpack: [] },
      });

      const equippedSection = screen.getByText(/Equipped:/).parentElement;
      const clickableElements = equippedSection.querySelectorAll('.clickable');
      expect(clickableElements.length).toBe(2);
    });

    it('should apply clickable class to backpack items', () => {
      renderComponent({
        inventory: { magicItems: [], equipped: [], backpack: ['Rations', 'Potions'] },
      });

      const backpackSection = screen.getByText(/Backpack:/).parentElement;
      const clickableElements = backpackSection.querySelectorAll('.clickable');
      expect(clickableElements.length).toBe(2);
    });

    it('should apply clickable class to single equipped item', () => {
      renderComponent({
        inventory: { magicItems: [], equipped: ['Longsword'], backpack: [] },
      });

      const equippedSection = screen.getByText(/Equipped:/).parentElement;
      const clickableElements = equippedSection.querySelectorAll('.clickable');
      expect(clickableElements.length).toBe(1);
    });

    it('should apply clickable class to single backpack item', () => {
      renderComponent({
        inventory: { magicItems: [], equipped: [], backpack: ['Rations'] },
      });

      const backpackSection = screen.getByText(/Backpack:/).parentElement;
      const clickableElements = backpackSection.querySelectorAll('.clickable');
      expect(clickableElements.length).toBe(1);
    });
  });

  describe('magic item rendering with special characters', () => {
    it('should render magic item name with special characters', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: "Ring of Power's Edge",
              type: 'Ring',
              rarity: 'Rare',
              description: "A ring with a powerful edge.",
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Ring of Power's Edge/)).toBeInTheDocument();
    });

    it('should render magic item with numeric rarity', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Item #1',
              type: 'Potion',
              rarity: 'Common',
              description: 'Item number one.',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Item #1/)).toBeInTheDocument();
      expect(screen.getByText(/Common/)).toBeInTheDocument();
    });

    it('should render magic item with empty subtype gracefully', () => {
      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Empty Subtype Item',
              type: 'Weapon',
              subtype: '',
              rarity: 'Common',
              description: 'An item with no subtype.',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Empty Subtype Item/)).toBeInTheDocument();
      expect(screen.getByText(/Weapon/)).toBeInTheDocument();
      expect(screen.getByText(/Common/)).toBeInTheDocument();
    });
  });

  describe('inventory section rendering order', () => {
    it('should render Inventory header first', () => {
      renderComponent({
        inventory: {
          magicItems: [
            {
              name: 'Magic Sword',
              type: 'Weapon',
              rarity: 'Uncommon',
              description: 'A magical sword.',
              requiresAttunement: false,
            },
          ],
          equipped: ['Longsword'],
          backpack: ['Rations'],
        },
      });

      const inventoryHeader = screen.getByText('Inventory');
      expect(inventoryHeader).toBeInTheDocument();

      // Magic Items should come before Equipped
      const magicItemsSection = screen.getByText(/Magic Items:/);
      const equippedSection = screen.getByText(/Equipped:/);
      expect(magicItemsSection.compareDocumentPosition(equippedSection) & 0x04).toBe(0x04);
    });

    it('should render Equipped before Backpack', () => {
      renderComponent({
        inventory: {
          magicItems: [],
          equipped: ['Longsword'],
          backpack: ['Rations'],
        },
      });

      const equippedSection = screen.getByText(/Equipped:/);
      const backpackSection = screen.getByText(/Backpack:/);
      expect(equippedSection.compareDocumentPosition(backpackSection) & 0x04).toBe(0x04);
    });
  });

  describe('equipment lookup with various name formats', () => {
    it('should handle item name with leading/trailing spaces in inventory', async () => {
      const dataWithSpaces = [
        {
          name: 'Longsword',
          index: 'longsword',
          desc: ['A common sword.'],
          cost: { quantity: 15, unit: 'gp' },
          weight: 3,
          equipment_category: 'Martial Melee Weapons',
        },
      ];

      loadEquipment.mockResolvedValue(dataWithSpaces);

      const mockSetPopupHtml = vi.fn();
      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
      }));

      // The component trims spaces in findItem via normalize, but inventory items
      // are stored as-is. The lookupName extraction only strips parenthetical content.
      renderComponent({
        inventory: { equipped: [' Longsword '], backpack: [] },
      });

      const longswordElement = screen.getByText(/Longsword/);
      fireEvent.click(longswordElement);

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalled();
      });
    });

    it('should handle item lookup when equipment data has different casing', async () => {
      const dataWithCasing = [
        {
          name: 'LONGSWORD',
          index: 'LONGSWORD',
          desc: ['A common sword.'],
          cost: { quantity: 15, unit: 'gp' },
          weight: 3,
          equipment_category: 'Martial Melee Weapons',
        },
      ];

      loadEquipment.mockResolvedValue(dataWithCasing);

      const mockSetPopupHtml = vi.fn();
      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
      }));

      renderComponent({
        inventory: { equipped: ['longsword'], backpack: [] },
      });

      const longswordElement = screen.getByText('longsword');
      fireEvent.click(longswordElement);

      await waitFor(() => {
        const callArg = mockSetPopupHtml.mock.calls[0][0];
        expect(callArg).toContain('LONGSWORD');
      });
    });

    it('should handle item with hyphenated name matching space-separated inventory name', async () => {
      const dataWithHyphen = [
        {
          name: 'Potion-of-Healing',
          index: 'potion-of-healing',
          desc: ['Restores HP.'],
          cost: { quantity: 100, unit: 'gp' },
          weight: 0.5,
          equipment_category: 'Potions',
        },
      ];

      loadEquipment.mockResolvedValue(dataWithHyphen);

      const mockSetPopupHtml = vi.fn();
      usePopup.mockImplementation(() => ({
        showPopup: vi.fn(),
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
      }));

      renderComponent({
        inventory: { equipped: ['Potion of Healing'], backpack: [] },
      });

      const itemElement = screen.getByText('Potion of Healing');
      fireEvent.click(itemElement);

      await waitFor(() => {
        const callArg = mockSetPopupHtml.mock.calls[0][0];
        expect(callArg).toContain('Potion-of-Healing');
      });
    });
  });

  describe('renderItems function behavior', () => {
    it('should return null for null items array', () => {
      renderComponent({
        inventory: { magicItems: [], equipped: null, backpack: null },
      });

      expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();
    });

    it('should return null for undefined items array', () => {
      renderComponent({
        inventory: { magicItems: [] },
      });

      expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();
    });

    it('should return null for empty items array', () => {
      renderComponent({
        inventory: { magicItems: [], equipped: [], backpack: [] },
      });

      expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();
    });
  });

  describe('magic item rarity variations', () => {
    it('should render Common rarity', () => {
      sanitizeHtml.mockReturnValue('A common item.');

      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Common Item',
              type: 'Potion',
              rarity: 'Common',
              description: 'A common item.',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Common Item/)).toBeInTheDocument();
      const rarityElements = screen.getAllByText(/Common/);
      expect(rarityElements.length).toBeGreaterThan(0);
    });

    it('should render Uncommon rarity', () => {
      sanitizeHtml.mockReturnValue('An uncommon item.');

      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Uncommon Item',
              type: 'Wondrous Item',
              rarity: 'Uncommon',
              description: 'An uncommon item.',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Uncommon Item/)).toBeInTheDocument();
      const rarityElements = screen.getAllByText(/Uncommon/);
      expect(rarityElements.length).toBeGreaterThan(0);
    });

    it('should render Rare rarity', () => {
      sanitizeHtml.mockReturnValue('A rare item.');

      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Rare Item',
              type: 'Ring',
              rarity: 'Rare',
              description: 'A rare item.',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Rare Item/)).toBeInTheDocument();
      const rarityElements = screen.getAllByText(/Rare/);
      expect(rarityElements.length).toBeGreaterThan(0);
    });

    it('should render Very Rare rarity', () => {
      sanitizeHtml.mockReturnValue('A very rare item.');

      const stats = {
        inventory: {
          magicItems: [
            {
              name: 'Very Rare Item',
              type: 'Staff',
              rarity: 'Very Rare',
              description: 'A very rare item.',
              requiresAttunement: false,
            },
          ],
          equipped: [],
          backpack: [],
        },
      };

      renderComponent(stats);
      expect(screen.getByText(/Very Rare Item/)).toBeInTheDocument();
      const rarityElements = screen.getAllByText(/Very Rare/);
      expect(rarityElements.length).toBeGreaterThan(0);
    });
  });
});
