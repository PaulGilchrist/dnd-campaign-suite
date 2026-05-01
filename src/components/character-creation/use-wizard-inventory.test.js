import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardInventory from './use-wizard-inventory';

describe('useWizardInventory', () => {
  const mockFormData = {
    inventory: {
      backpack: ['Item 1', 'Item 2'],
      equipped: ['Sword', 'Shield']
      }
    };

  beforeEach(() => {
    vi.clearAllMocks();
    });

  it('should initialize with form data inventory', () => {
    const { result } = renderHook(() =>
      useWizardInventory(mockFormData)
      );

    expect(result.current.tempInventory.backpack).toEqual(['Item 1', 'Item 2']);
    expect(result.current.tempInventory.equipped).toEqual(['Sword', 'Shield']);
    });

  it('should initialize with empty arrays when inventory is undefined', () => {
    const { result } = renderHook(() =>
      useWizardInventory({})
      );

    expect(result.current.tempInventory.backpack).toEqual([]);
    expect(result.current.tempInventory.equipped).toEqual([]);
    });

  it('should update temp inventory', () => {
    const { result } = renderHook(() =>
      useWizardInventory(mockFormData)
      );

    act(() => {
      result.current.updateTempInventory('backpack', ['Item 1', 'Item 2', 'Item 3']);
      });

    expect(result.current.tempInventory.backpack).toEqual(['Item 1', 'Item 2', 'Item 3']);
    });

  it('should return updateTempInventory function', () => {
    const { result } = renderHook(() =>
      useWizardInventory(mockFormData)
      );

    expect(result.current).toHaveProperty('tempInventory');
    expect(result.current).toHaveProperty('updateTempInventory');
    expect(typeof result.current.updateTempInventory).toBe('function');
    });
});
