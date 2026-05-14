import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardForm from './useWizardForm.js';

vi.mock('../config/constants.js', () => ({
  DEFAULT_FORM_DATA: {
    name: '',
    level: 1,
    alignment: 'True Neutral',
    abilities: [
       { name: 'Strength', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
       { name: 'Dexterity', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
       { name: 'Constitution', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
       { name: 'Intelligence', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
       { name: 'Wisdom', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
       { name: 'Charisma', baseScore: 8, abilityImprovements: 0, miscBonus: 0 }
     ],
    class: { name: 'Fighter', subclass: { name: '' } },
    race: { name: 'Human', subrace: { name: '' } },
    inventory: { backpack: [], equipped: [], gold: 10, magicItems: [] },
    skillProficiencies: [],
    expertSkills: [],
    spells: [],
    feats: [],
    fightingStyles: [],
    languages: [],
    resistances: [],
    immunities: [],
    specialActions: [],
    rules: '5e'
   }
}));

describe('useWizardForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    });

  it('should initialize with default form data', () => {
    const { result } = renderHook(() =>
      useWizardForm(null, false)
     );

    expect(result.current.formData.name).toBe('');
    expect(result.current.formData.level).toBe(1);
    expect(result.current.formData.alignment).toBe('True Neutral');
    });

  it('should initialize with character data when editing', () => {
    const characterData = {
      name: 'Existing Character',
      level: 5
     };

    const { result } = renderHook(() =>
      useWizardForm(characterData, true)
     );

    expect(result.current.formData.name).toBe('Existing Character');
    expect(result.current.formData.level).toBe(5);
    });

  it('should update a field', () => {
    const { result } = renderHook(() =>
      useWizardForm(null, false)
     );

    act(() => {
      result.current.updateField('name', 'Test Character');
      });

    expect(result.current.formData.name).toBe('Test Character');
    });

  it('should clear errors when updating a field', () => {
    const { result } = renderHook(() =>
      useWizardForm(null, false)
     );

    act(() => {
      result.current.setErrors({ name: 'Required field' });
      });

    expect(result.current.errors.name).toBe('Required field');

    act(() => {
      result.current.updateField('name', 'Test Character');
      });

    expect(result.current.errors.name).toBe(null);
    });

  it('should update an array field', () => {
    const { result } = renderHook(() =>
      useWizardForm(null, false)
     );

    act(() => {
      result.current.updateArrayField('feats', ['Feat 1', 'Feat 2']);
      });

    expect(result.current.formData.feats).toEqual(['Feat 1', 'Feat 2']);
    });

  it('should update a nested array field via dot notation', () => {
    const { result } = renderHook(() =>
      useWizardForm(null, false)
     );

    act(() => {
      result.current.updateArrayField('inventory.magicItems', ['Wand of Wonder', 'Amulet of Health']);
     });

    expect(result.current.formData.inventory.magicItems).toEqual(['Wand of Wonder', 'Amulet of Health']);
   });

  it('should update an ability score', () => {
    const { result } = renderHook(() =>
      useWizardForm(null, false)
     );

    act(() => {
      result.current.updateAbility(0, 'baseScore', 15);
      });

    expect(result.current.formData.abilities[0].baseScore).toBe(15);
    });

  it('should update inventory field', () => {
    const { result } = renderHook(() =>
      useWizardForm(null, false)
     );

    act(() => {
      result.current.updateInventory('gold', 100);
      });

    expect(result.current.formData.inventory.gold).toBe(100);
    });

  it('should update class properties', () => {
    const { result } = renderHook(() =>
      useWizardForm(null, false)
     );

    act(() => {
      result.current.updateClass({ name: 'Wizard' });
      });

    expect(result.current.formData.class.name).toBe('Wizard');
    });

  it('should reset all errors', () => {
    const { result } = renderHook(() =>
      useWizardForm(null, false)
     );

    act(() => {
      result.current.setErrors({ name: 'Error 1', level: 'Error 2' });
      });

    expect(Object.keys(result.current.errors).length).toBe(2);

    act(() => {
      result.current.resetErrors();
      });

    expect(Object.keys(result.current.errors).length).toBe(0);
    });

  it('should return all expected methods and properties', () => {
    const { result } = renderHook(() =>
      useWizardForm(null, false)
     );

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
});
