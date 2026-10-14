import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import useWizardForm from './useWizardForm.js';

describe('useWizardForm', () => {
  const createHook = (characterData = null, isEditing = false) =>
    renderHook(() => useWizardForm(characterData, isEditing));

  describe('initialization', () => {
    it('creates a new character with defaults', () => {
      const { result } = createHook(null, false);
      const { formData } = result.current;
      expect(formData.name).toBe('');
      expect(formData.level).toBe(1);
      expect(formData.rules).toBe('5e');
      expect(formData.class.name).toBe('Fighter');
      expect(formData.inventory.gold).toBe(10);
      expect(formData.abilities).toHaveLength(6);
      expect(formData.abilities[0].baseScore).toBe(8);
    });

    it('returns the full default form shape', () => {
      const { result } = createHook();
      const { formData } = result.current;
      expect(formData).toHaveProperty('alignment', 'True Neutral');
      expect(formData).toHaveProperty('expertSkills');
      expect(formData).toHaveProperty('feats');
      expect(formData).toHaveProperty('fightingStyles');
      expect(formData).toHaveProperty('immunities');
      expect(formData).toHaveProperty('languages');
      expect(formData).toHaveProperty('resistances');
      expect(formData).toHaveProperty('skillProficiencies');
      expect(formData).toHaveProperty('toolProficiencies');
      expect(formData).toHaveProperty('specialActions');
      expect(formData).toHaveProperty('spells');
      expect(formData).toHaveProperty('magicInitiateInstances');
      expect(formData).toHaveProperty('xp', 0);
      expect(formData).toHaveProperty('xpMode', 'milestone');
    });

    it('merges character data into defaults when editing', () => {
      const characterData = {
        name: 'Test Character',
        level: 5,
        rules: '2024',
      };
      const { result } = createHook(characterData, true);
      const { formData } = result.current;
      expect(formData.name).toBe('Test Character');
      expect(formData.level).toBe(5);
      expect(formData.rules).toBe('2024');
      // Unmerged fields retain defaults
      expect(formData.class.name).toBe('Fighter');
    });

    it('preserves nested character data when editing', () => {
      const characterData = {
        race: { name: 'Elf', subrace: { name: 'High Elf' } },
        class: { name: 'Wizard', subclass: { name: 'Evocation' } },
      };
      const { result } = createHook(characterData, true);
      expect(result.current.formData.race.name).toBe('Elf');
      expect(result.current.formData.race.subrace.name).toBe('High Elf');
      expect(result.current.formData.class.name).toBe('Wizard');
      expect(result.current.formData.class.subclass.name).toBe('Evocation');
    });

    it('ignores character data when not editing', () => {
      const characterData = { name: 'Test', level: 5 };
      const { result } = createHook(characterData, false);
      expect(result.current.formData.name).toBe('');
      expect(result.current.formData.level).toBe(1);
    });

    it('treats null characterData as no data when editing', () => {
      const { result } = createHook(null, true);
      expect(result.current.formData.name).toBe('');
      expect(result.current.formData.level).toBe(1);
    });
  });

  describe('updateField', () => {
    it('updates a top-level field and clears its error', () => {
      const { result } = createHook();
      act(() => result.current.setErrors({ name: 'Required' }));
      act(() => result.current.updateField('name', 'Test Character'));
      expect(result.current.formData.name).toBe('Test Character');
      expect(result.current.errors.name).toBeNull();
    });

    it('does not clear errors for other fields', () => {
      const { result } = createHook();
      act(() => result.current.setErrors({ name: 'Required', level: 'Invalid' }));
      act(() => result.current.updateField('name', 'Test'));
      expect(result.current.errors.level).toBe('Invalid');
    });

    it('updates non-string fields', () => {
      const { result } = createHook();
      act(() => result.current.updateField('level', 10));
      expect(result.current.formData.level).toBe(10);
    });

    it('clears error for the updated field regardless of type', () => {
      const { result } = createHook();
      act(() => result.current.setErrors({ level: 'Invalid' }));
      act(() => result.current.updateField('level', 5));
      expect(result.current.errors.level).toBeNull();
    });
  });

  describe('updateArrayField', () => {
    it('updates a top-level array field', () => {
      const { result } = createHook();
      act(() => result.current.updateArrayField('languages', ['Common', 'Elvish']));
      expect(result.current.formData.languages).toEqual(['Common', 'Elvish']);
    });

    it('updates a nested field using dot notation', () => {
      const { result } = createHook();
      act(() => result.current.updateArrayField('race.subrace.name', 'High Elf'));
      expect(result.current.formData.race.subrace.name).toBe('High Elf');
    });

    it('clears errors for the updated field', () => {
      const { result } = createHook();
      act(() => result.current.setErrors({ languages: 'Select one' }));
      act(() => result.current.updateArrayField('languages', ['Common']));
      expect(result.current.errors.languages).toBeNull();
    });

    it('clears errors for nested dot-notation fields', () => {
      const { result } = createHook();
      act(() => result.current.setErrors({ 'race.subrace.name': 'Invalid' }));
      act(() => result.current.updateArrayField('race.subrace.name', 'High Elf'));
      expect(result.current.errors['race.subrace.name']).toBeNull();
    });
  });

  describe('updateAbility', () => {
    it('updates a single ability score at the given index', () => {
      const { result } = createHook();
      act(() => result.current.updateAbility(0, 'baseScore', 15));
      expect(result.current.formData.abilities[0].baseScore).toBe(15);
    });

    it('does not affect other abilities', () => {
      const { result } = createHook();
      act(() => result.current.updateAbility(2, 'miscIncrease', 2));
      expect(result.current.formData.abilities[2].miscIncrease).toBe(2);
      expect(result.current.formData.abilities[0].miscIncrease).toBe(0);
    });

    it('updates any ability field, not just baseScore', () => {
      const { result } = createHook();
      act(() => result.current.updateAbility(3, 'featIncrease', 4));
      expect(result.current.formData.abilities[3].featIncrease).toBe(4);
    });

    it('does not throw on valid indices', () => {
      const { result } = createHook();
      const abilities = result.current.formData.abilities;
      // First and last indices
      act(() => result.current.updateAbility(0, 'baseScore', 10));
      act(() => result.current.updateAbility(abilities.length - 1, 'baseScore', 10));
      expect(result.current.formData.abilities[0].baseScore).toBe(10);
      expect(result.current.formData.abilities[5].baseScore).toBe(10);
    });
  });

  describe('updateInventory', () => {
    it('updates gold without affecting other inventory fields', () => {
      const { result } = createHook();
      act(() => result.current.updateInventory('gold', 100));
      expect(result.current.formData.inventory.gold).toBe(100);
      expect(result.current.formData.inventory.backpack).toEqual([]);
    });

    it('updates any inventory field', () => {
      const { result } = createHook();
      act(() => result.current.updateInventory('equipped', ['Longsword']));
      expect(result.current.formData.inventory.equipped).toEqual(['Longsword']);
    });
  });

  describe('updateClass', () => {
    it('updates class name and subclass independently', () => {
      const { result } = createHook();
      act(() => result.current.updateClass({ name: 'Wizard' }));
      act(() => result.current.updateClass({ subclass: { name: 'Evocation' } }));
      expect(result.current.formData.class.name).toBe('Wizard');
      expect(result.current.formData.class.subclass.name).toBe('Evocation');
    });

    it('preserves existing class fields when doing partial updates', () => {
      const { result } = createHook();
      act(() => result.current.updateClass({ name: 'Wizard' }));
      act(() => result.current.updateClass({ subclass: { name: 'Bladesinger' } }));
      // name should persist from the previous update
      expect(result.current.formData.class.name).toBe('Wizard');
    });

    it('updates class fields without clearing other class properties', () => {
      const { result } = createHook();
      act(() => result.current.updateClass({ divineOrder: 'Order of the Scribe' }));
      expect(result.current.formData.class.divineOrder).toBe('Order of the Scribe');
      expect(result.current.formData.class.primalOrder).toBe('');
    });
  });

  describe('error management', () => {
    it('replaces all errors on setErrors', () => {
      const { result } = createHook();
      act(() => result.current.setErrors({ name: 'Required', level: 'Invalid' }));
      act(() => result.current.setErrors({ background: 'Select one' }));
      expect(result.current.errors).toEqual({ background: 'Select one' });
    });

    it('clears all errors on resetErrors', () => {
      const { result } = createHook();
      act(() => result.current.setErrors({ name: 'Required' }));
      act(() => result.current.resetErrors());
      expect(result.current.errors).toEqual({});
    });

    it('starts with no errors', () => {
      const { result } = createHook();
      expect(result.current.errors).toEqual({});
    });
  });

  describe('returned API shape', () => {
    it('returns formData, errors, and all mutation methods', () => {
      const { result } = createHook();
      expect(result.current).toHaveProperty('formData');
      expect(result.current).toHaveProperty('errors');
      expect(result.current).toHaveProperty('setFormData');
      expect(result.current).toHaveProperty('setErrors');
      expect(result.current).toHaveProperty('updateField');
      expect(result.current).toHaveProperty('updateArrayField');
      expect(result.current).toHaveProperty('updateAbility');
      expect(result.current).toHaveProperty('updateInventory');
      expect(result.current).toHaveProperty('updateClass');
      expect(result.current).toHaveProperty('resetErrors');
    });

    it('returns functions that are callable', () => {
      const { result } = createHook();
      expect(typeof result.current.setFormData).toBe('function');
      expect(typeof result.current.setErrors).toBe('function');
      expect(typeof result.current.updateField).toBe('function');
      expect(typeof result.current.updateArrayField).toBe('function');
      expect(typeof result.current.updateAbility).toBe('function');
      expect(typeof result.current.updateInventory).toBe('function');
      expect(typeof result.current.updateClass).toBe('function');
      expect(typeof result.current.resetErrors).toBe('function');
    });
  });

  describe('integration', () => {
    it('handles a sequence of updates across different methods', () => {
      const { result } = createHook();
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
      const { result } = createHook();
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
      const { result } = createHook(characterData, true);
      expect(result.current.formData.name).toBe('Original');
      expect(result.current.formData.level).toBe(3);

      act(() => result.current.updateField('name', 'Modified'));
      act(() => result.current.updateAbility(0, 'baseScore', 18));
      expect(result.current.formData.name).toBe('Modified');
      expect(result.current.formData.abilities[0].baseScore).toBe(18);
    });

    it('merges partial ability arrays from character data into defaults', () => {
      const characterData = {
        abilities: [
          { name: 'Strength', baseScore: 16, featIncrease: 2, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      };
      const { result } = createHook(characterData, true);
      // Lodash merge should have merged the partial ability into the default structure
      expect(result.current.formData.abilities[0].baseScore).toBe(16);
      expect(result.current.formData.abilities[0].featIncrease).toBe(2);
      // Other abilities should still be at defaults
      expect(result.current.formData.abilities[1].baseScore).toBe(8);
    });
  });
});
