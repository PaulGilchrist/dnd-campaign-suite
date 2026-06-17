import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';


vi.mock('../../config/constants.js', () => ({
  DEFAULT_FORM_DATA: {
    name: '',
    race: { name: '', subrace: { name: '' } },
    class: { name: '', subclass: { name: '' } },
    background: '',
    level: 1,
    abilities: [
      { name: 'Strength', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Dexterity', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Constitution', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Intelligence', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Wisdom', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Charisma', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    ],
    inventory: { gold: 0, backpack: [], equipped: [] },
    rules: '5e',
  },
}));

import useWizardFormWithMocks from './useWizardForm.js';

describe('useWizardForm', () => {
  const defaultData = {
    name: '',
    race: { name: '', subrace: { name: '' } },
    class: { name: '', subclass: { name: '' } },
    background: '',
    level: 1,
    abilities: [
      { name: 'Strength', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Dexterity', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Constitution', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Intelligence', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Wisdom', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Charisma', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    ],
    inventory: { gold: 0, backpack: [], equipped: [] },
    rules: '5e',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with DEFAULT_FORM_DATA when not editing', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      expect(result.current.formData).toEqual(defaultData);
    });

    it('should initialize with DEFAULT_FORM_DATA when editing with no character data', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, true));
      expect(result.current.formData).toEqual(defaultData);
    });

    it('should merge character data into DEFAULT_FORM_DATA when editing', () => {
      const characterData = {
        name: 'Test Character',
        level: 5,
        rules: '2024',
      };
      const { result } = renderHook(() => useWizardFormWithMocks(characterData, true));
      expect(result.current.formData.name).toBe('Test Character');
      expect(result.current.formData.level).toBe(5);
      expect(result.current.formData.rules).toBe('2024');
    });

    it('should not merge character data when not editing', () => {
      const characterData = {
        name: 'Test Character',
        level: 5,
      };
      const { result } = renderHook(() => useWizardFormWithMocks(characterData, false));
      expect(result.current.formData.name).toBe('');
      expect(result.current.formData.level).toBe(1);
    });

    it('should initialize with empty errors', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      expect(result.current.errors).toEqual({});
    });
  });

  describe('updateField', () => {
    it('should update a top-level field', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.updateField('name', 'Test Character');
      });
      expect(result.current.formData.name).toBe('Test Character');
    });

    it('should clear the error for the updated field', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.setErrors({ name: 'Name is required' });
      });
      act(() => {
        result.current.updateField('name', 'Test');
      });
      expect(result.current.errors.name).toBeNull();
    });

    it('should not affect other fields when updating one', () => {
      const { result } = renderHook(() => useWizardFormWithMocks({ level: 3 }, true));
      act(() => {
        result.current.updateField('name', 'Test');
      });
      expect(result.current.formData.level).toBe(3);
    });

    it('should create a new formData object on update', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      const oldFormData = result.current.formData;
      act(() => {
        result.current.updateField('name', 'Test');
      });
      expect(result.current.formData).not.toBe(oldFormData);
    });
  });

  describe('updateArrayField', () => {
    it('should update a simple array field', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.updateArrayField('languages', ['Common', 'Elvish']);
      });
      expect(result.current.formData.languages).toEqual(['Common', 'Elvish']);
    });

    it('should update a nested field with dot notation', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.updateArrayField('race.traits', ['Darkvision']);
      });
      expect(result.current.formData.race.traits).toEqual(['Darkvision']);
    });

    it('should clear the error for the updated field', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.setErrors({ languages: 'Select at least one' });
      });
      act(() => {
        result.current.updateArrayField('languages', ['Common']);
      });
      expect(result.current.errors.languages).toBeNull();
    });
  });

  describe('updateAbility', () => {
    it('should update an ability field', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.updateAbility(0, 'baseScore', 15);
      });
      expect(result.current.formData.abilities[0].baseScore).toBe(15);
    });

    it('should update the correct ability by index', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.updateAbility(2, 'miscIncrease', 2);
      });
      expect(result.current.formData.abilities[2].miscIncrease).toBe(2);
      expect(result.current.formData.abilities[0].miscIncrease).toBe(0);
    });

    it('should not clear errors for ability updates (only updateField does that)', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.setErrors({ ability_0_baseScore: 'Invalid score' });
      });
      act(() => {
        result.current.updateAbility(0, 'baseScore', 10);
      });
      // updateAbility does not call setErrors
      expect(result.current.errors.ability_0_baseScore).toBe('Invalid score');
    });

    it('should not affect other abilities', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.updateAbility(0, 'baseScore', 15);
      });
      expect(result.current.formData.abilities[1].baseScore).toBe(8);
    });
  });

  describe('updateInventory', () => {
    it('should update a gold value', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.updateInventory('gold', 100);
      });
      expect(result.current.formData.inventory.gold).toBe(100);
    });

    it('should update a backpack item', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.updateInventory('backpack', ['Rope', 'Torch']);
      });
      expect(result.current.formData.inventory.backpack).toEqual(['Rope', 'Torch']);
    });

    it('should update an equipped item', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.updateInventory('equipped', ['Longsword']);
      });
      expect(result.current.formData.inventory.equipped).toEqual(['Longsword']);
    });
  });

  describe('updateClass', () => {
    it('should update class name', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.updateClass({ name: 'Wizard' });
      });
      expect(result.current.formData.class.name).toBe('Wizard');
    });

    it('should update class subclass', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.updateClass({ subclass: { name: 'Evocation' } });
      });
      expect(result.current.formData.class.subclass.name).toBe('Evocation');
    });

    it('should merge updates into class object', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.updateClass({ name: 'Fighter' });
      });
      act(() => {
        result.current.updateClass({ subclass: { name: 'Champion' } });
      });
      expect(result.current.formData.class.name).toBe('Fighter');
      expect(result.current.formData.class.subclass.name).toBe('Champion');
    });
  });

  describe('resetErrors', () => {
    it('should clear all errors', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.setErrors({ name: 'Required', level: 'Invalid' });
      });
      act(() => {
        result.current.resetErrors();
      });
      expect(result.current.errors).toEqual({});
    });
  });

  describe('setFormData', () => {
    it('should replace formData directly', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      const newData = { ...defaultData, name: 'Direct Set' };
      act(() => {
        result.current.setFormData(newData);
      });
      expect(result.current.formData.name).toBe('Direct Set');
    });
  });

  describe('setErrors', () => {
    it('should set errors directly', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.setErrors({ name: 'Required' });
      });
      expect(result.current.errors.name).toBe('Required');
    });
  });

  describe('integration', () => {
    it('should handle a sequence of updates', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.updateField('name', 'Gandalf');
      });
      act(() => {
        result.current.updateClass({ name: 'Wizard' });
      });
      act(() => {
        result.current.updateAbility(0, 'baseScore', 14);
      });
      expect(result.current.formData.name).toBe('Gandalf');
      expect(result.current.formData.class.name).toBe('Wizard');
      expect(result.current.formData.abilities[0].baseScore).toBe(14);
    });

    it('should handle nested field updates with setFormData', () => {
      const { result } = renderHook(() => useWizardFormWithMocks(null, false));
      act(() => {
        result.current.updateArrayField('race.subrace.name', 'High Elf');
      });
      expect(result.current.formData.race.subrace.name).toBe('High Elf');
    });
  });
});
