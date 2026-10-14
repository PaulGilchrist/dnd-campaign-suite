import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useWizardFeatAbilityChoices from './useWizardFeatAbilityChoices.js';

vi.mock('../../services/character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(),
}));

import { computeAllFeatBuffs } from '../../services/character/featBuffService.js';

describe('useWizardFeatAbilityChoices - building grouped choices', () => {
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

  it('creates a fixed group for single-amount ability increases', () => {
    computeAllFeatBuffs.mockReturnValue({
      abilityScoreIncreases: [
        {
          name: 'any',
          amount: 1,
          isChoice: true,
          description: 'Increase your Strength score',
          featName: 'Tough',
          featDescription: 'Test feat',
        },
      ],
    });

    const formData = createBaseFormData({ feats: ['Tough'] });
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(), mockSetFormData)
    );

    expect(result.current.featAbilityChoices).toHaveLength(1);
    const group = result.current.featAbilityChoices[0];
    expect(group.id).toBe('Tough-0');
    expect(group.featName).toBe('Tough');
    expect(group.type).toBe('fixed');
    expect(group.amount).toBe(1);
    expect(group.abilityNames).toEqual(['Strength']);
  });

  it('creates a choice group for 1/2 amount patterns', () => {
    computeAllFeatBuffs.mockReturnValue({
      abilityScoreIncreases: [
        {
          name: 'any',
          amount: [1, 2],
          isChoice: true,
          description: 'Choose one ability score from: Strength, Dexterity, Constitution',
          featName: 'Custom',
          featDescription: 'Custom feat',
        },
      ],
    });

    const formData = createBaseFormData({ feats: ['Custom'] });
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Custom']), mockSetFormData)
    );

    expect(result.current.featAbilityChoices).toHaveLength(1);
    const group = result.current.featAbilityChoices[0];
    expect(group.type).toBe('choice');
    expect(group.featDescription).toBe('Custom feat');
    expect(group.options.single.amount).toBe(2);
    expect(group.options.single.abilityNames).toEqual(['Strength', 'Dexterity', 'Constitution']);
    expect(group.options.dual.amount).toBe(1);
    expect(group.options.dual.count).toBe(2);
  });

  it('parses ability names from "Increase your X score" pattern', () => {
    computeAllFeatBuffs.mockReturnValue({
      abilityScoreIncreases: [
        {
          name: 'any',
          amount: 1,
          isChoice: true,
          description: 'Increase your Strength or Dexterity score',
          featName: 'Feat',
        },
      ],
    });

    const formData = createBaseFormData({ feats: ['Feat'] });
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Feat']), mockSetFormData)
    );

    const group = result.current.featAbilityChoices[0];
    expect(group.abilityNames).toEqual(['Strength', 'Dexterity']);
  });

  it('parses ability names from "Choose one ability score from: X, Y" pattern', () => {
    computeAllFeatBuffs.mockReturnValue({
      abilityScoreIncreases: [
        {
          name: 'any',
          amount: 1,
          isChoice: true,
          description: 'Choose one ability score from: Intelligence, Wisdom',
          featName: 'Resilient',
        },
      ],
    });

    const formData = createBaseFormData({ feats: ['Resilient'] });
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Resilient']), mockSetFormData)
    );

    const group = result.current.featAbilityChoices[0];
    expect(group.abilityNames).toEqual(['Intelligence', 'Wisdom']);
  });

  it('falls back to all abilities when no pattern matches', () => {
    computeAllFeatBuffs.mockReturnValue({
      abilityScoreIncreases: [
        {
          name: 'any',
          amount: 1,
          isChoice: true,
          description: 'Some random description without a pattern',
          featName: 'Mystery',
        },
      ],
    });

    const formData = createBaseFormData({ feats: ['Mystery'] });
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(['Mystery']), mockSetFormData)
    );

    const group = result.current.featAbilityChoices[0];
    expect(group.abilityNames).toEqual([
      'Strength', 'Dexterity', 'Constitution',
      'Intelligence', 'Wisdom', 'Charisma',
    ]);
  });
});
