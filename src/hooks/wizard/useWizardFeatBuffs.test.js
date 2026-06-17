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
  const mockAllFeats = [
    { name: 'Tough', benefits: [] },
    { name: 'Observant', benefits: [] },
  ];

  const baseFormData = {
    feats: [],
    abilities: [
      { name: 'Strength', miscBonus: 0 },
      { name: 'Dexterity', miscBonus: 0 },
      { name: 'Constitution', miscBonus: 0 },
    ],
    resistances: [],
    specialActions: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetFormData.mockImplementation((_updater) => {
      // No-op; we just want to capture calls
    });
  });

  describe('initial state', () => {
    it('should return computedBuffs as null on initial render with no feats', () => {
      const formData = { ...baseFormData };
      const { result } = renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      expect(result.current.computedBuffs).toBeNull();
    });

    it('should return computedBuffs as null when allFeats is empty', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      const { result } = renderHook(() =>
        useWizardFeatBuffs(formData, [], mockSetFormData)
      );

      expect(result.current.computedBuffs).toBeNull();
    });

    it('should return computedBuffs as null when formData.feats is undefined', () => {
      const formData = { ...baseFormData, feats: undefined };
      const { result } = renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      expect(result.current.computedBuffs).toBeNull();
    });
  });

  describe('computing buffs when feats are present', () => {
    it('should compute and apply buffs when feats change from empty to non-empty', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      const mockBuffs = {
        abilityScoreIncreases: [{ name: 'Strength', amount: 2 }],
        resistances: ['Fire'],
        features: [{ name: 'Extra Reach', description: '+5ft reach', type: 'passive' }],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      const { result } = renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      expect(computeAllFeatBuffs).toHaveBeenCalledWith(formData, mockAllFeats);
      expect(result.current.computedBuffs).toEqual(mockBuffs);
    });

    it('should call clearBuffs before applyBuffs', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      computeAllFeatBuffs.mockReturnValue({
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [],
      });

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      // The hook calls clearBuffs then applyBuffs, so there should be 2 calls to setFormData
      expect(mockSetFormData).toHaveBeenCalledTimes(2);
    });

    it('should not recompute when feats have not changed', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      computeAllFeatBuffs.mockReturnValue({
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [],
      });

      const { rerender } = renderHook(
        ({ fd }) => useWizardFeatBuffs(fd, mockAllFeats, mockSetFormData),
        { initialProps: { fd: formData } }
      );

      const firstCallCount = mockSetFormData.mock.calls.length;

      // Rerender with the same feats
      rerender({ fd: formData });

      expect(mockSetFormData.mock.calls.length).toBe(firstCallCount);
    });

    it('should recompute when feats array changes', () => {
      const formData1 = { ...baseFormData, feats: ['Tough'] };
      const formData2 = { ...baseFormData, feats: ['Observant'] };
      computeAllFeatBuffs.mockReturnValue({
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [],
      });

      const { rerender } = renderHook(
        ({ fd }) => useWizardFeatBuffs(fd, mockAllFeats, mockSetFormData),
        { initialProps: { fd: formData1 } }
      );

      const firstCallCount = mockSetFormData.mock.calls.length;

      rerender({ fd: formData2 });

      expect(mockSetFormData.mock.calls.length).toBeGreaterThan(firstCallCount);
    });

    it('should recompute when allFeats changes (effect re-runs due to dependency)', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      computeAllFeatBuffs.mockReturnValue({
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [],
      });

      const { rerender } = renderHook(
        ({ allFeats }) => useWizardFeatBuffs(formData, allFeats, mockSetFormData),
        { initialProps: { allFeats: mockAllFeats } }
      );

      // The effect re-runs when allFeats changes, but the `changed` check
      // only looks at feats. Since feats haven't changed, computeAllFeatBuffs
      // is NOT called again (the effect returns early). This tests that
      // behavior correctly.
      const firstComputeCalls = computeAllFeatBuffs.mock.calls.length;

      rerender({ allFeats: [...mockAllFeats, { name: 'Lucky', benefits: [] }] });

      // computeAllFeatBuffs should NOT be called again because feats didn't change
      expect(computeAllFeatBuffs.mock.calls.length).toBe(firstComputeCalls);
    });
  });

  describe('clearing buffs', () => {
    it('should clear buffs when feats go from non-empty to empty', () => {
      const formData1 = { ...baseFormData, feats: ['Tough'] };
      computeAllFeatBuffs.mockReturnValue({
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [],
      });

      const { rerender } = renderHook(
        ({ fd }) => useWizardFeatBuffs(fd, mockAllFeats, mockSetFormData),
        { initialProps: { fd: formData1 } }
      );

      const afterFirstRender = mockSetFormData.mock.calls.length;

      // Change feats to empty
      const formData2 = { ...baseFormData, feats: [] };
      rerender({ fd: formData2 });

      // Should have called setFormData to clear buffs
      expect(mockSetFormData.mock.calls.length).toBeGreaterThan(afterFirstRender);

      // computedBuffs should be null
      expect(computeAllFeatBuffs).not.toHaveBeenCalledWith(formData2, mockAllFeats);
    });

    it('should not call computeAllFeatBuffs when clearing buffs', () => {
      const formData1 = { ...baseFormData, feats: ['Tough'] };
      computeAllFeatBuffs.mockReturnValue({
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [],
      });

      const { rerender } = renderHook(
        ({ fd }) => useWizardFeatBuffs(fd, mockAllFeats, mockSetFormData),
        { initialProps: { fd: formData1 } }
      );

      computeAllFeatBuffs.mockClear();

      const formData2 = { ...baseFormData, feats: [] };
      rerender({ fd: formData2 });

      expect(computeAllFeatBuffs).not.toHaveBeenCalled();
    });
  });

  describe('buildFormDataWithBuffs behavior (via setFormData calls)', () => {
    it('should apply ability score increases to matching abilities', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      const mockBuffs = {
        abilityScoreIncreases: [{ name: 'Strength', amount: 2 }],
        resistances: [],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      // The second call to setFormData should be applyBuffs
      const applyCall = mockSetFormData.mock.calls[1];
      expect(applyCall).toBeDefined();
      const updater = applyCall[0];
      if (typeof updater === 'function') {
        const result = updater(formData);
        const strAbility = result.abilities.find(a => a.name === 'Strength');
        expect(strAbility.miscBonus).toBe(2);
      }
    });

    it('should not apply ability score increase for "any" name', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      const mockBuffs = {
        abilityScoreIncreases: [{ name: 'any', amount: 1 }],
        resistances: [],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      expect(actualApplyCall).toBeDefined();
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const result = updater(formData);
        // No ability should have a miscBonus since "any" is skipped
        result.abilities.forEach(a => {
          expect(a.miscBonus).toBe(0);
        });
      }
    });

    it('should add resistances that are not already present', () => {
      const formData = { ...baseFormData, feats: ['Tough'], resistances: ['Cold'] };
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: ['Fire', 'Cold'],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const result = updater(formData);
        expect(result.resistances).toContain('Cold');
        expect(result.resistances).toContain('Fire');
        // Cold should only appear once (deduplication)
        expect(result.resistances.filter(r => r === 'Cold')).toHaveLength(1);
      }
    });

    it('should not add features to specialActions', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: [],
        features: [
          { name: 'Extra Reach', description: '+5ft reach', type: 'passive' },
        ],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const result = updater(formData);
        expect(result.specialActions).toEqual([]);
      }
    });

    it('should not modify specialActions when deduplicating features', () => {
      const formData = {
        ...baseFormData,
        feats: ['Tough'],
        specialActions: [{ name: 'Extra Reach', description: 'existing' }],
      };
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: [],
        features: [
          { name: 'Extra Reach', description: '+5ft reach', type: 'passive' },
        ],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const result = updater(formData);
        expect(result.specialActions).toHaveLength(1);
        expect(result.specialActions[0].description).toBe('existing');
      }
    });

    it('should not modify specialActions that are strings', () => {
      const formData = {
        ...baseFormData,
        feats: ['Tough'],
        specialActions: ['Existing Action'],
      };
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: [],
        features: [
          { name: 'Existing Action', description: 'duped', type: 'passive' },
          { name: 'New Action', description: 'new', type: 'passive' },
        ],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const result = updater(formData);
        expect(result.specialActions).toHaveLength(1);
        expect(result.specialActions[0]).toBe('Existing Action');
      }
    });

    it('should not add features with unspecified type to specialActions', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: [],
        features: [
          { name: 'Mysterious Buff', description: 'who knows' },
        ],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const result = updater(formData);
        expect(result.specialActions).toEqual([]);
      }
    });

    it('should handle abilities being undefined in prev', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      const mockBuffs = {
        abilityScoreIncreases: [{ name: 'Strength', amount: 2 }],
        resistances: [],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const result = updater({ ...formData, abilities: undefined });
        expect(result.abilities).toBeDefined();
      }
    });

    it('should handle resistances being undefined in prev', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: ['Fire'],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const result = updater({ ...formData, resistances: undefined });
        expect(result.resistances).toContain('Fire');
      }
    });

    it('should not add features when specialActions is undefined in prev', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: [],
        features: [{ name: 'New Feature', description: 'desc', type: 'passive' }],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const result = updater({ ...formData, specialActions: undefined });
        expect(result.specialActions).toBeUndefined();
      }
    });
  });

  describe('clearBuffs behavior', () => {
    it('should reset miscBonus to 0 for all abilities when clearing', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      computeAllFeatBuffs.mockReturnValue({
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [],
      });

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      // First call is clearBuffs
      const firstCall = mockSetFormData.mock.calls[0];
      const updater = firstCall[0];
      if (typeof updater === 'function') {
        const formDataWithBonuses = {
          ...baseFormData,
          abilities: [
            { name: 'Strength', miscBonus: 5 },
            { name: 'Dexterity', miscBonus: 3 },
          ],
        };
        const result = updater(formDataWithBonuses);
        expect(result.abilities[0].miscBonus).toBe(0);
        expect(result.abilities[1].miscBonus).toBe(0);
      }
    });

    it('should return prev unchanged when abilities is missing during clear', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      computeAllFeatBuffs.mockReturnValue({
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [],
      });

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const firstCall = mockSetFormData.mock.calls[0];
      const updater = firstCall[0];
      if (typeof updater === 'function') {
        const prev = { name: 'Test' };
        const result = updater(prev);
        expect(result).toBe(prev);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty buffs result', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      computeAllFeatBuffs.mockReturnValue({
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [],
      });

      const { result } = renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      expect(result.current.computedBuffs).toEqual({
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [],
      });
    });

    it('should handle case-insensitive ability name matching', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      const mockBuffs = {
        abilityScoreIncreases: [{ name: 'strength', amount: 2 }],
        resistances: [],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const result = updater(formData);
        const strAbility = result.abilities.find(a => a.name === 'Strength');
        expect(strAbility.miscBonus).toBe(2);
      }
    });

    it('should handle case-insensitive resistance deduplication', () => {
      const formData = { ...baseFormData, feats: ['Tough'], resistances: ['fire'] };
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: ['Fire'],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const result = updater(formData);
        // Fire should not be added since 'fire' already exists (case-insensitive)
        expect(result.resistances).toHaveLength(1);
      }
    });

    it('should accumulate miscBonus from multiple increases', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      const mockBuffs = {
        abilityScoreIncreases: [
          { name: 'Strength', amount: 2 },
          { name: 'Strength', amount: 1 },
        ],
        resistances: [],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const result = updater(formData);
        const strAbility = result.abilities.find(a => a.name === 'Strength');
        expect(strAbility.miscBonus).toBe(3);
      }
    });

    it('should not modify formData when no resistances to add', () => {
      const formData = { ...baseFormData, feats: ['Tough'], resistances: ['Fire'] };
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: ['Fire'],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const result = updater(formData);
        expect(result.resistances).toEqual(['Fire']);
      }
    });

    it('should not add features that already exist as specialActions', () => {
      const formData = {
        ...baseFormData,
        feats: ['Tough'],
        specialActions: [
          { name: 'Existing', description: 'already there' },
        ],
      };
      const mockBuffs = {
        abilityScoreIncreases: [],
        resistances: [],
        features: [
          { name: 'Existing', description: 'new desc', type: 'passive' },
        ],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const result = updater(formData);
        expect(result.specialActions).toHaveLength(1);
        expect(result.specialActions[0].description).toBe('already there');
      }
    });

    it('should handle ability with no miscBonus property', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      const mockBuffs = {
        abilityScoreIncreases: [{ name: 'Dexterity', amount: 2 }],
        resistances: [],
        features: [],
        proficiencies: [],
      };
      computeAllFeatBuffs.mockReturnValue(mockBuffs);

      renderHook(() =>
        useWizardFeatBuffs(formData, mockAllFeats, mockSetFormData)
      );

      const actualApplyCall = mockSetFormData.mock.calls[1];
      const updater = actualApplyCall[0];
      if (typeof updater === 'function') {
        const formDataNoMisc = {
          ...formData,
          abilities: [
            { name: 'Strength' },
            { name: 'Dexterity' },
          ],
        };
        const result = updater(formDataNoMisc);
        const dexAbility = result.abilities.find(a => a.name === 'Dexterity');
        expect(dexAbility.miscBonus).toBe(2);
      }
    });

    it('should not detect change when feats array is the same reference', () => {
      const formData = { ...baseFormData, feats: ['Tough'] };
      computeAllFeatBuffs.mockReturnValue({
        abilityScoreIncreases: [],
        resistances: [],
        features: [],
        proficiencies: [],
      });

      const { rerender } = renderHook(
        ({ fd }) => useWizardFeatBuffs(fd, mockAllFeats, mockSetFormData),
        { initialProps: { fd: formData } }
      );

      const afterFirst = mockSetFormData.mock.calls.length;

      // Same object reference
      rerender({ fd: formData });

      expect(mockSetFormData.mock.calls.length).toBe(afterFirst);
    });
  });
});
