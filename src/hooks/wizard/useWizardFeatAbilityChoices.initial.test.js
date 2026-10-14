import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useWizardFeatAbilityChoices from './useWizardFeatAbilityChoices.js';

vi.mock('../../services/character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(),
}));

import { computeAllFeatBuffs } from '../../services/character/featBuffService.js';

describe('useWizardFeatAbilityChoices - initial state', () => {
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

  it('returns empty choices when allFeats is empty', () => {
    const formData = createBaseFormData({ feats: ['Tough'] });
    const allFeats = [];
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, allFeats, mockSetFormData)
    );
    expect(result.current.featAbilityChoices).toEqual([]);
  });

  it('returns empty choices when formData.feats is empty', () => {
    const formData = createBaseFormData({ feats: [] });
    const allFeats = createMockAllFeats();
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, allFeats, mockSetFormData)
    );
    expect(result.current.featAbilityChoices).toEqual([]);
  });

  it('returns empty choices when no ability score increases are choices', () => {
    computeAllFeatBuffs.mockReturnValue({
      abilityScoreIncreases: [
        { name: 'Strength', amount: 2, isChoice: false },
      ],
    });

    const formData = createBaseFormData({ feats: ['Tough'] });
    const allFeats = createMockAllFeats();
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, allFeats, mockSetFormData)
    );
    expect(result.current.featAbilityChoices).toEqual([]);
  });
});
