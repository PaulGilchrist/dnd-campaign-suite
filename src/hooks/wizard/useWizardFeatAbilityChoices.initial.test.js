// @maintained-by-ai
// Owns: empty-state contract of useWizardFeatAbilityChoices.js at mount —
// result.current.featAbilityChoices stays [] through each early-return guard
// of the mount effect (feats empty, allFeats not yet loaded, no choice-type
// increases). Each test pins its branch via computeAllFeatBuffs call-count.
// initial/initialization seam adjudication: this file asserts the RENDERED
// state only; useWizardFeatAbilityChoices.initialization.test.js owns the
// saved-choice DEFAULTS written through the setFormData payload, and neither
// absorbs the other (matching the grouping suite's convention that siblings
// assert payloads, this suite asserts structure — here, its absence).
// Fully deterministic (computeAllFeatBuffs fully mocked); stable contract for
// the wizard UI renderer.
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
    // Guard: the effect must short-circuit before computing buffs when the
    // feat catalogue has not loaded yet (unseeded mock would throw if reached).
    expect(computeAllFeatBuffs).not.toHaveBeenCalled();
  });

  it('returns empty choices when formData.feats is empty', () => {
    const formData = createBaseFormData({ feats: [] });
    const allFeats = createMockAllFeats();
    const { result } = renderHook(() =>
      useWizardFeatAbilityChoices(formData, allFeats, mockSetFormData)
    );
    expect(result.current.featAbilityChoices).toEqual([]);
    // Pin the branch: the feats-empty guard short-circuits before compute.
    expect(computeAllFeatBuffs).not.toHaveBeenCalled();
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
    // Pin the branch: buffs were computed, then every increase was filtered
    // out by the isChoice && name === 'any' filter.
    expect(computeAllFeatBuffs).toHaveBeenCalled();
  });
});
