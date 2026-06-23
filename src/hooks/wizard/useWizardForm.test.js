// @improved-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import useWizardForm from './useWizardForm.js';

describe('useWizardForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default data when creating a new character', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      expect(result.current.formData.name).toBe('');
      expect(result.current.formData.level).toBe(1);
      expect(result.current.formData.rules).toBe('5e');
      expect(result.current.formData.class.name).toBe('Fighter');
      expect(result.current.formData.inventory.gold).toBe(10);
      expect(result.current.formData.abilities).toHaveLength(6);
      expect(result.current.formData.abilities[0].baseScore).toBe(8);
    });

    it('should initialize with default data when editing with no character data', () => {
      const { result } = renderHook(() => useWizardForm(null, true));
      expect(result.current.formData.name).toBe('');
      expect(result.current.formData.level).toBe(1);
    });

    it('should merge character data into defaults when editing with existing data', () => {
      const characterData = {
        name: 'Test Character',
        level: 5,
        rules: '2024',
      };
      const { result } = renderHook(() => useWizardForm(characterData, true));
      expect(result.current.formData.name).toBe('Test Character');
      expect(result.current.formData.level).toBe(5);
      expect(result.current.formData.rules).toBe('2024');
      // Default values should still be present
      expect(result.current.formData.class.name).toBe('Fighter');
      expect(result.current.formData.abilities).toHaveLength(6);
    });

    it('should not use character data when not editing', () => {
      const characterData = {
        name: 'Test Character',
        level: 5,
      };
      const { result } = renderHook(() => useWizardForm(characterData, false));
      expect(result.current.formData.name).toBe('');
      expect(result.current.formData.level).toBe(1);
    });

    it('should initialize with empty errors', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      expect(result.current.errors).toEqual({});
    });

    it('should return all expected methods', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      expect(result.current.setFormData).toBeTypeOf('function');
      expect(result.current.setErrors).toBeTypeOf('function');
      expect(result.current.updateField).toBeTypeOf('function');
      expect(result.current.updateArrayField).toBeTypeOf('function');
      expect(result.current.updateAbility).toBeTypeOf('function');
      expect(result.current.updateInventory).toBeTypeOf('function');
      expect(result.current.updateClass).toBeTypeOf('function');
      expect(result.current.resetErrors).toBeTypeOf('function');
    });
  });

  describe('updateField', () => {
    it('should update a top-level field', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateField('name', 'Test Character');
      });
      expect(result.current.formData.name).toBe('Test Character');
    });

    it('should clear the error for the updated field', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.setErrors({ name: 'Name is required' });
      });
      act(() => {
        result.current.updateField('name', 'Test');
      });
      expect(result.current.errors.name).toBeNull();
    });

    it('should not clear errors for other fields', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.setErrors({ name: 'Required', level: 'Invalid' });
      });
      act(() => {
        result.current.updateField('name', 'Test');
      });
      expect(result.current.errors.level).toBe('Invalid');
    });

    it('should replace the formData object reference', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      const oldFormData = result.current.formData;
      act(() => {
        result.current.updateField('name', 'Test');
      });
      expect(result.current.formData).not.toBe(oldFormData);
    });

    it('should handle updating level', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateField('level', 10);
      });
      expect(result.current.formData.level).toBe(10);
    });

    it('should handle updating ruleset', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateField('rules', '2024');
      });
      expect(result.current.formData.rules).toBe('2024');
    });

    it('should handle empty string values', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateField('name', '');
      });
      expect(result.current.formData.name).toBe('');
    });
  });

  describe('updateArrayField', () => {
    it('should update a simple array field', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateArrayField('languages', ['Common', 'Elvish']);
      });
      expect(result.current.formData.languages).toEqual(['Common', 'Elvish']);
    });

    it('should update a nested field using dot notation', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateArrayField('race.subrace.name', 'High Elf');
      });
      expect(result.current.formData.race.subrace.name).toBe('High Elf');
    });

    it('should clear the error for the updated field', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.setErrors({ languages: 'Select at least one' });
      });
      act(() => {
        result.current.updateArrayField('languages', ['Common']);
      });
      expect(result.current.errors.languages).toBeNull();
    });

    it('should replace the formData object reference', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      const oldFormData = result.current.formData;
      act(() => {
        result.current.updateArrayField('languages', ['Common']);
      });
      expect(result.current.formData).not.toBe(oldFormData);
    });

    it('should handle empty array values', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateArrayField('languages', []);
      });
      expect(result.current.formData.languages).toEqual([]);
    });
  });

  describe('updateAbility', () => {
    it('should update an ability score at the given index', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateAbility(0, 'baseScore', 15);
      });
      expect(result.current.formData.abilities[0].baseScore).toBe(15);
    });

    it('should update the correct ability without affecting others', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateAbility(2, 'miscIncrease', 2);
      });
      expect(result.current.formData.abilities[2].miscIncrease).toBe(2);
      expect(result.current.formData.abilities[0].miscIncrease).toBe(0);
      expect(result.current.formData.abilities[1].miscIncrease).toBe(0);
    });

    it('should not clear errors for ability updates', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.setErrors({ ability_0_baseScore: 'Invalid score' });
      });
      act(() => {
        result.current.updateAbility(0, 'baseScore', 10);
      });
      expect(result.current.errors.ability_0_baseScore).toBe('Invalid score');
    });

    it('should replace the formData object reference', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      const oldFormData = result.current.formData;
      act(() => {
        result.current.updateAbility(0, 'baseScore', 15);
      });
      expect(result.current.formData).not.toBe(oldFormData);
    });

    it('should update a non-baseScore field', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateAbility(3, 'featIncrease', 4);
      });
      expect(result.current.formData.abilities[3].featIncrease).toBe(4);
    });

    it('should handle zero as a valid value', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateAbility(0, 'baseScore', 0);
      });
      expect(result.current.formData.abilities[0].baseScore).toBe(0);
    });
  });

  describe('updateInventory', () => {
    it('should update gold value', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateInventory('gold', 100);
      });
      expect(result.current.formData.inventory.gold).toBe(100);
    });

    it('should update backpack items', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateInventory('backpack', ['Rope', 'Torch']);
      });
      expect(result.current.formData.inventory.backpack).toEqual(['Rope', 'Torch']);
    });

    it('should update equipped items', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateInventory('equipped', ['Longsword']);
      });
      expect(result.current.formData.inventory.equipped).toEqual(['Longsword']);
    });

    it('should not affect other inventory fields', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateInventory('gold', 100);
      });
      expect(result.current.formData.inventory.backpack).toEqual([]);
      expect(result.current.formData.inventory.equipped).toEqual([]);
    });

    it('should replace the formData object reference', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      const oldFormData = result.current.formData;
      act(() => {
        result.current.updateInventory('gold', 100);
      });
      expect(result.current.formData).not.toBe(oldFormData);
    });

    it('should handle zero gold', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateInventory('gold', 0);
      });
      expect(result.current.formData.inventory.gold).toBe(0);
    });
  });

  describe('updateClass', () => {
    it('should update class name', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateClass({ name: 'Wizard' });
      });
      expect(result.current.formData.class.name).toBe('Wizard');
    });

    it('should update class subclass', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateClass({ subclass: { name: 'Evocation' } });
      });
      expect(result.current.formData.class.subclass.name).toBe('Evocation');
    });

    it('should merge multiple class updates cumulatively', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateClass({ name: 'Fighter' });
      });
      act(() => {
        result.current.updateClass({ subclass: { name: 'Champion' } });
      });
      expect(result.current.formData.class.name).toBe('Fighter');
      expect(result.current.formData.class.subclass.name).toBe('Champion');
    });

    it('should not clear errors', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.setErrors({ class: 'Invalid class' });
      });
      act(() => {
        result.current.updateClass({ name: 'Wizard' });
      });
      expect(result.current.errors.class).toBe('Invalid class');
    });

    it('should update divineOrder and primalOrder fields', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateClass({ divineOrder: 'Life', primalOrder: 'Wild' });
      });
      expect(result.current.formData.class.divineOrder).toBe('Life');
      expect(result.current.formData.class.primalOrder).toBe('Wild');
    });

    it('should preserve existing class fields when updating one', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateClass({ name: 'Cleric' });
      });
      act(() => {
        result.current.updateClass({ divineOrder: 'Death' });
      });
      expect(result.current.formData.class.name).toBe('Cleric');
      expect(result.current.formData.class.subclass.name).toBe('');
    });
  });

  describe('setFormData', () => {
    it('should replace formData with the provided object', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      const newData = { ...result.current.formData, name: 'Direct Set' };
      act(() => {
        result.current.setFormData(newData);
      });
      expect(result.current.formData.name).toBe('Direct Set');
    });

    it('should replace the entire formData object', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      const oldFormData = result.current.formData;
      act(() => {
        result.current.setFormData({ ...result.current.formData, name: 'New' });
      });
      expect(result.current.formData).not.toBe(oldFormData);
    });
  });

  describe('setErrors', () => {
    it('should set errors directly', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.setErrors({ name: 'Required' });
      });
      expect(result.current.errors.name).toBe('Required');
    });

    it('should replace all existing errors', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.setErrors({ name: 'Required', level: 'Invalid' });
      });
      act(() => {
        result.current.setErrors({ background: 'Select one' });
      });
      expect(result.current.errors).toEqual({ background: 'Select one' });
    });

    it('should handle nested error keys', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.setErrors({ 'race.name': 'Invalid race' });
      });
      expect(result.current.errors['race.name']).toBe('Invalid race');
    });
  });

  describe('resetErrors', () => {
    it('should clear all errors', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.setErrors({ name: 'Required', level: 'Invalid' });
      });
      act(() => {
        result.current.resetErrors();
      });
      expect(result.current.errors).toEqual({});
    });

    it('should handle resetting when there are no errors', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.resetErrors();
      });
      expect(result.current.errors).toEqual({});
    });
  });

  describe('behavioral integration', () => {
    it('should handle a sequence of updates across different methods', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => {
        result.current.updateField('name', 'Gandalf');
      });
      act(() => {
        result.current.updateClass({ name: 'Wizard' });
      });
      act(() => {
        result.current.updateAbility(0, 'baseScore', 14);
      });
      act(() => {
        result.current.updateInventory('gold', 50);
      });
      expect(result.current.formData.name).toBe('Gandalf');
      expect(result.current.formData.class.name).toBe('Wizard');
      expect(result.current.formData.abilities[0].baseScore).toBe(14);
      expect(result.current.formData.inventory.gold).toBe(50);
    });

    it('should clear field errors when updating that field via different methods', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      // set up errors
      act(() => {
        result.current.setErrors({ name: 'Required', languages: 'Select one' });
      });
      // updateField clears name error
      act(() => {
        result.current.updateField('name', 'Test');
      });
      expect(result.current.errors.name).toBeNull();
      expect(result.current.errors.languages).toBe('Select one');
      // updateArrayField clears languages error
      act(() => {
        result.current.updateArrayField('languages', ['Common']);
      });
      expect(result.current.errors.languages).toBeNull();
    });

    it('should handle editing an existing character and then modifying it', () => {
      const characterData = {
        name: 'Original',
        level: 3,
        abilities: [
          { name: 'Strength', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      };
      const { result } = renderHook(() => useWizardForm(characterData, true));
      expect(result.current.formData.name).toBe('Original');
      expect(result.current.formData.level).toBe(3);
      expect(result.current.formData.abilities[0].baseScore).toBe(16);

      // Modify after initialization
      act(() => {
        result.current.updateField('name', 'Modified');
      });
      act(() => {
        result.current.updateAbility(0, 'baseScore', 18);
      });
      expect(result.current.formData.name).toBe('Modified');
      expect(result.current.formData.level).toBe(3);
      expect(result.current.formData.abilities[0].baseScore).toBe(18);
    });
  });
});
