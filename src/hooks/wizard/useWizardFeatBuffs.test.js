// @maintained-by-ai
// Owns: useWizardFeatBuffs contract — feat-set change detection (compute once per
// change, clear on empty), and buildFormDataWithBuffs wiring (non-choice ability
// increases, resistance merge, all_skills expansion, choice-proficiency omission).
// Seam: the adjacent useWizardFeatAbilityChoices.* cluster owns ASI *choice* handling
// ('any'/isChoice increases) for a different hook; this hook filters those out, and
// the "ignores any" test pins that boundary. mergeDeduplicated dedup semantics are
// owned by services/shared/buffApplier.test.js — only the call wiring is tested here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useWizardFeatBuffs from './useWizardFeatBuffs.js';

// Mock the featBuffService
vi.mock('../../services/character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(),
}));

import { computeAllFeatBuffs } from '../../services/character/featBuffService.js';

describe('useWizardFeatBuffs', () => {
  const mockSetFormData = vi.fn();
  const createMockAllFeats = (names = ['Tough', 'Observant']) =>
    names.map((name) => ({ name, benefits: [] }));

  const createBaseFormData = (overrides = {}) => ({
    feats: [],
    abilities: [
      { name: 'Strength', featIncrease: 0 },
      { name: 'Dexterity', featIncrease: 0 },
      { name: 'Constitution', featIncrease: 0 },
    ],
    proficiencies: [],
    resistances: [],
    specialActions: [],
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetFormData.mockImplementation((fn) => {
      if (typeof fn === 'function') {
        return fn(mockSetFormData.lastFormData || {});
      }
    });
  });

  // The effect calls setFormData twice per compute: clearBuffs first, then
  // applyBuffs. The apply updater is always the last functional argument.
  const lastApplyFn = () => {
    const calls = mockSetFormData.mock.calls.filter(([arg]) => typeof arg === 'function');
    return calls[calls.length - 1][0];
  };

  describe('initial state', () => {
    it('returns null when allFeats is empty', () => {
      const formData = createBaseFormData({ feats: ['Tough'] });
      const { result } = renderHook(() =>
        useWizardFeatBuffs(formData, [], mockSetFormData)
      );
      expect(result.current.computedBuffs).toBeNull();
    });
  });

  describe('computing and applying buffs', () => {
    it('computes and applies buffs when feats are present', () => {
      const mockBuffs = {
        abilityScoreIncreases: [{ name: 'Strength', amount: 2 }],
        resistances: ['Fire'],
        features: [{ name: 'Extra Reach', description: '+5ft reach', type: 'passive' }],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      const formData = createBaseFormData({ feats: ['Tough'] });
      const { result } = renderHook(() =>
        useWizardFeatBuffs(formData, createMockAllFeats(), mockSetFormData)
      );

      expect(computeAllFeatBuffs).toHaveBeenCalledWith(formData, createMockAllFeats());
      expect(result.current.computedBuffs).toEqual(mockBuffs);
    });

    it('applies ability score increases to matching abilities', () => {
      const mockBuffs = {
        abilityScoreIncreases: [
          { name: 'Strength', amount: 2 },
          { name: 'Dexterity', amount: 1 },
        ],
        resistances: [],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(
          createBaseFormData({ feats: ['Tough'] }),
          createMockAllFeats(),
          mockSetFormData
        )
      );

      const applyFn = lastApplyFn();
      const result = applyFn(createBaseFormData());
      expect(result.abilities.find((a) => a.name === 'Strength').featIncrease).toBe(2);
      expect(result.abilities.find((a) => a.name === 'Dexterity').featIncrease).toBe(1);
    });

    it('merges buff resistances into formData', () => {
      // Dedup semantics themselves are owned by buffApplier.test.js;
      // this pins only the hook's wiring of the resistance merge.
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: ['Fire', 'Cold'],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(
          createBaseFormData({ feats: ['Tough'], resistances: ['Cold'] }),
          createMockAllFeats(),
          mockSetFormData
        )
      );

      const applyFn = lastApplyFn();
      const result = applyFn(createBaseFormData({ feats: ['Tough'], resistances: ['Cold'] }));
      expect(result.resistances).toEqual(expect.arrayContaining(['Cold', 'Fire']));
    });

    it('handles skill proficiencies from all_skills buff', () => {
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [{ name: 'all_skills', type: 'skill' }],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      const formData = createBaseFormData({
        feats: ['Tough'],
        skillProficiencies: ['Perception'],
      });
      renderHook(() =>
        useWizardFeatBuffs(formData, createMockAllFeats(), mockSetFormData)
      );

      const applyFn = lastApplyFn();
      const result = applyFn(formData);
      expect(result.skillProficiencies).toContain('Perception');
      expect(result.skillProficiencies).toContain('Acrobatics');
      expect(result.skillProficiencies).toContain('Stealth');
      expect(result.skillProficiencies.filter((s) => s === 'Perception')).toHaveLength(1);
    });

    it('does not add placeholder strings for proficiency choice feat buffs', () => {
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [
          { name: 'Test Prof', type: 'proficiency', isChoice: true, choose: 1, from: ['Weapons'] },
        ],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      const formData = createBaseFormData({
        feats: ['Tough'],
        proficiencies: ['Light Armor'],
      });
      renderHook(() =>
        useWizardFeatBuffs(formData, createMockAllFeats(), mockSetFormData)
      );

      const applyFn = lastApplyFn();
      const result = applyFn(formData);
      // Existing proficiencies pass through untouched; the unfulfilled choice
      // must never be flattened into a placeholder string.
      expect(result.proficiencies).toEqual(['Light Armor']);
    });

    it('ignores "any" ability score increases (choices owned by useWizardFeatAbilityChoices)', () => {
      // Seam with the useWizardFeatAbilityChoices cluster: choice-based ('any')
      // increases are applied there, never by this hook's direct wiring.
      const mockBuffs = {
        abilityScoreIncreases: [
          { name: 'any', amount: 2, isChoice: true },
          { name: 'Constitution', amount: 1 },
        ],
        resistances: [],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      const formData = createBaseFormData({ feats: ['Tough'] });
      renderHook(() =>
        useWizardFeatBuffs(formData, createMockAllFeats(), mockSetFormData)
      );

      const applyFn = lastApplyFn();
      const result = applyFn(formData);
      expect(result.abilities.find((a) => a.name === 'Constitution').featIncrease).toBe(1);
      // No ability receives the 'any' increase directly.
      expect(result.abilities.filter((a) => a.featIncrease > 0).map((a) => a.name))
        .toEqual(['Constitution']);
    });
  });

  describe('state transitions', () => {
    it('clears buffs when feats change from non-empty to empty', () => {
      const mockBuffs = {
        abilityScoreIncreases: [{ name: 'Strength', amount: 2 }],
        resistances: [],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      const { rerender } = renderHook(
        ({ fd }) => useWizardFeatBuffs(fd, createMockAllFeats(), mockSetFormData),
        { initialProps: { fd: createBaseFormData({ feats: ['Tough'] }) } }
      );

      computeAllFeatBuffs.mockClear();

      const initialCalls = mockSetFormData.mock.calls.length;
      rerender({ fd: createBaseFormData({ feats: [] }) });

      expect(computeAllFeatBuffs).not.toHaveBeenCalled();
      expect(mockSetFormData.mock.calls.length).toBeGreaterThan(initialCalls);
    });

    it('does not recompute when feats have not changed', () => {
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      const formData = createBaseFormData({ feats: ['Tough'] });
      const { rerender } = renderHook(
        ({ fd }) => useWizardFeatBuffs(fd, createMockAllFeats(), mockSetFormData),
        { initialProps: { fd: formData } }
      );

      const initialCalls = computeAllFeatBuffs.mock.calls.length;
      rerender({ fd: formData });
      expect(computeAllFeatBuffs.mock.calls.length).toBe(initialCalls);
    });
  });
});
