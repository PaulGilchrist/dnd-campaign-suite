import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useWizardFeatAbilityChoices from './useWizardFeatAbilityChoices.js';

vi.mock('../../services/character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(),
}));

import { computeAllFeatBuffs } from '../../services/character/featBuffService.js';

describe('useWizardFeatAbilityChoices - initializing saved choices', () => {
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

  it('initializes fixed group with default assignment', () => {
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

    const formData = createBaseFormData({ feats: ['Tough'] });
    renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(), mockSetFormData)
    );

    // setFormData is called with a callback at index 0
    const callback = mockSetFormData.mock.calls[0][0];
    const result = callback(createBaseFormData({ feats: ['Tough'] }));
    expect(result.featAbilityChoices['Tough-0'].assignment).toBe('Strength');
  });

  it('initializes choice group with default single mode', () => {
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

    const formData = createBaseFormData({ feats: ['Custom'] });
    renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Custom']), mockSetFormData)
    );

    const callback = mockSetFormData.mock.calls[0][0];
    const result = callback(createBaseFormData({ feats: ['Custom'] }));
    const saved = result.featAbilityChoices['Custom-0'];
    expect(saved.mode).toBe('single');
    expect(saved.assignments.single).toBe('Strength');
    expect(saved.assignments.dual).toEqual(['Strength', '']);
  });

  it('initializes choice group with saved dual mode', () => {
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
        'Custom-0': {
          // No mode, so needsInit will be true, but assignments are preserved
          assignments: {
            single: 'Strength',
            dual: ['Dexterity', 'Constitution'],
          },
        },
      },
    });
    renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Custom']), mockSetFormData)
    );

    const callback = mockSetFormData.mock.calls[0][0];
    const result = callback(formData);
    const saved = result.featAbilityChoices['Custom-0'];
    expect(saved.mode).toBe('single');
    expect(saved.assignments.dual).toEqual(['Dexterity', 'Constitution']);
  });
});
