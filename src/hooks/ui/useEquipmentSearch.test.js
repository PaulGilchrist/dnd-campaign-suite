// @maintained-by-ai
// Deterministic unit tests for the pure useEquipmentSearch hook. All data loading
// is mocked; assertions cover the stable filter/select contract and should not
// churn as the app UI evolves.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEquipmentSearch } from './useEquipmentSearch.js';

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(),
}));

const { loadEquipment } = await import('../../services/ui/dataLoader.js');

const MOCK_EQUIPMENT = [
  { name: 'Longsword', index: 'longsword', equipment_category: 'Weapon' },
  { name: 'Shield', index: 'shield', equipment_category: 'Armor' },
  { name: 'Shortbow', index: 'shortbow', equipment_category: 'Weapon' },
  { name: 'Leather Armor', index: 'leather-armor', equipment_category: 'Armor' },
  { name: 'Dagger', index: 'dagger', equipment_category: 'Weapon' },
  { name: 'Rapier', index: 'rapier', equipment_category: 'Weapon' },
  { name: 'Handaxe', index: 'handaxe', equipment_category: 'Weapon' },
  { name: 'Light Crossbow', index: 'light-crossbow', equipment_category: 'Weapon' },
  { name: 'Net', index: 'net', equipment_category: 'Weapon' },
  { name: 'Spear', index: 'spear', equipment_category: 'Weapon' },
  { name: 'Mace', index: 'mace', equipment_category: 'Weapon' },
  { name: 'Quarterstaff', index: 'quarterstaff', equipment_category: 'Weapon' },
  { name: 'Javelin', index: 'javelin', equipment_category: 'Weapon' },
  { name: 'Pike', index: 'pike', equipment_category: 'Weapon' },
  { name: 'Greatclub', index: 'greatclub', equipment_category: 'Weapon' },
  { name: 'Scimitar', index: 'scimitar', equipment_category: 'Weapon' },
  { name: 'Whip', index: 'whip', equipment_category: 'Weapon' },
  { name: 'Battleaxe', index: 'battleaxe', equipment_category: 'Weapon' },
  { name: 'Glaive', index: 'glaive', equipment_category: 'Weapon' },
  { name: 'Hoe', index: 'hoe', equipment_category: 'Simple Melee' },
  { name: 'Potion of Healing', index: 'potion-of-healing', equipment_category: 'Potion' },
];

// Flush pending effects/microtasks so hook state settles.
const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

describe('useEquipmentSearch', () => {
  let onTempInventoryChange;
  let onInventoryChange;
  let tempInventory;

  beforeEach(() => {
    vi.clearAllMocks();
    loadEquipment.mockResolvedValue([]);
    onTempInventoryChange = vi.fn();
    onInventoryChange = vi.fn();
    tempInventory = { backpack: [], equipped: [] };
  });

  function renderSearchHook(inventory = tempInventory) {
    return renderHook(() =>
      useEquipmentSearch(inventory, onTempInventoryChange, onInventoryChange)
    );
  }

  describe('equipment data loading', () => {
    it('populates equipmentData from loadEquipment', async () => {
      loadEquipment.mockResolvedValue([MOCK_EQUIPMENT[0]]);
      const { result } = renderSearchHook();

      await flush();

      expect(result.current.equipmentData).toEqual([MOCK_EQUIPMENT[0]]);
    });
  });

  describe('search filtering', () => {
    it('filters by name and index case-insensitively', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();
      await flush();

      act(() => {
        result.current.setSearchQuery('long');
      });
      expect(result.current.filteredEquipment).toEqual([MOCK_EQUIPMENT[0]]);

      act(() => {
        result.current.setSearchQuery('SHIELD');
      });
      expect(result.current.filteredEquipment).toEqual([MOCK_EQUIPMENT[1]]);
    });

    it('returns no results for whitespace-only or non-matching queries', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();
      await flush();

      act(() => {
        result.current.setSearchQuery('long');
      });
      expect(result.current.filteredEquipment).toEqual([MOCK_EQUIPMENT[0]]);

      act(() => {
        result.current.setSearchQuery('   ');
      });
      expect(result.current.filteredEquipment).toEqual([]);

      act(() => {
        result.current.setSearchQuery('nonexistent');
      });
      expect(result.current.filteredEquipment).toEqual([]);
    });

    it('limits filtered results to 20 items', async () => {
      const manyItems = Array.from({ length: 25 }, (_, i) => ({
        name: `Item ${i}`,
        index: `item-${i}`,
        equipment_category: 'Weapon',
      }));
      loadEquipment.mockResolvedValue(manyItems);
      const { result } = renderSearchHook();
      await flush();

      act(() => {
        result.current.setSearchQuery('item');
      });

      expect(result.current.filteredEquipment).toHaveLength(20);
      expect(result.current.filteredEquipment[0]).toEqual(manyItems[0]);
    });
  });

  describe('category filtering', () => {
    it('filters by category alone (no search query)', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();
      await flush();

      act(() => {
        result.current.handleCategoryChange('Armor');
      });

      expect(result.current.filteredEquipment).toEqual([
        MOCK_EQUIPMENT[1], // Shield
        MOCK_EQUIPMENT[3], // Leather Armor
      ]);
    });

    it('combines search query with category filter', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();
      await flush();

      act(() => {
        result.current.setSearchQuery('sword');
        result.current.handleCategoryChange('Weapon');
      });

      expect(result.current.filteredEquipment).toEqual([MOCK_EQUIPMENT[0]]);

      act(() => {
        result.current.handleCategoryChange('Armor');
      });
      expect(result.current.filteredEquipment).toEqual([]);
    });

    it('returns unique categories including All', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();
      await flush();

      expect(result.current.uniqueCategories).toEqual([
        'All', 'Weapon', 'Armor', 'Simple Melee', 'Potion',
      ]);
    });
  });

  describe('selected-inventory filtering', () => {
    it('filters to backpack items when showOnlySelectedBackpack is true', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const inventory = { backpack: ['Longsword', 'Shield'], equipped: [] };
      const { result } = renderSearchHook(inventory);
      await flush();

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
      });
      await flush();

      act(() => {
        result.current.setSearchQuery('long');
      });
      await flush();

      act(() => {
        result.current.setShowOnlySelectedBackpack(true);
      });
      await flush();

      expect(result.current.filteredEquipment).toEqual([MOCK_EQUIPMENT[0]]);
    });

    it('filters to equipped items when showOnlySelectedEquipped is true', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const inventory = { backpack: [], equipped: ['Dagger', 'Rapier'] };
      const { result } = renderSearchHook(inventory);
      await flush();

      act(() => {
        result.current.handleSearchFieldFocus('equipped');
        result.current.setSearchQuery('a');
      });
      await flush();

      act(() => {
        result.current.setShowOnlySelectedEquipped(true);
      });
      await flush();

      expect(result.current.filteredEquipment).toEqual([
        MOCK_EQUIPMENT[4], // Dagger
        MOCK_EQUIPMENT[5], // Rapier
      ]);
    });
  });

  describe('handleSearchFieldFocus', () => {
    it('sets searchField and clears query and filtered results', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();
      await flush();

      act(() => {
        result.current.setSearchQuery('long');
      });
      expect(result.current.filteredEquipment).toEqual([MOCK_EQUIPMENT[0]]);

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
      });

      expect(result.current.searchField).toBe('backpack');
      expect(result.current.searchQuery).toBe('');
      expect(result.current.filteredEquipment).toEqual([]);
    });
  });

  describe('handleEquipmentSelect', () => {
    it('adds item to backpack and clears search state', async () => {
      const item = MOCK_EQUIPMENT[0]; // Longsword
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
      });
      await flush();

      act(() => {
        result.current.handleEquipmentSelect(item);
      });

      expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Longsword']);
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', ['Longsword']);
      expect(result.current.searchField).toBeNull();
      expect(result.current.searchQuery).toBe('');
      expect(result.current.filteredEquipment).toEqual([]);
    });

    it('adds item to equipped and clears search state', async () => {
      const item = MOCK_EQUIPMENT[1]; // Shield
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleSearchFieldFocus('equipped');
      });
      await flush();

      act(() => {
        result.current.handleEquipmentSelect(item);
      });

      expect(onTempInventoryChange).toHaveBeenCalledWith('equipped', ['Shield']);
      expect(onInventoryChange).toHaveBeenCalledWith('equipped', ['Shield']);
      expect(result.current.searchField).toBeNull();
    });
  });

  describe('handleAddCustomItem', () => {
    it('adds custom item to backpack and clears search state', async () => {
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
      });
      await flush();

      act(() => {
        result.current.handleAddCustomItem('Magic Sword');
      });

      expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Magic Sword']);
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', ['Magic Sword']);
      expect(result.current.searchField).toBeNull();
      expect(result.current.searchQuery).toBe('');
    });

    it('adds custom item to equipped', async () => {
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleSearchFieldFocus('equipped');
      });
      await flush();

      act(() => {
        result.current.handleAddCustomItem('Magic Shield');
      });

      expect(onTempInventoryChange).toHaveBeenCalledWith('equipped', ['Magic Shield']);
      expect(onInventoryChange).toHaveBeenCalledWith('equipped', ['Magic Shield']);
      expect(result.current.searchField).toBeNull();
    });
  });

  describe('handleKeyDown', () => {
    it('adds trimmed custom item on Enter', async () => {
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.setSearchQuery('  Magic Sword  ');
      });

      act(() => {
        result.current.handleKeyDown({ key: 'Enter' });
      });

      expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Magic Sword']);
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', ['Magic Sword']);
    });

    it('does not add custom item on Enter with whitespace-only query', async () => {
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.setSearchQuery('   ');
      });

      act(() => {
        result.current.handleKeyDown({ key: 'Enter' });
      });

      expect(onTempInventoryChange).not.toHaveBeenCalled();
    });

    it('does not add custom item for non-Enter key', async () => {
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.setSearchQuery('Magic Sword');
      });

      act(() => {
        result.current.handleKeyDown({ key: 'Escape' });
      });

      expect(onTempInventoryChange).not.toHaveBeenCalled();
    });
  });
});
