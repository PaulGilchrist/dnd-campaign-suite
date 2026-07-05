// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import useWizardForm from './useWizardForm.js';

describe('useWizardForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('creates a new character with defaults', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      expect(result.current.formData.name).toBe('');
      expect(result.current.formData.level).toBe(1);
      expect(result.current.formData.rules).toBe('5e');
      expect(result.current.formData.class.name).toBe('Fighter');
      expect(result.current.formData.inventory.gold).toBe(10);
      expect(result.current.formData.abilities).toHaveLength(6);
      expect(result.current.formData.abilities[0].baseScore).toBe(8);
    });

    it('merges character data into defaults when editing', () => {
      const characterData = {
        name: 'Test Character',
        level: 5,
        rules: '2024',
      };
      const { result } = renderHook(() => useWizardForm(characterData, true));
      expect(result.current.formData.name).toBe('Test Character');
      expect(result.current.formData.level).toBe(5);
      expect(result.current.formData.rules).toBe('2024');
      expect(result.current.formData.class.name).toBe('Fighter');
    });

    it('ignores character data when not editing', () => {
      const characterData = { name: 'Test', level: 5 };
      const { result } = renderHook(() => useWizardForm(characterData, false));
      expect(result.current.formData.name).toBe('');
      expect(result.current.formData.level).toBe(1);
    });
  });

  describe('updateField', () => {
    it('updates a top-level field and clears its error', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => result.current.setErrors({ name: 'Required' }));
      act(() => result.current.updateField('name', 'Test Character'));
      expect(result.current.formData.name).toBe('Test Character');
      expect(result.current.errors.name).toBeNull();
    });

    it('does not clear errors for other fields', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => result.current.setErrors({ name: 'Required', level: 'Invalid' }));
      act(() => result.current.updateField('name', 'Test'));
      expect(result.current.errors.level).toBe('Invalid');
    });
  });

  describe('updateArrayField', () => {
    it('updates a top-level array field', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => result.current.updateArrayField('languages', ['Common', 'Elvish']));
      expect(result.current.formData.languages).toEqual(['Common', 'Elvish']);
    });

    it('updates a nested field using dot notation', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => result.current.updateArrayField('race.subrace.name', 'High Elf'));
      expect(result.current.formData.race.subrace.name).toBe('High Elf');
    });
  });

  describe('updateAbility', () => {
    it('updates a single ability score at the given index', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => result.current.updateAbility(0, 'baseScore', 15));
      expect(result.current.formData.abilities[0].baseScore).toBe(15);
    });

    it('does not affect other abilities', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => result.current.updateAbility(2, 'miscIncrease', 2));
      expect(result.current.formData.abilities[2].miscIncrease).toBe(2);
      expect(result.current.formData.abilities[0].miscIncrease).toBe(0);
    });
  });

  describe('updateInventory', () => {
    it('updates gold without affecting other inventory fields', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => result.current.updateInventory('gold', 100));
      expect(result.current.formData.inventory.gold).toBe(100);
      expect(result.current.formData.inventory.backpack).toEqual([]);
    });
  });

  describe('updateClass', () => {
    it('updates class name and subclass independently', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => result.current.updateClass({ name: 'Wizard' }));
      act(() => result.current.updateClass({ subclass: { name: 'Evocation' } }));
      expect(result.current.formData.class.name).toBe('Wizard');
      expect(result.current.formData.class.subclass.name).toBe('Evocation');
    });
  });

  describe('error management', () => {
    it('replaces all errors on setErrors', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => result.current.setErrors({ name: 'Required', level: 'Invalid' }));
      act(() => result.current.setErrors({ background: 'Select one' }));
      expect(result.current.errors).toEqual({ background: 'Select one' });
    });

    it('clears all errors on resetErrors', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => result.current.setErrors({ name: 'Required' }));
      act(() => result.current.resetErrors());
      expect(result.current.errors).toEqual({});
    });
  });

  describe('integration', () => {
    it('handles a sequence of updates across different methods', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => result.current.updateField('name', 'Gandalf'));
      act(() => result.current.updateClass({ name: 'Wizard' }));
      act(() => result.current.updateAbility(0, 'baseScore', 14));
      act(() => result.current.updateInventory('gold', 50));
      expect(result.current.formData.name).toBe('Gandalf');
      expect(result.current.formData.class.name).toBe('Wizard');
      expect(result.current.formData.abilities[0].baseScore).toBe(14);
      expect(result.current.formData.inventory.gold).toBe(50);
    });

    it('clears field errors when updating that field via different methods', () => {
      const { result } = renderHook(() => useWizardForm(null, false));
      act(() => result.current.setErrors({ name: 'Required', languages: 'Select one' }));
      act(() => result.current.updateField('name', 'Test'));
      expect(result.current.errors.name).toBeNull();
      expect(result.current.errors.languages).toBe('Select one');
      act(() => result.current.updateArrayField('languages', ['Common']));
      expect(result.current.errors.languages).toBeNull();
    });

    it('handles editing an existing character and then modifying it', () => {
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

      act(() => result.current.updateField('name', 'Modified'));
      act(() => result.current.updateAbility(0, 'baseScore', 18));
      expect(result.current.formData.name).toBe('Modified');
      expect(result.current.formData.abilities[0].baseScore).toBe(18);
    });
  });
});
