// @improved-by-ai
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

  describe('initial state', () => {
    it('returns null when allFeats is empty', () => {
      const formData = createBaseFormData({ feats: ['Tough'] });
      const { result } = renderHook(() =>
        useWizardFeatBuffs(formData, [], mockSetFormData)
      );
      expect(result.current.computedBuffs).toBeNull();
    });

    it('returns null when formData.feats is undefined', () => {
      const { result } = renderHook(() =>
        useWizardFeatBuffs(
          { ...createBaseFormData(), feats: undefined },
          createMockAllFeats(),
          mockSetFormData
        )
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

      const applyFn = mockSetFormData.mock.calls[1][0];
      const result = applyFn(createBaseFormData());
      expect(result.abilities.find((a) => a.name === 'Strength').featIncrease).toBe(2);
      expect(result.abilities.find((a) => a.name === 'Dexterity').featIncrease).toBe(1);
    });

    it('skips ability score increases with name "any"', () => {
      const mockBuffs = {
        abilityScoreIncreases: [{ name: 'any', amount: 1 }],
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

      const applyFn = mockSetFormData.mock.calls[1][0];
      const result = applyFn(createBaseFormData());
      result.abilities.forEach((a) => {
        expect(a.featIncrease).toBe(0);
      });
    });

    it('merges resistances with deduplication', () => {
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

      const applyFn = mockSetFormData.mock.calls[1][0];
      const result = applyFn(createBaseFormData({ feats: ['Tough'], resistances: ['Cold'] }));
      expect(result.resistances).toContain('Cold');
      expect(result.resistances).toContain('Fire');
      expect(result.resistances.filter((r) => r === 'Cold')).toHaveLength(1);
    });

    it('deduplicates resistances case-insensitively', () => {
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: ['Fire'],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(
          createBaseFormData({ feats: ['Tough'], resistances: ['fire'] }),
          createMockAllFeats(),
          mockSetFormData
        )
      );

      const applyFn = mockSetFormData.mock.calls[1][0];
      const result = applyFn(createBaseFormData({ feats: ['Tough'], resistances: ['fire'] }));
      expect(result.resistances).toHaveLength(1);
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

      const applyFn = mockSetFormData.mock.calls[1][0];
      const result = applyFn(formData);
      expect(result.skillProficiencies).toContain('Perception');
      expect(result.skillProficiencies).toContain('Acrobatics');
      expect(result.skillProficiencies).toContain('Stealth');
      expect(result.skillProficiencies.filter((s) => s === 'Perception')).toHaveLength(1);
    });

    it('handles choice proficiencies from feats', () => {
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [
          { name: 'Test Prof', type: 'proficiency', isChoice: true, choose: 1, from: ['Weapons'] },
        ],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      const formData = createBaseFormData({ feats: ['Tough'] });
      renderHook(() =>
        useWizardFeatBuffs(formData, createMockAllFeats(), mockSetFormData)
      );

      const applyFn = mockSetFormData.mock.calls[1][0];
      const result = applyFn(formData);
      expect(result.proficiencies).toContain('1 from: Weapons');
    });

    it('deduplicates choice proficiencies', () => {
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [
          { name: 'Test Prof', type: 'proficiency', isChoice: true, choose: 1, from: ['Weapons'] },
        ],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      const existingProf = 'Test Prof from: Weapons';
      const formData = createBaseFormData({
        feats: ['Tough'],
        proficiencies: [existingProf],
      });
      renderHook(() =>
        useWizardFeatBuffs(formData, createMockAllFeats(), mockSetFormData)
      );

      const applyFn = mockSetFormData.mock.calls[1][0];
      const result = applyFn(formData);
      expect(result.proficiencies.filter((p) => p === existingProf)).toHaveLength(1);
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

    it('recomputes when feats array content changes', () => {
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      const { rerender } = renderHook(
        ({ fd }) => useWizardFeatBuffs(fd, createMockAllFeats(), mockSetFormData),
        {
          initialProps: {
            fd: createBaseFormData({ feats: ['Tough'] }),
          },
        }
      );

      const initialCalls = computeAllFeatBuffs.mock.calls.length;
      rerender({
        fd: createBaseFormData({ feats: ['Observant'] }),
      });

      expect(computeAllFeatBuffs.mock.calls.length).toBeGreaterThan(initialCalls);
    });

    it('does not recompute when only allFeats changes (feats unchanged)', () => {
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      const formData = createBaseFormData({ feats: ['Tough'] });
      const { rerender } = renderHook(
        ({ allFeats }) => useWizardFeatBuffs(formData, allFeats, mockSetFormData),
        { initialProps: { allFeats: createMockAllFeats() } }
      );

      const initialCalls = computeAllFeatBuffs.mock.calls.length;
      rerender({ allFeats: [...createMockAllFeats(), { name: 'Lucky', benefits: [] }] });

      expect(computeAllFeatBuffs.mock.calls.length).toBe(initialCalls);
    });

    it('clears non-choice featIncrease when feats are removed', () => {
      const mockBuffs = {
        abilityScoreIncreases: [
          { name: 'Strength', amount: 2, isChoice: false },
          { name: 'Dexterity', amount: 1, isChoice: false },
        ],
        resistances: [],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(
        ({ fd }) => useWizardFeatBuffs(fd, createMockAllFeats(), mockSetFormData),
        {
          initialProps: {
            fd: createBaseFormData({ feats: ['Tough'] }),
          },
        }
      );

      const clearFn = mockSetFormData.mock.calls[0][0];
      expect(typeof clearFn).toBe('function');
      const result = clearFn({
        name: 'Test',
        abilities: [
          { name: 'Strength', featIncrease: 5 },
          { name: 'Dexterity', featIncrease: 3 },
        ],
      });
      expect(result.abilities[0].featIncrease).toBe(5);
      expect(result.abilities[1].featIncrease).toBe(3);
    });
  });
});
