// @maintained-by-ai: 2026-10-15
// Stable contract suite for useWizardForm: a pure form-state hook (useState/useCallback)
// with no network, SSE, timer, or DOM coupling. Deterministic by construction; defaults
// are asserted against DEFAULT_FORM_DATA itself so content edits need no test churn.
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import useWizardForm from './useWizardForm.js';
import { DEFAULT_FORM_DATA } from '../../config/constants.js';

describe('useWizardForm', () => {
  const createHook = (characterData = null, isEditing = false) =>
    renderHook(() => useWizardForm(characterData, isEditing));

  describe('initialization', () => {
    it('provides the full default form and no errors for a new character', () => {
      const { result } = createHook();
      expect(result.current.formData).toEqual(DEFAULT_FORM_DATA);
      expect(result.current.errors).toEqual({});
    });

    it('merges top-level and nested character data into defaults when editing', () => {
      const characterData = {
        name: 'Test Character',
        level: 5,
        rules: '2024',
        race: { name: 'Elf', subrace: { name: 'High Elf' } },
        class: { name: 'Wizard', subclass: { name: 'Evocation' } },
      };
      const { result } = createHook(characterData, true);
      const { formData } = result.current;
      expect(formData.name).toBe('Test Character');
      expect(formData.level).toBe(5);
      expect(formData.rules).toBe('2024');
      expect(formData.race.subrace.name).toBe('High Elf');
      expect(formData.class.name).toBe('Wizard');
      expect(formData.class.subclass.name).toBe('Evocation');
      // Unmerged fields retain defaults
      expect(formData.class.divineOrder).toBe('');
      expect(formData.inventory).toEqual(DEFAULT_FORM_DATA.inventory);
    });

    it('merges partial ability arrays from character data into defaults by index', () => {
      const characterData = {
        abilities: [
          { name: 'Strength', baseScore: 16, featIncrease: 2, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      };
      const { result } = createHook(characterData, true);
      expect(result.current.formData.abilities[0].baseScore).toBe(16);
      expect(result.current.formData.abilities[0].featIncrease).toBe(2);
      // Other abilities remain at defaults
      expect(result.current.formData.abilities[1]).toEqual(DEFAULT_FORM_DATA.abilities[1]);
    });

    it('ignores character data when not editing', () => {
      const { result } = createHook({ name: 'Test', level: 5 }, false);
      expect(result.current.formData).toEqual(DEFAULT_FORM_DATA);
    });

    it('treats null characterData as no data when editing', () => {
      const { result } = createHook(null, true);
      expect(result.current.formData).toEqual(DEFAULT_FORM_DATA);
    });
  });

  describe('updateField', () => {
    it('updates fields of any type and clears only the updated field error', () => {
      const { result } = createHook();
      act(() => result.current.setErrors({ name: 'Required', level: 'Invalid' }));

      act(() => result.current.updateField('name', 'Test Character'));
      expect(result.current.formData.name).toBe('Test Character');
      expect(result.current.errors.name).toBeNull();
      expect(result.current.errors.level).toBe('Invalid');

      act(() => result.current.updateField('level', 10));
      expect(result.current.formData.level).toBe(10);
      expect(result.current.errors.level).toBeNull();
    });
  });

  describe('updateArrayField', () => {
    it('updates a top-level array field and clears its error', () => {
      const { result } = createHook();
      act(() => result.current.setErrors({ languages: 'Select one' }));
      act(() => result.current.updateArrayField('languages', ['Common', 'Elvish']));
      expect(result.current.formData.languages).toEqual(['Common', 'Elvish']);
      expect(result.current.errors.languages).toBeNull();
    });

    it('updates nested fields via dot notation, preserving siblings, and clears the dotted error', () => {
      const { result } = createHook();
      act(() => result.current.setErrors({ 'race.subrace.name': 'Invalid' }));
      act(() => result.current.updateArrayField('race.subrace.name', 'High Elf'));
      expect(result.current.formData.race.subrace.name).toBe('High Elf');
      expect(result.current.formData.race.name).toBe(DEFAULT_FORM_DATA.race.name);
      expect(result.current.errors['race.subrace.name']).toBeNull();
    });
  });

  describe('updateAbility', () => {
    it('updates one ability field without affecting other abilities', () => {
      const { result } = createHook();
      act(() => result.current.updateAbility(0, 'baseScore', 15));
      act(() => result.current.updateAbility(3, 'featIncrease', 4));
      expect(result.current.formData.abilities[0].baseScore).toBe(15);
      expect(result.current.formData.abilities[0].featIncrease).toBe(DEFAULT_FORM_DATA.abilities[0].featIncrease);
      expect(result.current.formData.abilities[3].featIncrease).toBe(4);
      expect(result.current.formData.abilities[3].baseScore).toBe(DEFAULT_FORM_DATA.abilities[3].baseScore);
      // Untouched abilities keep defaults
      expect(result.current.formData.abilities[5]).toEqual(DEFAULT_FORM_DATA.abilities[5]);
    });
  });

  describe('updateInventory', () => {
    it('updates one inventory field without affecting others', () => {
      const { result } = createHook();
      act(() => result.current.updateInventory('gold', 100));
      expect(result.current.formData.inventory.gold).toBe(100);
      expect(result.current.formData.inventory.backpack).toEqual([]);

      act(() => result.current.updateInventory('equipped', ['Longsword']));
      expect(result.current.formData.inventory.equipped).toEqual(['Longsword']);
      expect(result.current.formData.inventory.gold).toBe(100);
    });
  });

  describe('updateClass', () => {
    it('merges partial updates into class, preserving previously set and untouched fields', () => {
      const { result } = createHook();
      act(() => result.current.updateClass({ name: 'Wizard' }));
      act(() => result.current.updateClass({ subclass: { name: 'Evocation' } }));
      expect(result.current.formData.class.name).toBe('Wizard');
      expect(result.current.formData.class.subclass.name).toBe('Evocation');

      act(() => result.current.updateClass({ divineOrder: 'Order of the Scribe' }));
      expect(result.current.formData.class.divineOrder).toBe('Order of the Scribe');
      expect(result.current.formData.class.primalOrder).toBe('');
    });
  });

  describe('error management', () => {
    it('setErrors replaces all errors', () => {
      const { result } = createHook();
      act(() => result.current.setErrors({ name: 'Required', level: 'Invalid' }));
      act(() => result.current.setErrors({ background: 'Select one' }));
      expect(result.current.errors).toEqual({ background: 'Select one' });
    });

    it('resetErrors clears all errors', () => {
      const { result } = createHook();
      act(() => result.current.setErrors({ name: 'Required' }));
      act(() => result.current.resetErrors());
      expect(result.current.errors).toEqual({});
    });
  });

  describe('integration', () => {
    it('returns form state and all callable mutation methods', () => {
      const { result } = createHook();
      expect(result.current).toHaveProperty('formData');
      expect(result.current).toHaveProperty('errors');
      for (const method of [
        'setFormData',
        'setErrors',
        'updateField',
        'updateArrayField',
        'updateAbility',
        'updateInventory',
        'updateClass',
        'resetErrors',
      ]) {
        expect(typeof result.current[method]).toBe('function');
      }
    });

    it('handles a sequence of updates across different methods', () => {
      const { result } = createHook();
      act(() => result.current.updateField('name', 'Gandalf'));
      act(() => result.current.updateClass({ name: 'Wizard' }));
      act(() => result.current.updateAbility(0, 'baseScore', 14));
      act(() => result.current.updateInventory('gold', 50));
      act(() => result.current.updateArrayField('languages', ['Common']));
      expect(result.current.formData.name).toBe('Gandalf');
      expect(result.current.formData.class.name).toBe('Wizard');
      expect(result.current.formData.abilities[0].baseScore).toBe(14);
      expect(result.current.formData.inventory.gold).toBe(50);
      expect(result.current.formData.languages).toEqual(['Common']);
    });
  });
});
