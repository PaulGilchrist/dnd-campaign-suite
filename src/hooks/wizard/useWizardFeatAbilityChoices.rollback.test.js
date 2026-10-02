// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useWizardFeatAbilityChoices from './useWizardFeatAbilityChoices.js';

vi.mock('../../services/character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(),
}));

import { computeAllFeatBuffs } from '../../services/character/featBuffService.js';

const ASI_CHOICE = {
  name: 'any',
  amount: [1, 2],
  isChoice: true,
  description: 'Increase one ability score of your choice by 2, or increase two ability scores of your choice by 1.',
  featName: 'Ability Score Improvement',
};

const createBaseFormData = (overrides = {}) => ({
  rules: '2024',
  feats: [],
  abilities: [
    { name: 'Strength', baseScore: 8, featIncrease: 0 },
    { name: 'Dexterity', baseScore: 14, featIncrease: 0 },
    { name: 'Constitution', baseScore: 14, featIncrease: 0 },
    { name: 'Intelligence', baseScore: 8, featIncrease: 0 },
    { name: 'Wisdom', baseScore: 18, featIncrease: 0 },
    { name: 'Charisma', baseScore: 16, featIncrease: 0 },
  ],
  ...overrides,
});

const allFeats = [
  { name: 'Ability Score Improvement', benefits: [] },
  { name: 'Alert', benefits: [] },
];

describe('useWizardFeatAbilityChoices - FT-001 rollback of feat increases', () => {
  let formData;
  let setFormData;

  beforeEach(() => {
    vi.clearAllMocks();
    formData = createBaseFormData();
    setFormData = vi.fn((fn) => {
      if (typeof fn === 'function') {
        formData = fn(formData);
      }
    });
  });

  it('zeros orphan featIncreases and clears stale choices when all feats removed', () => {
    formData = createBaseFormData({
      feats: [],
      featAbilityChoices: {
        'Ability Score Improvement-0': { mode: 'single', assignments: { single: 'Wisdom' } },
      },
    });
    formData.abilities[4].featIncrease = 2;
    computeAllFeatBuffs.mockReturnValue({ abilityScoreIncreases: [] });

    renderHook(() => useWizardFeatAbilityChoices(formData, allFeats, setFormData));

    expect(setFormData).toHaveBeenCalled();
    const written = setFormData.mock.calls.map(c => (typeof c[0] === 'function' ? c[0](formData) : c[0])).pop();
    expect(written.featAbilityChoices).toEqual({});
    written.abilities.forEach(a => expect(a.featIncrease || 0).toBe(0));
    expect(written.abilities[4].featIncrease).toBe(0);
    expect(written.abilities[1].featIncrease).toBe(0);
  });

  it('zeros ASI increases while preserving non-choice feat increases when ASI unticked', () => {
    formData = createBaseFormData({
      feats: ['Alert'],
      featAbilityChoices: {
        'Ability Score Improvement-0': { mode: 'dual', assignments: { dual: ['Wisdom', 'Dexterity'] } },
      },
    });
    formData.abilities[1].featIncrease = 1;
    formData.abilities[4].featIncrease = 2;
    computeAllFeatBuffs.mockReturnValue({
      abilityScoreIncreases: [{ name: 'Constitution', amount: 1, featName: 'Alert' }],
    });

    renderHook(() => useWizardFeatAbilityChoices(formData, allFeats, setFormData));

    const written = setFormData.mock.calls.map(c => (typeof c[0] === 'function' ? c[0](formData) : c[0])).pop();
    expect(written.featAbilityChoices).toEqual({});
    expect(written.abilities[1].featIncrease).toBe(0);
    expect(written.abilities[4].featIncrease).toBe(0);
    expect(written.abilities[2].featIncrease).toBe(1);
  });

  it('writes back recomputed increases when a choice feat is replaced by another choice feat', () => {
    formData = createBaseFormData({
      feats: ['Ability Score Improvement'],
      featAbilityChoices: {
        'Ability Score Improvement-0': { mode: 'single', assignments: { single: 'Wisdom' } },
      },
    });
    formData.abilities[4].featIncrease = 2;
    computeAllFeatBuffs.mockReturnValue({ abilityScoreIncreases: [ASI_CHOICE] });

    const { rerender } = renderHook(
      ({ fd }) => useWizardFeatAbilityChoices(fd, allFeats, setFormData),
      { initialProps: { fd: formData } }
    );

    // Un-tick ASI, tick Alert (non-choice): ASI increases must roll back
    formData = createBaseFormData({
      feats: ['Alert'],
      featAbilityChoices: {
        'Ability Score Improvement-0': { mode: 'single', assignments: { single: 'Wisdom' } },
      },
    });
    formData.abilities[4].featIncrease = 2;
    computeAllFeatBuffs.mockReturnValue({
      abilityScoreIncreases: [{ name: 'Constitution', amount: 1, featName: 'Alert' }],
    });
    rerender({ fd: formData });

    const writes = setFormData.mock.calls.map(c => (typeof c[0] === 'function' ? c[0](formData) : c[0]));
    const rolledBack = writes.find(w => w.featAbilityChoices && Object.keys(w.featAbilityChoices).length === 0 && w.abilities);
    expect(rolledBack).toBeDefined();
    expect(rolledBack.abilities[4].featIncrease).toBe(0);
    expect(rolledBack.abilities[2].featIncrease).toBe(1);
  });

  it('does not write when there is no residue to roll back', () => {
    computeAllFeatBuffs.mockReturnValue({ abilityScoreIncreases: [] });

    renderHook(() => useWizardFeatAbilityChoices(formData, allFeats, setFormData));

    const abilityWrites = setFormData.mock.calls.filter(c => {
      const v = typeof c[0] === 'function' ? c[0](formData) : c[0];
      return v && 'abilities' in v;
    });
    expect(abilityWrites.length).toBe(0);
  });
});
