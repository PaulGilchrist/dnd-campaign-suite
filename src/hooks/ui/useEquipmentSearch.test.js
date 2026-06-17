import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEquipmentSearch } from './useEquipmentSearch.js';

vi.mock('../../services/ui/dataLoader.js', () => ({
  loadEquipment: vi.fn(() => Promise.resolve([])),
}));

const { loadEquipment } = await import('../../services/ui/dataLoader.js');

describe('useEquipmentSearch', () => {
  const mockOnTempInventoryChange = vi.fn();
  const mockOnInventoryChange = vi.fn();
  const tempInventory = { backpack: [], equipped: [] };

  beforeEach(() => {
    vi.clearAllMocks();
    loadEquipment.mockResolvedValue([]);
  });

  describe('initial state', () => {
    it('returns empty equipmentData initially', async () => {
      loadEquipment.mockResolvedValue([
        { name: 'Longsword', index: 'longsword', equipment_category: 'Weapon' },
      ]);
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );
      expect(result.current.equipmentData).toEqual([]);
    });

    it('returns empty searchQuery', () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );
      expect(result.current.searchQuery).toBe('');
    });

    it('returns empty filteredEquipment', () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );
      expect(result.current.filteredEquipment).toEqual([]);
    });

    it('returns All as default selectedCategory', () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );
      expect(result.current.selectedCategory).toBe('All');
    });

    it('returns null searchField', () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );
      expect(result.current.searchField).toBeNull();
    });

    it('returns false for showOnlySelectedBackpack and showOnlySelectedEquipped', () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );
      expect(result.current.showOnlySelectedBackpack).toBe(false);
      expect(result.current.showOnlySelectedEquipped).toBe(false);
    });
  });

  describe('search functionality', () => {
    it('returns empty filteredEquipment when searchQuery is empty', () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );
      expect(result.current.filteredEquipment).toEqual([]);
    });

    it('clears filteredEquipment when searchQuery is set to empty string', async () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.setSearchQuery('');
      });

      expect(result.current.filteredEquipment).toEqual([]);
    });

    it('trims searchQuery before filtering', () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.setSearchQuery('  ');
      });

      expect(result.current.filteredEquipment).toEqual([]);
    });
  });

  describe('category filtering', () => {
    it('updates selectedCategory', () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.handleCategoryChange('Weapon');
      });

      expect(result.current.selectedCategory).toBe('Weapon');
    });

    it('returns uniqueCategories including All', () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      expect(result.current.uniqueCategories).toContain('All');
    });
  });

  describe('backpack filtering', () => {
    it('sets showOnlySelectedBackpack state', () => {
      const inventory = { backpack: ['Longsword'], equipped: [] };

      const { result } = renderHook(() =>
        useEquipmentSearch(inventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.setShowOnlySelectedBackpack(true);
      });

      expect(result.current.showOnlySelectedBackpack).toBe(true);
    });
  });

  describe('equipped filtering', () => {
    it('sets showOnlySelectedEquipped state', () => {
      const inventory = { backpack: [], equipped: ['Shield'] };

      const { result } = renderHook(() =>
        useEquipmentSearch(inventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.setShowOnlySelectedEquipped(true);
      });

      expect(result.current.showOnlySelectedEquipped).toBe(true);
    });
  });

  describe('handleSearchFieldFocus', () => {
    it('sets searchField and clears query and filtered results', () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.setSearchQuery('test');
        result.current.handleSearchFieldFocus('backpack');
      });

      expect(result.current.searchField).toBe('backpack');
      expect(result.current.searchQuery).toBe('');
      expect(result.current.filteredEquipment).toEqual([]);
    });

    it('sets searchField to equipped', () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.handleSearchFieldFocus('equipped');
      });

      expect(result.current.searchField).toBe('equipped');
    });
  });

  describe('handleEquipmentSelect', () => {
    it('has handleEquipmentSelect function', () => {
      const inventory = { backpack: [], equipped: [] };
      const { result } = renderHook(() =>
        useEquipmentSearch(inventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );
      expect(typeof result.current.handleEquipmentSelect).toBe('function');
    });

    it('has handleAddCustomItem function', () => {
      const inventory = { backpack: [], equipped: [] };
      const { result } = renderHook(() =>
        useEquipmentSearch(inventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );
      expect(typeof result.current.handleAddCustomItem).toBe('function');
    });

    it('does not add duplicate item to backpack', () => {
      const inventory = { backpack: ['Longsword'], equipped: [] };
      const item = { name: 'Longsword', index: 'longsword', equipment_category: 'Weapon' };

      const { result } = renderHook(() =>
        useEquipmentSearch(inventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.handleEquipmentSelect(item);
      });

      expect(mockOnTempInventoryChange).not.toHaveBeenCalled();
    });

    it('does not add duplicate item to equipped', () => {
      const inventory = { backpack: [], equipped: ['Shield'] };
      const item = { name: 'Shield', index: 'shield', equipment_category: 'Armor' };

      const { result } = renderHook(() =>
        useEquipmentSearch(inventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.handleSearchFieldFocus('equipped');
        result.current.handleEquipmentSelect(item);
      });

      expect(mockOnTempInventoryChange).not.toHaveBeenCalled();
    });
  });

  describe('handleAddCustomItem', () => {
    it('has handleAddCustomItem function', () => {
      const inventory = { backpack: [], equipped: [] };
      const { result } = renderHook(() =>
        useEquipmentSearch(inventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );
      expect(typeof result.current.handleAddCustomItem).toBe('function');
    });

    it('clears searchField after adding custom item', () => {
      const inventory = { backpack: [], equipped: [] };
      const { result } = renderHook(() =>
        useEquipmentSearch(inventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.handleAddCustomItem('Magic Sword');
      });

      expect(result.current.searchField).toBeNull();
    });

    it('does not add duplicate custom item', () => {
      const inventory = { backpack: ['Magic Sword'], equipped: [] };

      const { result } = renderHook(() =>
        useEquipmentSearch(inventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.handleAddCustomItem('Magic Sword');
      });

      expect(mockOnTempInventoryChange).not.toHaveBeenCalled();
    });

    it('clears searchField after adding custom item', () => {
      const inventory = { backpack: [], equipped: [] };

      const { result } = renderHook(() =>
        useEquipmentSearch(inventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.handleAddCustomItem('Magic Sword');
      });

      expect(result.current.searchField).toBeNull();
    });
  });

  describe('handleKeyDown', () => {
    it('adds custom item on Enter key with non-empty query', () => {
      const inventory = { backpack: [], equipped: [] };

      const { result } = renderHook(() =>
        useEquipmentSearch(inventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.setSearchQuery('Magic Sword');
      });

      const mockEvent = { key: 'Enter' };
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockOnTempInventoryChange).toHaveBeenCalledWith('backpack', ['Magic Sword']);
      expect(mockOnInventoryChange).toHaveBeenCalledWith('backpack', ['Magic Sword']);
    });

    it('does not add custom item on Enter key with empty query', () => {
      const inventory = { backpack: [], equipped: [] };

      const { result } = renderHook(() =>
        useEquipmentSearch(inventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.setSearchQuery('');
      });

      const mockEvent = { key: 'Enter' };
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockOnTempInventoryChange).not.toHaveBeenCalled();
    });

    it('does not add custom item for non-Enter key', () => {
      const inventory = { backpack: [], equipped: [] };

      const { result } = renderHook(() =>
        useEquipmentSearch(inventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
        result.current.setSearchQuery('Magic Sword');
      });

      const mockEvent = { key: 'Escape' };
      act(() => {
        result.current.handleKeyDown(mockEvent);
      });

      expect(mockOnTempInventoryChange).not.toHaveBeenCalled();
    });
  });

  describe('handleCategoryChange', () => {
    it('updates selectedCategory', () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      act(() => {
        result.current.handleCategoryChange('Weapon');
      });

      expect(result.current.selectedCategory).toBe('Weapon');
    });
  });

  describe('return value structure', () => {
    it('returns all expected properties', () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      expect(result.current).toHaveProperty('equipmentData');
      expect(result.current).toHaveProperty('searchQuery');
      expect(result.current).toHaveProperty('setSearchQuery');
      expect(result.current).toHaveProperty('filteredEquipment');
      expect(result.current).toHaveProperty('selectedCategory');
      expect(result.current).toHaveProperty('showOnlySelectedBackpack');
      expect(result.current).toHaveProperty('setShowOnlySelectedBackpack');
      expect(result.current).toHaveProperty('showOnlySelectedEquipped');
      expect(result.current).toHaveProperty('setShowOnlySelectedEquipped');
      expect(result.current).toHaveProperty('searchField');
      expect(result.current).toHaveProperty('setSearchField');
      expect(result.current).toHaveProperty('handleEquipmentSelect');
      expect(result.current).toHaveProperty('handleAddCustomItem');
      expect(result.current).toHaveProperty('handleKeyDown');
      expect(result.current).toHaveProperty('handleCategoryChange');
      expect(result.current).toHaveProperty('handleSearchFieldFocus');
      expect(result.current).toHaveProperty('uniqueCategories');
    });
  });

  describe('filtering limit', () => {
    it('does not return more than 20 items', () => {
      const { result } = renderHook(() =>
        useEquipmentSearch(tempInventory, mockOnTempInventoryChange, mockOnInventoryChange)
      );

      expect(result.current.filteredEquipment.length).toBeLessThanOrEqual(20);
    });
  });
});
