// @maintained-by-ai
// Owns: legacy saved-choice key migration and removed-feat filtering in the mount
// effect of useWizardFeatAbilityChoices.js — unsuffixed legacy keys ("<Feat>") are
// renamed onto their grouped id ("<Feat>-<idx>") with saved assignments preserved
// (not defaulted), the legacy key itself is dropped from the payload, and orphaned
// entries for deselected feats (new-format and legacy forms) are filtered out while
// the kept feat's saved assignment and its recomputed ability increase survive.
// Sibling suites own group structure (grouping), init defaults and init-side
// recompute (initialization), rendered empty state (initial), key-guard
// reprocessing (dedup), handler payloads (choice/modechange), and rollback.
// Assertions deliberately use assignments that differ from buildGroupedChoices
// defaults so migration-preserved data cannot pass by matching a default.
// Fully deterministic (computeAllFeatBuffs fully mocked); stable contract.
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

  it('renames unsuffixed legacy key onto its group id preserving saved assignments', () => {
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
            // Non-default values: default single would be 'Strength' and
            // default dual ['Strength', ''] — preserved values must survive.
            single: 'Dexterity',
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
    const saved = result.featAbilityChoices['Custom-0'];
    expect(saved).toBeDefined();
    expect(saved.mode).toBe('single');
    expect(saved.assignments.single).toBe('Dexterity');
    expect(saved.assignments.dual).toEqual(['', '']);
    // The legacy key itself must not linger in the written payload.
    expect(result.featAbilityChoices['Custom']).toBeUndefined();
    // The migrated single-mode choice carries through to the recomputed
    // abilities in the same write: +2 on the preserved assignment.
    expect(result.abilities.find((a) => a.name === 'Dexterity').featIncrease).toBe(2);
    expect(result.abilities.find((a) => a.name === 'Strength').featIncrease).toBe(0);
  });

  it('filters out choices for removed feats, keeping the selected feat intact', () => {
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
        'OldFeat-0': { assignment: 'Wisdom' },
        // Legacy (unsuffixed) form of a removed feat must not resurrect.
        'OldFeat': { assignment: 'Wisdom' },
        // Non-default saved assignment: default would be 'Strength', so a
        // surviving 'Constitution' proves the kept entry was preserved, not
        // re-initialised.
        'Tough-0': { assignment: 'Constitution' },
      },
    });
    renderHook(() =>
      useWizardFeatAbilityChoices(formData, createMockAllFeats(), mockSetFormData)
    );

    const callback = mockSetFormData.mock.calls[0][0];
    const result = callback(formData);
    expect(result.featAbilityChoices['OldFeat-0']).toBeUndefined();
    expect(result.featAbilityChoices['OldFeat']).toBeUndefined();
    expect(result.featAbilityChoices['Tough-0']).toBeDefined();
    expect(result.featAbilityChoices['Tough-0'].assignment).toBe('Constitution');
    // Filtering keeps the selected feat's increase in the recomputed abilities.
    expect(result.abilities.find((a) => a.name === 'Constitution').featIncrease).toBe(1);
    expect(result.abilities.find((a) => a.name === 'Wisdom').featIncrease).toBe(0);
  });
});
