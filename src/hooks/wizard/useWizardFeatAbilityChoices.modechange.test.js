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

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetFormData.mockImplementation((fn) => {
      if (typeof fn === 'function') {
        return fn(mockSetFormData.lastFormData || {});
      }
    });
  });

  it('switches from single to dual mode', () => {
    computeAllFeatBuffs.mockReturnValue({
      abilityScoreIncreases: [
        {
          name: 'any',
          amount: [1, 2],
          isChoice: true,
          description: 'Choose one ability score from: Strength, Dexterity, Constitution',
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

    result.current.handleFeatAbilityModeChange('Custom-0', 'dual');

    const callback = mockSetFormData.mock.calls[mockSetFormData.mock.calls.length - 1][0];
    const finalData = callback(formData);
    expect(finalData.featAbilityChoices['Custom-0'].mode).toBe('dual');
    // dual preserves existing assignments from saved state
    expect(finalData.featAbilityChoices['Custom-0'].assignments.dual).toEqual(['', '']);
  });

  it('switches from dual to single mode', () => {
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
          assignments: { single: 'Strength', dual: ['Dexterity', 'Constitution'] },
        },
      },
    });
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Custom']), mockSetFormData)
    );

    result.current.handleFeatAbilityModeChange('Custom-0', 'single');

    const callFn = mockSetFormData.mock.calls[mockSetFormData.mock.calls.length - 1][0];
    const finalData = typeof callFn === 'function' ? callFn(mockSetFormData.lastFormData || {}) : mockSetFormData.lastFormData;
    expect(finalData.featAbilityChoices['Custom-0'].mode).toBe('single');
    expect(finalData.featAbilityChoices['Custom-0'].assignments.single).toBe('Strength');
    expect(finalData.featAbilityChoices['Custom-0'].assignments.dual).toEqual(['Dexterity', 'Constitution']);
  });

  it('recomputes feat increases when mode changes', () => {
    computeAllFeatBuffs.mockReturnValue({
      abilityScoreIncreases: [
        {
          name: 'any',
          amount: [1, 2],
          isChoice: true,
          description: 'Choose one ability score from: Strength, Dexterity, Constitution',
          featName: 'Custom',
        },
      ],
    });

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

    const callback = mockSetFormData.mock.calls[mockSetFormData.mock.calls.length - 1][0];
    const finalData = callback(formData);
    // In dual mode, each dual ability gets +1
    expect(finalData.abilities.find(a => a.name === 'Dexterity').featIncrease).toBe(1);
    expect(finalData.abilities.find(a => a.name === 'Constitution').featIncrease).toBe(1);
  });

  it('falls back to Strength when group is undefined', () => {
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
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Custom']), mockSetFormData)
    );

    result.current.handleFeatAbilityModeChange('NonExistent-0', 'single');

    const callFn = mockSetFormData.mock.calls[mockSetFormData.mock.calls.length - 1][0];
    const finalData = typeof callFn === 'function' ? callFn(mockSetFormData.lastFormData || {}) : mockSetFormData.lastFormData;
    expect(finalData.featAbilityChoices['NonExistent-0'].mode).toBe('single');
    expect(finalData.featAbilityChoices['NonExistent-0'].assignments.single).toBe('Strength');
  });
});
