import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useEquipmentSearch } from './useEquipmentSearch';

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn();
});

describe('useEquipmentSearch', () => {
  const mockTempInventory = { backpack: [], equipped: [] };
  let onTempInventoryChange;
  let onInventoryChange;

  beforeEach(() => {
    onTempInventoryChange = vi.fn();
    onInventoryChange = vi.fn();
  });

  describe('initial state', () => {
    it('returns correct initial values', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useEquipmentSearch(
        mockTempInventory,
        onTempInventoryChange,
        onInventoryChange
      ));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.equipmentData).toEqual([]);
      expect(result.current.filteredEquipment).toEqual([]);
      expect(result.current.selectedCategory).toBe('All');
      expect(result.current.searchField).toBeNull();
      expect(result.current.searchQuery).toBe('');
      expect(result.current.showOnlySelectedBackpack).toBe(false);
      expect(result.current.showOnlySelectedEquipped).toBe(false);
    });
  });

  describe('handleSearchFieldFocus', () => {
    it('sets searchField and resets searchQuery and filteredEquipment', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useEquipmentSearch(
        mockTempInventory,
        onTempInventoryChange,
        onInventoryChange
      ));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
      });

      expect(result.current.searchField).toBe('backpack');
      expect(result.current.searchQuery).toBe('');
      expect(result.current.filteredEquipment).toEqual([]);
    });
  });

  describe('handleCategoryChange', () => {
    it('updates selectedCategory', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useEquipmentSearch(
        mockTempInventory,
        onTempInventoryChange,
        onInventoryChange
      ));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.handleCategoryChange('Armor');
      });

      expect(result.current.selectedCategory).toBe('Armor');
    });
  });

  describe('handleEquipmentSelect', () => {
    it('calls callbacks and resets state when adding to backpack', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useEquipmentSearch(
        mockTempInventory,
        onTempInventoryChange,
        onInventoryChange
      ));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
      });

      const testItem = { name: 'Longsword', index: 'longsword' };

      act(() => {
        result.current.handleEquipmentSelect(testItem);
      });

      expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Longsword']);
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', ['Longsword']);
      expect(result.current.searchField).toBeNull();
      expect(result.current.searchQuery).toBe('');
      expect(result.current.filteredEquipment).toEqual([]);
    });

    it('does not add duplicate items', async () => {
      const tempInventoryWithItem = { backpack: ['Longsword'], equipped: [] };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useEquipmentSearch(
        tempInventoryWithItem,
        onTempInventoryChange,
        onInventoryChange
      ));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
      });

      const testItem = { name: 'Longsword', index: 'longsword' };

      act(() => {
        result.current.handleEquipmentSelect(testItem);
      });

      expect(onTempInventoryChange).not.toHaveBeenCalled();
      expect(onInventoryChange).not.toHaveBeenCalled();
    });
  });

  describe('handleAddCustomItem', () => {
    it('adds custom item to backpack and resets state', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useEquipmentSearch(
        mockTempInventory,
        onTempInventoryChange,
        onInventoryChange
      ));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
      });

      act(() => {
        result.current.handleAddCustomItem('Magic Sword');
      });

      expect(onTempInventoryChange).toHaveBeenCalledWith('backpack', ['Magic Sword']);
      expect(onInventoryChange).toHaveBeenCalledWith('backpack', ['Magic Sword']);
      expect(result.current.searchField).toBeNull();
      expect(result.current.searchQuery).toBe('');
    });

    it('does not add duplicate custom items', async () => {
      const tempInventoryWithItem = { backpack: ['Magic Sword'], equipped: [] };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const { result } = renderHook(() => useEquipmentSearch(
        tempInventoryWithItem,
        onTempInventoryChange,
        onInventoryChange
      ));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      act(() => {
        result.current.handleSearchFieldFocus('backpack');
      });

      act(() => {
        result.current.handleAddCustomItem('Magic Sword');
      });

      expect(onTempInventoryChange).not.toHaveBeenCalled();
      expect(result.current.searchField).toBeNull();
      expect(result.current.searchQuery).toBe('');
    });
  });

  describe('search filtering', () => {
    it('filters equipment based on search query and category', async () => {
      const mockEquipment = [
        { name: 'Longsword', index: 'longsword', equipment_category: 'Weapons' },
        { name: 'Shield', index: 'shield', equipment_category: 'Armor' },
        { name: 'Potion of Healing', index: 'potion-healing', equipment_category: 'Adventuring Gear' },
      ];

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockEquipment,
      });

      const { result } = renderHook(() => useEquipmentSearch(
        mockTempInventory,
        onTempInventoryChange,
        onInventoryChange
      ));

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(result.current.equipmentData).toEqual(mockEquipment);

      act(() => {
        result.current.setSearchQuery('long');
      });

      expect(result.current.filteredEquipment).toEqual([mockEquipment[0]]);

      act(() => {
        result.current.handleCategoryChange('Armor');
        result.current.setSearchQuery('shield');
      });

      expect(result.current.filteredEquipment).toEqual([mockEquipment[1]]);
    });
  });
});