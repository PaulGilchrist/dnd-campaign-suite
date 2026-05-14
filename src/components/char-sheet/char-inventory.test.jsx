import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CharInventory from './char-inventory.jsx';

// Mock the data-loader service
vi.mock('../../services/data-loader.js', () => ({
  loadEquipment: vi.fn(),
  clearDataCache: vi.fn(),
}));

// Mock the usePopup hook
vi.mock('../../hooks/use-popup.js', () => ({
  default: vi.fn(),
}));

// Mock the sanitize service
vi.mock('../../services/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

import usePopup from '../../hooks/use-popup.js';
import { loadEquipment } from '../../services/data-loader.js';

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
    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: vi.fn(),
      }));

      // Set up default mock for loadEquipment
    loadEquipment.mockResolvedValue(mockEquipmentData);
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

  it('should call loadEquipment when equipped item is clicked', async () => {
    render(
         <CharInventory playerStats={mockPlayerStats} />
       );

      // Click on Shield which is unique
    const shieldElement = screen.getByText('Shield');
    fireEvent.click(shieldElement);

    await waitFor(() => {
      expect(loadEquipment).toHaveBeenCalled();
    });
     });

  it('should handle loadEquipment error gracefully', async () => {
    loadEquipment.mockRejectedValue(new Error('Network error'));

    const mockSetPopupHtml = vi.fn();
      usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
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
     loadEquipment.mockResolvedValue([]);

     const mockSetPopupHtml = vi.fn();
     usePopup.mockImplementation(() => ({
       showPopup: vi.fn(),
       popupHtml: null,
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
    const mockPopupElement = <div data-testid="popup-overlay">Popup Content</div>;
    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: mockPopupElement,
      setPopupHtml: vi.fn(),
    }));

    render(
      <CharInventory playerStats={mockPlayerStats} />
    );

    expect(screen.getByTestId('popup-overlay')).toBeInTheDocument();
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

    const stats = {
      inventory: {
        equipped: ['Arrows'],
        backpack: [],
      },
    };

    const mockSetPopupHtml = vi.fn();
    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: mockSetPopupHtml,
    }));

    render(
      <CharInventory playerStats={stats} />
    );

    const arrowsElement = screen.getByText('Arrows');
    fireEvent.click(arrowsElement);

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Arrow'));
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

    const stats = {
      inventory: {
        equipped: [],
        backpack: ['Ration'],
      },
    };

    const mockSetPopupHtml = vi.fn();
    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: mockSetPopupHtml,
    }));

    render(
      <CharInventory playerStats={stats} />
    );

    const rationElement = screen.getByText('Ration');
    fireEvent.click(rationElement);

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Rations'));
    });
  });

  it('should display item cost property', async () => {
    const mockSetPopupHtml = vi.fn();
    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: mockSetPopupHtml,
    }));

    render(
      <CharInventory playerStats={mockPlayerStats} />
    );

    // Find the equipped section and click on Longsword there
    const equippedSection = screen.getByText(/Equipped:/).parentElement;
    const longswordElement = equippedSection.querySelector('.clickable');
    fireEvent.click(longswordElement);

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Cost:'));
    });
  });

  it('should display item weight property', async () => {
    const mockSetPopupHtml = vi.fn();
    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: mockSetPopupHtml,
    }));

    render(
      <CharInventory playerStats={mockPlayerStats} />
    );

    const equippedSection = screen.getByText(/Equipped:/).parentElement;
    const longswordElement = equippedSection.querySelector('.clickable');
    fireEvent.click(longswordElement);

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Weight:'));
    });
  });

  it('should display item ability property', async () => {
    const dataWithAbility = [
      {
        ...mockEquipmentData[0],
        ability: 'Strength',
      },
    ];

    loadEquipment.mockResolvedValue(dataWithAbility);

    const mockSetPopupHtml = vi.fn();
    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: mockSetPopupHtml,
    }));

    render(
      <CharInventory playerStats={mockPlayerStats} />
    );

    const equippedSection = screen.getByText(/Equipped:/).parentElement;
    const longswordElement = equippedSection.querySelector('.clickable');
    fireEvent.click(longswordElement);

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Weight:'));
    });
  });

  it('should display item ability property', async () => {
    const dataWithAbility = [
      {
        ...mockEquipmentData[0],
        ability: 'Strength',
      },
    ];

    loadEquipment.mockResolvedValue(dataWithAbility);

    const mockSetPopupHtml = vi.fn();
    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: mockSetPopupHtml,
    }));

    render(
      <CharInventory playerStats={mockPlayerStats} />
    );

    const equippedSection = screen.getByText(/Equipped:/).parentElement;
    const longswordElement = equippedSection.querySelector('.clickable');
    fireEvent.click(longswordElement);

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Ability:'));
    });
  });

  it('should display item utilize property', async () => {
    const dataWithUtilize = [
      {
        ...mockEquipmentData[0],
        utilize: 'Dexterity (Dex) check',
      },
    ];

    loadEquipment.mockResolvedValue(dataWithUtilize);

    const mockSetPopupHtml = vi.fn();
    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: mockSetPopupHtml,
    }));

    render(
      <CharInventory playerStats={mockPlayerStats} />
    );

    const equippedSection = screen.getByText(/Equipped:/).parentElement;
    const longswordElement = equippedSection.querySelector('.clickable');
    fireEvent.click(longswordElement);

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Utilize:'));
    });
  });

  it('should display item craft property', async () => {
    const dataWithCraft = [
      {
        ...mockEquipmentData[0],
        craft: 'Smiths tools',
      },
    ];

    loadEquipment.mockResolvedValue(dataWithCraft);

    const mockSetPopupHtml = vi.fn();
    usePopup.mockImplementation(() => ({
      showPopup: vi.fn(),
      popupHtml: null,
      setPopupHtml: mockSetPopupHtml,
    }));

    render(
      <CharInventory playerStats={mockPlayerStats} />
    );

    const equippedSection = screen.getByText(/Equipped:/).parentElement;
    const longswordElement = equippedSection.querySelector('.clickable');
    fireEvent.click(longswordElement);

    await waitFor(() => {
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Craft:'));
    });
  });
});