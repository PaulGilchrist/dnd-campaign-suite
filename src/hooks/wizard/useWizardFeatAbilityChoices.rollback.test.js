// @maintained-by-ai
// Owns: rollbackFeatIncreases semantics of useWizardFeatAbilityChoices.js — both
// paths that roll back feat-derived ability increases (feats emptied, and feats
// non-empty but no choice-type increases left), the residue guard (rollback writes
// ONLY when stale featAbilityChoices and/or orphan featIncreases exist — one test
// per guard clause), preservation of non-choice feat increases during rollback, and
// rollback of a previously-initialised choice group across renders.
// Adjacency adjudication: dedup.test.js "does not reprocess when the rules|feats
// key is unchanged" pins the lastProcessedKey call-count guard on RE-render; this
// suite's "does not write when there is no residue" pins rollbackFeatIncreases's
// own residue guard — different guards, both kept.
// Fully deterministic (computeAllFeatBuffs fully mocked); stable contract.
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

const ALERT_INCREASE = { name: 'Constitution', amount: 1, featName: 'Alert' };

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

describe('useWizardFeatAbilityChoices - rollback of feat increases', () => {
  let formData;
  let setFormData;

  beforeEach(() => {
    vi.clearAllMocks();
    formData = createBaseFormData();
    // Stateful stand-in for the wizard's setFormData so functional updates
    // compose against the evolving form state.
    setFormData = vi.fn((fn) => {
      if (typeof fn === 'function') {
        formData = fn(formData);
      }
    });
  });

  // Apply the latest setFormData update to inspect the written payload.
  const lastWrite = () => {
    const args = setFormData.mock.calls[setFormData.mock.calls.length - 1];
    return typeof args[0] === 'function' ? args[0](formData) : args[0];
  };

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
    const written = lastWrite();
    expect(written.featAbilityChoices).toEqual({});
    expect(written.abilities[4].featIncrease).toBe(0);
    written.abilities.forEach(a => expect(a.featIncrease || 0).toBe(0));
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
    computeAllFeatBuffs.mockReturnValue({ abilityScoreIncreases: [ALERT_INCREASE] });

    renderHook(() => useWizardFeatAbilityChoices(formData, allFeats, setFormData));

    expect(setFormData).toHaveBeenCalled();
    const written = lastWrite();
    expect(written.featAbilityChoices).toEqual({});
    // Rollback is not blanket-zeroing: the Alert non-choice increase survives.
    expect(written.abilities[1].featIncrease).toBe(0);
    expect(written.abilities[4].featIncrease).toBe(0);
    expect(written.abilities[2].featIncrease).toBe(1);
  });

  it('rolls back a previously-initialised choice group when ASI is unticked for a non-choice feat', () => {
    // Mount with ASI ticked: the saved single-mode choice initialises cleanly
    // and no rollback write occurs yet.
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
    expect(setFormData).not.toHaveBeenCalled();

    // Un-tick ASI, tick Alert (non-choice): the ASI residue must roll back.
    formData = createBaseFormData({
      feats: ['Alert'],
      featAbilityChoices: {
        'Ability Score Improvement-0': { mode: 'single', assignments: { single: 'Wisdom' } },
      },
    });
    formData.abilities[4].featIncrease = 2;
    computeAllFeatBuffs.mockReturnValue({ abilityScoreIncreases: [ALERT_INCREASE] });
    rerender({ fd: formData });

    const written = lastWrite();
    expect(written.featAbilityChoices).toEqual({});
    expect(written.abilities[4].featIncrease).toBe(0);
    expect(written.abilities[2].featIncrease).toBe(1);
  });

  it('rolls back orphan featIncreases even when featAbilityChoices is already empty', () => {
    // Second clause of the residue guard: hasOrphanIncreases alone triggers it.
    formData = createBaseFormData({ feats: [] });
    formData.abilities[0].featIncrease = 1;
    computeAllFeatBuffs.mockReturnValue({ abilityScoreIncreases: [] });

    renderHook(() => useWizardFeatAbilityChoices(formData, allFeats, setFormData));

    expect(setFormData).toHaveBeenCalled();
    const written = lastWrite();
    expect(written.featAbilityChoices).toEqual({});
    expect(written.abilities[0].featIncrease).toBe(0);
  });

  it('does not write when there is no residue to roll back', () => {
    // Pins rollbackFeatIncreases's residue guard (both clauses false) on the
    // feats-empty mount path — NOT the dedup suite's lastProcessedKey guard.
    computeAllFeatBuffs.mockReturnValue({ abilityScoreIncreases: [] });

    renderHook(() => useWizardFeatAbilityChoices(formData, allFeats, setFormData));

    const abilityWrites = setFormData.mock.calls.filter(c => {
      const v = typeof c[0] === 'function' ? c[0](formData) : c[0];
      return v && 'abilities' in v;
    });
    expect(abilityWrites.length).toBe(0);
  });
});
