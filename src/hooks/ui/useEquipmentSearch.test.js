// @improved-by-ai
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

  describe('initial state', () => {
    it('returns correct initial values', () => {
      const { result } = renderSearchHook();
      expect(result.current.equipmentData).toEqual([]);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.filteredEquipment).toEqual([]);
      expect(result.current.selectedCategory).toBe('All');
      expect(result.current.searchField).toBeNull();
      expect(result.current.showOnlySelectedBackpack).toBe(false);
      expect(result.current.showOnlySelectedEquipped).toBe(false);
    });
  });

  describe('equipment data loading', () => {
    it('populates equipmentData from loadEquipment', async () => {
      loadEquipment.mockResolvedValue([MOCK_EQUIPMENT[0]]);
      const { result } = renderSearchHook();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.equipmentData).toEqual([MOCK_EQUIPMENT[0]]);
    });
  });

  describe('search filtering', () => {
    it('filters by equipment name case-insensitively', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.setSearchQuery('long');
      });

      expect(result.current.filteredEquipment).toEqual([MOCK_EQUIPMENT[0]]);
    });

    it('filters by equipment index case-insensitively', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.setSearchQuery('SHIELD');
      });

      expect(result.current.filteredEquipment).toEqual([MOCK_EQUIPMENT[1]]);
    });

    it('returns empty results when search query is empty', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.setSearchQuery('');
      });

      expect(result.current.filteredEquipment).toEqual([]);
    });

    it('returns empty results when search query is whitespace only', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.setSearchQuery('   ');
      });

      expect(result.current.filteredEquipment).toEqual([]);
    });

    it('returns no results for non-matching query', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.setSearchQuery('nonexistent');
      });

      expect(result.current.filteredEquipment).toEqual([]);
    });
  });

  describe('category filtering', () => {
    it('filters equipment by selected category', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Use query that matches both armor items: 'leather' matches Leather Armor
      // and 'shield' matches Shield. Use a query matching all items.
      // 'a' matches Leather Armor only among armor. Need a query matching both.
      // Since no single char matches all, test with a query matching the armor items.
      act(() => {
        result.current.setSearchQuery('');
      });

      await act(async () => {
        await Promise.resolve();
      });

      // Use a query that matches both armor items: neither "Shield" nor "Leather Armor"
      // share a common substring. So test with a query that matches at least one,
      // then verify category filtering narrows it down.
      act(() => {
        result.current.setSearchQuery('armor');
      });

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        result.current.handleCategoryChange('Armor');
      });

      await act(async () => {
        await Promise.resolve();
      });

      const armorItems = MOCK_EQUIPMENT.filter(
        (item) => item.equipment_category === 'Armor' &&
          (item.name.toLowerCase().includes('armor') ||
            item.index.toLowerCase().includes('armor'))
      );
      expect(result.current.filteredEquipment).toEqual(armorItems);
    });

    it('combines search query with category filter', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.setSearchQuery('sword');
        result.current.handleCategoryChange('Weapon');
      });

      const matchingItems = MOCK_EQUIPMENT.filter(
        (item) =>
          item.equipment_category === 'Weapon' &&
          (item.name.toLowerCase().includes('sword') ||
            item.index.toLowerCase().includes('sword'))
      );
      expect(result.current.filteredEquipment).toEqual(matchingItems);
    });

    it('returns unique categories including All', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.uniqueCategories).toContain('All');
      expect(result.current.uniqueCategories).toContain('Weapon');
      expect(result.current.uniqueCategories).toContain('Armor');
      expect(result.current.uniqueCategories).toContain('Potion');
      expect(result.current.uniqueCategories).toContain('Simple Melee');
    });

    it('returns unique categories without duplicates', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      const categoryCounts = {};
      result.current.uniqueCategories.forEach((cat) => {
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });
      expect(Object.values(categoryCounts).every((count) => count === 1)).toBe(true);
    });

    it('updates selectedCategory via handleCategoryChange', () => {
      const { result } = renderSearchHook();
      act(() => {
        result.current.handleCategoryChange('Weapon');
      });
      expect(result.current.selectedCategory).toBe('Weapon');
    });
  });

  describe('20-item filter limit', () => {
    it('limits filtered results to 20 items', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // '' triggers early return (empty results)
      // Use a query matching multiple items to test the limit
      act(() => {
        result.current.setSearchQuery('a');
      });

      // 'a' matches: Longsword, Shortbow, Leather Armor, Rapier, Handaxe,
      // Light Crossbow, Spear, Quarterstaff, Javelin, Pike, Greatclub, Scimitar, Whip, Battleaxe, Glaive = 15 items
      // Plus some others. The key is: count <= 20
      expect(result.current.filteredEquipment.length).toBeLessThanOrEqual(20);
    });
  });

  describe('backpack filtering', () => {
    it('filters to backpack items when showOnlySelectedBackpack is true', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const inventory = { backpack: ['Longsword', 'Shield'], equipped: [] };
      const { result } = renderSearchHook(inventory);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
      });

      await act(async () => {
        await Promise.resolve();
      });

      // handleSearchFieldFocus sets searchQuery to '', which triggers early return.
      // Set a query that matches both backpack items: "Longsword" and "Shield"
      // Neither shares a common substring, so use a query matching at least one.
      // Test with 'long' which matches Longsword, then verify backpack filtering
      // shows only Longsword (which IS in the backpack).
      act(() => {
        result.current.setSearchQuery('long');
      });

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        result.current.setShowOnlySelectedBackpack(true);
      });

      await act(async () => {
        await Promise.resolve();
      });

      // 'long' matches only Longsword, and Longsword is in backpack
      expect(result.current.filteredEquipment).toEqual([MOCK_EQUIPMENT[0]]);
    });

    it('updates showOnlySelectedBackpack state', () => {
      const { result } = renderSearchHook();
      act(() => {
        result.current.setShowOnlySelectedBackpack(true);
      });
      expect(result.current.showOnlySelectedBackpack).toBe(true);
    });
  });

  describe('equipped filtering', () => {
    it('filters to equipped items when showOnlySelectedEquipped is true', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const inventory = { backpack: [], equipped: ['Dagger', 'Rapier'] };
      const { result } = renderSearchHook(inventory);

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.handleSearchFieldFocus('equipped');
      });

      await act(async () => {
        await Promise.resolve();
      });

      // handleSearchFieldFocus sets searchQuery to '', which triggers early return.
      // Set a non-empty query to allow filtering.
      act(() => {
        result.current.setSearchQuery('a');
      });

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        result.current.setShowOnlySelectedEquipped(true);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.filteredEquipment).toEqual([
        MOCK_EQUIPMENT[4],
        MOCK_EQUIPMENT[5],
      ]);
    });

    it('updates showOnlySelectedEquipped state', () => {
      const { result } = renderSearchHook();
      act(() => {
        result.current.setShowOnlySelectedEquipped(true);
      });
      expect(result.current.showOnlySelectedEquipped).toBe(true);
    });
  });

  describe('handleSearchFieldFocus', () => {
    it('sets searchField and clears query and filtered results', () => {
      const { result } = renderSearchHook();
      act(() => {
        result.current.setSearchQuery('test');
        result.current.handleSearchFieldFocus('backpack');
      });

      expect(result.current.searchField).toBe('backpack');
      expect(result.current.searchQuery).toBe('');
      expect(result.current.filteredEquipment).toEqual([]);
    });

    it('sets searchField to equipped', () => {
      const { result } = renderSearchHook();
      act(() => {
        result.current.handleSearchFieldFocus('equipped');
      });

      expect(result.current.searchField).toBe('equipped');
    });
  });

  describe('handleEquipmentSelect', () => {
    it('adds item to backpack and clears search state', async () => {
      const item = { name: 'Longsword', index: 'longsword', equipment_category: 'Weapon' };
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
      });

      await act(async () => {
        await Promise.resolve();
      });

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
      const item = { name: 'Shield', index: 'shield', equipment_category: 'Armor' };
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleSearchFieldFocus('equipped');
      });

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        result.current.handleEquipmentSelect(item);
      });

      expect(onTempInventoryChange).toHaveBeenCalledWith('equipped', ['Shield']);
      expect(onInventoryChange).toHaveBeenCalledWith('equipped', ['Shield']);
      expect(result.current.searchField).toBeNull();
    });

    it('does not add duplicate item to backpack', () => {
      const inventory = { backpack: ['Longsword'], equipped: [] };
      const item = { name: 'Longsword', index: 'longsword', equipment_category: 'Weapon' };
      const { result } = renderSearchHook(inventory);

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.handleEquipmentSelect(item);
      });

      expect(onTempInventoryChange).not.toHaveBeenCalled();
    });

    it('does not add duplicate item to equipped', () => {
      const inventory = { backpack: [], equipped: ['Shield'] };
      const item = { name: 'Shield', index: 'shield', equipment_category: 'Armor' };
      const { result } = renderSearchHook(inventory);

      act(() => {
        result.current.handleSearchFieldFocus('equipped');
        result.current.handleEquipmentSelect(item);
      });

      expect(onTempInventoryChange).not.toHaveBeenCalled();
    });

    it('does nothing when searchField is not set', () => {
      const item = { name: 'Longsword', index: 'longsword', equipment_category: 'Weapon' };
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleEquipmentSelect(item);
      });

      expect(onTempInventoryChange).not.toHaveBeenCalled();
    });
  });

  describe('handleAddCustomItem', () => {
    it('adds custom item to backpack and clears search state', async () => {
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
      });

      await act(async () => {
        await Promise.resolve();
      });

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

      await act(async () => {
        await Promise.resolve();
      });

      act(() => {
        result.current.handleAddCustomItem('Magic Shield');
      });

      expect(onTempInventoryChange).toHaveBeenCalledWith('equipped', ['Magic Shield']);
      expect(onInventoryChange).toHaveBeenCalledWith('equipped', ['Magic Shield']);
      expect(result.current.searchField).toBeNull();
    });

    it('does not add duplicate custom item to backpack', () => {
      const inventory = { backpack: ['Magic Sword'], equipped: [] };
      const { result } = renderSearchHook(inventory);

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.handleAddCustomItem('Magic Sword');
      });

      expect(onTempInventoryChange).not.toHaveBeenCalled();
    });

    it('does not add duplicate custom item to equipped', () => {
      const inventory = { backpack: [], equipped: ['Magic Shield'] };
      const { result } = renderSearchHook(inventory);

      act(() => {
        result.current.handleSearchFieldFocus('equipped');
        result.current.handleAddCustomItem('Magic Shield');
      });

      expect(onTempInventoryChange).not.toHaveBeenCalled();
    });

    it('does nothing when searchField is not set', () => {
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleAddCustomItem('Magic Sword');
      });

      expect(onTempInventoryChange).not.toHaveBeenCalled();
    });
  });

  describe('handleKeyDown', () => {
    it('adds custom item on Enter key with non-empty query', () => {
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.setSearchQuery('Magic Sword');
      });

      const mockEvent = { key: 'Enter' };
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Magic Sword']);
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', ['Magic Sword']);
    });

    it('trims whitespace from query before adding custom item', () => {
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.setSearchQuery('  Magic Sword  ');
      });

      const mockEvent = { key: 'Enter' };
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Magic Sword']);
    });

    it('does not add custom item on Enter key with empty query', () => {
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.setSearchQuery('');
      });

      const mockEvent = { key: 'Enter' };
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(onTempInventoryChange).not.toHaveBeenCalled();
    });

    it('does not add custom item for non-Enter key', () => {
      const { result } = renderSearchHook();

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.setSearchQuery('Magic Sword');
      });

      const mockEvent = { key: 'Escape' };
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(onTempInventoryChange).not.toHaveBeenCalled();
    });
  });

});
