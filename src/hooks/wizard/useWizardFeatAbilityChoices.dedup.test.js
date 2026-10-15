// @maintained-by-ai
// Owns: lastProcessedKey dedup contract of useWizardFeatAbilityChoices —
// reprocess only when the rules|feats key changes. Sibling suites own
// grouping, initialization, migration, rollback, choice, and modechange behaviour.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useWizardFeatAbilityChoices from './useWizardFeatAbilityChoices.js';

vi.mock('../../services/character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(),
}));

import { computeAllFeatBuffs } from '../../services/character/featBuffService.js';

describe('useWizardFeatAbilityChoices - deduplication via key tracking', () => {
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

  const renderWithFormData = (fd) =>
    renderHook(
      ({ fd }) => useWizardFeatAbilityChoices(fd, createMockAllFeats(), mockSetFormData),
      { initialProps: { fd } }
    );

  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('does not reprocess when the rules|feats key is unchanged', () => {
    const formData = createBaseFormData({ feats: ['Tough'] });
    const { rerender } = renderWithFormData(formData);

    const initialCalls = computeAllFeatBuffs.mock.calls.length;
    expect(initialCalls).toBeGreaterThan(0);

    // Same object: the effect still re-runs (fresh allFeats identity each
    // render) but the key guard must prevent reprocessing.
    rerender({ fd: formData });
    // New object with unrelated field changes: key is unchanged, still no
    // reprocessing — the key derives solely from rules and feat names.
    rerender({ fd: { ...formData, name: 'Zzz', abilities: formData.abilities.map(a => ({ ...a, featIncrease: 0 })) } });
    expect(computeAllFeatBuffs.mock.calls.length).toBe(initialCalls);
  });

  it('reprocesses when rules change', () => {
    const formData1 = createBaseFormData({ rules: '5e', feats: ['Tough'] });
    const formData2 = createBaseFormData({ rules: '2024', feats: ['Tough'] });

    const { rerender } = renderWithFormData(formData1);

    const initialCalls = computeAllFeatBuffs.mock.calls.length;
    rerender({ fd: formData2 });
    expect(computeAllFeatBuffs.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it('reprocesses when feats change', () => {
    const formData1 = createBaseFormData({ feats: ['Tough'] });
    const formData2 = createBaseFormData({ feats: ['Tough', 'Observant'] });

    const { rerender } = renderWithFormData(formData1);

    const initialCalls = computeAllFeatBuffs.mock.calls.length;
    rerender({ fd: formData2 });
    expect(computeAllFeatBuffs.mock.calls.length).toBeGreaterThan(initialCalls);
  });
});
