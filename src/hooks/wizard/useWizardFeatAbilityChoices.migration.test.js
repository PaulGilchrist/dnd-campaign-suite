import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useWizardFeatAbilityChoices from './useWizardFeatAbilityChoices.js';

vi.mock('../../services/character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(),
}));

import { computeAllFeatBuffs } from '../../services/character/featBuffService.js';

describe('useWizardFeatAbilityChoices - migrating old choices', () => {
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

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetFormData.mockImplementation((fn) => {
      if (typeof fn === 'function') {
        return fn(mockSetFormData.lastFormData || {});
      }
    });
  });

  it('migrates old-style choices without numeric suffix to new group id', () => {
    computeAllFeatBuffs.mockReturnValue({
      abilityScoreIncreases: [
        {
          name: 'any',
          amount: [1, 2],
          isChoice: true,
          description: 'Choose one ability score from: Strength, Dexterity',
          featName: 'Custom',
        },
      ],
    });

    const formData = createBaseFormData({
      feats: ['Custom'],
      featAbilityChoices: {
        'Custom': {
          // No mode field, so needsInit will be true
          assignments: {
            single: 'Strength',
            dual: ['', ''],
          },
        },
      },
    });
    renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Custom']), mockSetFormData)
    );

    const callback = mockSetFormData.mock.calls[0][0];
    const result = callback(formData);
    expect(result.featAbilityChoices['Custom-0']).toBeDefined();
    expect(result.featAbilityChoices['Custom-0'].mode).toBe('single');
  });

  it('filters out choices for removed feats', () => {
    computeAllFeatBuffs.mockReturnValue({
      abilityScoreIncreases: [
        {
          name: 'any',
          amount: 1,
          isChoice: true,
          description: 'Increase your Strength score',
          featName: 'Tough',
        },
      ],
    });

    const formData = createBaseFormData({
      feats: ['Tough'],
      featAbilityChoices: {
        'OldFeat-0': { assignment: 'Strength' },
        'Tough-0': {},
      },
    });
    renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(), mockSetFormData)
    );

    const callback = mockSetFormData.mock.calls[0][0];
    const result = callback(formData);
    expect(result.featAbilityChoices['OldFeat-0']).toBeUndefined();
    expect(result.featAbilityChoices['Tough-0']).toBeDefined();
    expect(result.featAbilityChoices['Tough-0'].assignment).toBe('Strength');
  });

  it('skips migration for keys ending with numeric index (already new format)', () => {
    computeAllFeatBuffs.mockReturnValue({
      abilityScoreIncreases: [
        {
          name: 'any',
          amount: 1,
          isChoice: true,
          description: 'Increase your Strength score',
          featName: 'Tough',
        },
      ],
    });

    const formData = createBaseFormData({
      feats: ['Tough'],
      featAbilityChoices: {
        'Tough-0': {},
      },
    });
    renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(), mockSetFormData)
    );

    const callback = mockSetFormData.mock.calls[0][0];
    const result = callback(formData);
    expect(result.featAbilityChoices['Tough-0'].assignment).toBe('Strength');
  });
});
