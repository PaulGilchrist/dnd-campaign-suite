// @maintained-by-ai
// Sole owner of handleFeatAbilityModeChange coverage for useWizardFeatAbilityChoices.js:
// single<->dual mode switching preserves saved assignments, defaults dual to the group's
// first option when no dual array is saved (defaultDualAbilities non-single branch),
// recomputes ability increases for the new mode, and tolerates an unknown group id by
// creating a Strength-defaulted entry. NOTE: that last test is NOT a duplicate of
// choice.test.js "handles unknown group id gracefully" — handleFeatAbilityChoice
// early-returns (no setFormData call) on an unknown group, whereas the mode-change
// handler deliberately creates the entry. Fully deterministic (computeAllFeatBuffs
// mocked); stable contract for the wizard UI renderer.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useWizardFeatAbilityChoices from './useWizardFeatAbilityChoices.js';

vi.mock('../../services/character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(),
}));

import { computeAllFeatBuffs } from '../../services/character/featBuffService.js';

describe('useWizardFeatAbilityChoices - handleFeatAbilityModeChange', () => {
  const mockSetFormData = vi.fn();

  const createBaseFormData = (overrides = {}) => ({
    rules: '5e',
    feats: [],
    abilities: [
      { name: 'Strength', featIncrease: 0 },
      { name: 'Dexterity', featIncrease: 0 },
      { name: 'Constitution', featIncrease: 0 },
      { name: 'Intelligence', featIncrease: 0 },
      { name: 'Wisdom', featIncrease: 0 },
      { name: 'Charisma', featIncrease: 0 },
    ],
    ...overrides,
  });

  const createMockAllFeats = (names = ['Tough', 'Observant']) =>
    names.map((name) => ({ name, benefits: [] }));

  // Apply the latest functional setFormData update against prev to inspect the payload.
  const lastUpdate = (prev) => {
    const callFn = mockSetFormData.mock.calls[mockSetFormData.mock.calls.length - 1][0];
    return typeof callFn === 'function' ? callFn(prev) : callFn;
  };

  const mockCustomChoiceBuffs = (description = 'Choose one ability score from: Strength, Dexterity, Constitution') =>
    computeAllFeatBuffs.mockReturnValue({
      abilityScoreIncreases: [
        {
          name: 'any',
          amount: [1, 2],
          isChoice: true,
          description,
          featName: 'Custom',
        },
      ],
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetFormData.mockImplementation((fn) => {
      if (typeof fn === 'function') {
        return fn(mockSetFormData.lastFormData || {});
      }
    });
  });

  it('switches from single to dual mode preserving saved assignments', () => {
    mockCustomChoiceBuffs();

    const formData = createBaseFormData({
      feats: ['Custom'],
      featAbilityChoices: {
        'Custom-0': {
          mode: 'single',
          assignments: { single: 'Strength', dual: ['', ''] },
        },
      },
    });
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Custom']), mockSetFormData)
    );

    result.current.handleFeatAbilityModeChange('Custom-0', 'dual');

    const finalData = lastUpdate(formData);
    expect(finalData.featAbilityChoices['Custom-0'].mode).toBe('dual');
    // dual preserves existing assignments from saved state
    expect(finalData.featAbilityChoices['Custom-0'].assignments.dual).toEqual(['', '']);
  });

  it('switches from dual to single mode preserving saved assignments', () => {
    mockCustomChoiceBuffs('Choose one ability score from: Strength, Dexterity');

    const formData = createBaseFormData({
      feats: ['Custom'],
      featAbilityChoices: {
        'Custom-0': {
          mode: 'dual',
          assignments: { single: 'Strength', dual: ['Dexterity', 'Constitution'] },
        },
      },
    });
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Custom']), mockSetFormData)
    );

    result.current.handleFeatAbilityModeChange('Custom-0', 'single');

    const finalData = lastUpdate(formData);
    expect(finalData.featAbilityChoices['Custom-0'].mode).toBe('single');
    expect(finalData.featAbilityChoices['Custom-0'].assignments.single).toBe('Strength');
    expect(finalData.featAbilityChoices['Custom-0'].assignments.dual).toEqual(['Dexterity', 'Constitution']);
  });

  it('defaults dual to first group option when switching to dual without a saved dual array', () => {
    mockCustomChoiceBuffs('Choose one ability score from: Strength, Dexterity, Constitution');

    const formData = createBaseFormData({
      feats: ['Custom'],
      featAbilityChoices: {
        'Custom-0': {
          mode: 'single',
          assignments: { single: 'Intelligence' },
        },
      },
    });
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Custom']), mockSetFormData)
    );

    result.current.handleFeatAbilityModeChange('Custom-0', 'dual');

    const finalData = lastUpdate(formData);
    expect(finalData.featAbilityChoices['Custom-0'].mode).toBe('dual');
    // defaultDualAbilities: no saved dual -> [first option, '']
    expect(finalData.featAbilityChoices['Custom-0'].assignments.dual).toEqual(['Strength', '']);
    // saved single choice survives the mode switch
    expect(finalData.featAbilityChoices['Custom-0'].assignments.single).toBe('Intelligence');
  });

  it('recomputes feat increases when mode changes', () => {
    mockCustomChoiceBuffs();

    const formData = createBaseFormData({
      feats: ['Custom'],
      featAbilityChoices: {
        'Custom-0': {
          mode: 'single',
          assignments: { single: 'Strength', dual: ['Dexterity', 'Constitution'] },
        },
      },
    });
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Custom']), mockSetFormData)
    );

    result.current.handleFeatAbilityModeChange('Custom-0', 'dual');

    const finalData = lastUpdate(formData);
    // In dual mode, each dual ability gets +1 and the single-mode bonus is removed
    expect(finalData.abilities.find(a => a.name === 'Dexterity').featIncrease).toBe(1);
    expect(finalData.abilities.find(a => a.name === 'Constitution').featIncrease).toBe(1);
    expect(finalData.abilities.find(a => a.name === 'Strength').featIncrease).toBe(0);
  });

  // Contrast with choice.test.js: handleFeatAbilityChoice early-returns on an
  // unknown group id; the mode-change handler instead creates a default entry.
  it('creates a Strength-defaulted entry when group is undefined', () => {
    mockCustomChoiceBuffs('Choose one ability score from: Strength, Dexterity');

    const formData = createBaseFormData({ feats: ['Custom'] });
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Custom']), mockSetFormData)
    );

    result.current.handleFeatAbilityModeChange('NonExistent-0', 'single');

    const finalData = lastUpdate({});
    expect(finalData.featAbilityChoices['NonExistent-0'].mode).toBe('single');
    expect(finalData.featAbilityChoices['NonExistent-0'].assignments.single).toBe('Strength');
  });
});
