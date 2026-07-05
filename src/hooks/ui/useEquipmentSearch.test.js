// @cleaned-by-ai
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

    it('returns empty results when search query is empty or whitespace', async () => {
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

      act(() => {
        result.current.setSearchQuery('');
      });

      await act(async () => {
        await Promise.resolve();
      });

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
  });

  describe('20-item filter limit', () => {
    it('limits filtered results to 20 items', async () => {
      loadEquipment.mockResolvedValue(MOCK_EQUIPMENT);
      const { result } = renderSearchHook();

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.setSearchQuery('a');
      });

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

      expect(result.current.filteredEquipment).toEqual([MOCK_EQUIPMENT[0]]);
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

    it('does not add duplicate item to backpack or equipped', () => {
      const inventory = { backpack: ['Longsword'], equipped: ['Shield'] };
      const item = { name: 'Longsword', index: 'longsword', equipment_category: 'Weapon' };
      const { result } = renderSearchHook(inventory);

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
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
