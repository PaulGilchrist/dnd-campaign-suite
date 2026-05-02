import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharInventory from './char-inventory';

// Mock the usePopup hook
vi.mock('./common/use-popup', () => ({
  default: vi.fn(),
}));

// Mock the sanitize service
vi.mock('../../services/sanitize', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

import usePopup from './common/use-popup';

const mockPlayerStats = {
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

describe('CharInventory', () => {
  beforeEach(() => {
    vi.clearAllMocks();

      // Mock usePopup to return a controlled popup
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: vi.fn(),
      PopupElement: null,
      setPopupHtml: vi.fn(),
      }));

      // Mock fetch
    global.fetch = vi.fn();
    });

  afterEach(() => {
    vi.restoreAllMocks();
    });

  it('should render magic items section header', () => {
    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

    expect(screen.getByText('Magic Items')).toBeInTheDocument();
    });

  it('should display magic item name', () => {
    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

    expect(screen.getByText(/Magic Sword/)).toBeInTheDocument();
    });

  it('should display magic item quantity', () => {
    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

    expect(screen.getByText(/qty 1/)).toBeInTheDocument();
    });

  it('should display magic item type and subtype', () => {
    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

    expect(screen.getByText(/Weapon/)).toBeInTheDocument();
      // Use getAllByText since Longsword appears in multiple places
    const longswordElements = screen.getAllByText(/Longsword/);
    expect(longswordElements.length).toBeGreaterThan(0);
     });

  it('should display magic item rarity', () => {
    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

    expect(screen.getByText(/Uncommon/)).toBeInTheDocument();
    });

  it('should display attunement requirements', () => {
    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

    expect(screen.getByText(/Warrior/)).toBeInTheDocument();
    });

  it('should display equipped items section', () => {
    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

    expect(screen.getByText(/Equipped:/)).toBeInTheDocument();
    });

  it('should display backpack items section', () => {
    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

    expect(screen.getByText(/Backpack:/)).toBeInTheDocument();
    });

  it('should display equipped item names', () => {
    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

        // Use regex to match text that may include trailing comma
    const longswordElements = screen.getAllByText(/Longsword/);
    expect(longswordElements.length).toBeGreaterThan(0);
    expect(screen.getByText('Shield')).toBeInTheDocument();
    });

  it('should display backpack item names', () => {
    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

    expect(screen.getByText(/Rations/)).toBeInTheDocument();
    expect(screen.getByText('Healing Potion')).toBeInTheDocument();
    });

  it('should call fetch when equipped item is clicked', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockEquipmentData,
      });

    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

      // Click on Shield which is unique
    const shieldElement = screen.getByText('Shield');
    fireEvent.click(shieldElement);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/data/equipment.json');
    });
     });

  it('should handle fetch error gracefully', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    const mockSetPopupHtml = vi.fn();
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: vi.fn(),
      PopupElement: null,
      setPopupHtml: mockSetPopupHtml,
      }));

    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

      // Click on Shield which is unique
    const shieldElement = screen.getByText('Shield');
    fireEvent.click(shieldElement);

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalled();
    });
     });

  it('should handle item not found in database', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => [],
      });

    const mockSetPopupHtml = vi.fn();
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: vi.fn(),
      PopupElement: null,
      setPopupHtml: mockSetPopupHtml,
      }));

    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

      // Click on Shield which is unique
    const shieldElement = screen.getByText('Shield');
    fireEvent.click(shieldElement);

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalled();
    });
     });

  it('should handle empty inventory', () => {
    const emptyStats = {
      inventory: {
        magicItems: [],
        equipped: [],
        backpack: [],
        },
      };

    render(
         <CharInventory playerStats={emptyStats} />
       );

     // Should not show section headers for empty sections
    expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Backpack:/)).not.toBeInTheDocument();
    });

  it('should handle missing inventory', () => {
    const emptyStats = { inventory: {} };

    render(
         <CharInventory playerStats={emptyStats} />
       );

     // Should not crash
    expect(screen.queryByText(/Equipped:/)).not.toBeInTheDocument();
    });

  it('should render popup element container', () => {
    const mockPopupElement = <div data-testid="popup">Popup Content</div>;
    usePopup.mockImplementation((buildHtml) => ({
      showPopup: vi.fn(),
      PopupElement: mockPopupElement,
      setPopupHtml: vi.fn(),
      }));

    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

    expect(screen.getByTestId('popup')).toBeInTheDocument();
    });

  it('should separate multiple items with commas', () => {
    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

      // Get the equipped section div and check its text content
    const equippedSection = screen.getByText(/Equipped:/).parentElement;
    expect(equippedSection.textContent).toContain(',');
     });

  it('should handle magic item without quantity', () => {
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
        },
      };

    render(
         <CharInventory playerStats={stats} />
       );

    expect(screen.getByText(/Magic Ring/)).toBeInTheDocument();
    expect(screen.queryByText(/qty/)).not.toBeInTheDocument();
    });

  it('should handle magic item without attunement requirements', () => {
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
        },
      };

    render(
         <CharInventory playerStats={stats} />
       );

    expect(screen.getByText(/Magic Ring/)).toBeInTheDocument();
    expect(screen.queryByText(/requires attunement/)).not.toBeInTheDocument();
    });
});