import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useWizardFeatAbilityChoices from './useWizardFeatAbilityChoices.js';

vi.mock('../../services/character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(),
}));

import { computeAllFeatBuffs } from '../../services/character/featBuffService.js';

describe('useWizardFeatAbilityChoices - handleFeatAbilityChoice', () => {
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

  it('updates assignment for fixed group', () => {
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
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(), mockSetFormData)
    );

    result.current.handleFeatAbilityChoice('Tough-0', 0, 'Dexterity');

    const callFn = mockSetFormData.mock.calls[mockSetFormData.mock.calls.length - 1][0];
    const finalData = typeof callFn === 'function' ? callFn(mockSetFormData.lastFormData || {}) : mockSetFormData.lastFormData;
    expect(finalData.featAbilityChoices['Tough-0'].assignment).toBe('Dexterity');
  });

  it('updates single assignment for choice group in single mode', () => {
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
          mode: 'single',
          assignments: { single: 'Strength', dual: ['', ''] },
        },
      },
    });
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Custom']), mockSetFormData)
    );

    result.current.handleFeatAbilityChoice('Custom-0', 0, 'Constitution');

    const callFn = mockSetFormData.mock.calls[mockSetFormData.mock.calls.length - 1][0];
    const finalData = typeof callFn === 'function' ? callFn(mockSetFormData.lastFormData || {}) : mockSetFormData.lastFormData;
    expect(finalData.featAbilityChoices['Custom-0'].assignments.single).toBe('Constitution');
  });

  it('updates dual slot assignment for choice group in dual mode', () => {
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
          mode: 'dual',
          assignments: { single: 'Strength', dual: ['Dexterity', ''] },
        },
      },
    });
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Custom']), mockSetFormData)
    );

    result.current.handleFeatAbilityChoice('Custom-0', 1, 'Constitution');

    const callFn = mockSetFormData.mock.calls[mockSetFormData.mock.calls.length - 1][0];
    const finalData = typeof callFn === 'function' ? callFn(mockSetFormData.lastFormData || {}) : mockSetFormData.lastFormData;
    expect(finalData.featAbilityChoices['Custom-0'].assignments.dual[1]).toBe('Constitution');
  });

  it('recomputes feat increases on abilities when choice changes', () => {
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
      featAbilityChoices: { 'Tough-0': { assignment: 'Strength' } },
    });
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(), mockSetFormData)
    );

    result.current.handleFeatAbilityChoice('Tough-0', 0, 'Dexterity');

    const callFn = mockSetFormData.mock.calls[mockSetFormData.mock.calls.length - 1][0];
    const finalData = typeof callFn === 'function' ? callFn(mockSetFormData.lastFormData || {}) : mockSetFormData.lastFormData;
    expect(finalData.abilities.find(a => a.name === 'Dexterity').featIncrease).toBe(1);
    expect(finalData.abilities.find(a => a.name === 'Strength').featIncrease).toBe(0);
  });

  it('handles unknown group id gracefully', () => {
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
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(), mockSetFormData)
    );

    const initialCalls = mockSetFormData.mock.calls.length;
    result.current.handleFeatAbilityChoice('NonExistent-0', 0, 'Strength');
    expect(mockSetFormData.mock.calls.length).toBe(initialCalls);
  });
});
