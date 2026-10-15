// @maintained-by-ai
// Owns: saved-choice DEFAULTS written through the setFormData payload when the
// mount effect initializes featAbilityChoices (needsInit branch of
// useWizardFeatAbilityChoices.js) — fixed-group default assignment, choice-group
// default single mode with single/dual assignment defaults, preservation of
// saved assignments when mode is missing, and the recomputed abilities written
// alongside the init payload.
// initialization/initial seam adjudication: useWizardFeatAbilityChoices.initial
// .test.js owns the RENDERED empty-state contract; this file asserts only the
// payload handed to setFormData, and neither absorbs the other. Handler-driven
// payload changes belong to the choice/modechange suites; legacy key migration
// and removed-feat filtering to the migration suite; key-guard reprocessing to
// the dedup suite.
// Fully deterministic (computeAllFeatBuffs fully mocked); stable contract.
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

  it('initializes choice group preserving saved assignments and defaulting mode to single', () => {
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
    expect(saved.assignments.single).toBe('Strength');
    expect(saved.assignments.dual).toEqual(['Dexterity', 'Constitution']);
  });

  it('initialization payload includes abilities with feat increases recomputed from the default assignment', () => {
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

    const callback = mockSetFormData.mock.calls[0][0];
    const result = callback(formData);
    // The same write that seeds featAbilityChoices must carry the recomputed
    // abilities so the wizard preview matches the default assignment.
    expect(result.featAbilityChoices['Tough-0'].assignment).toBe('Strength');
    expect(result.abilities.find((a) => a.name === 'Strength').featIncrease).toBe(1);
    expect(result.abilities.find((a) => a.name === 'Dexterity').featIncrease).toBe(0);
  });
});
