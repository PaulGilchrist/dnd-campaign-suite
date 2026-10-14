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

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetFormData.mockImplementation((fn) => {
      if (typeof fn === 'function') {
        return fn(mockSetFormData.lastFormData || {});
      }
    });
  });

  it('does not reprocess when formData and feats have not changed', () => {
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
    const { rerender } = renderHook(
      ({ fd }) => useWizardFeatAbilityChoices(fd, createMockAllFeats(), mockSetFormData),
      { initialProps: { fd: formData } }
    );

    const initialCalls = computeAllFeatBuffs.mock.calls.length;
    rerender({ fd: formData });
    expect(computeAllFeatBuffs.mock.calls.length).toBe(initialCalls);
  });

  it('reprocesses when rules change', () => {
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

    const formData1 = createBaseFormData({ rules: '5e', feats: ['Tough'] });
    const formData2 = createBaseFormData({ rules: '2024', feats: ['Tough'] });

    const { rerender } = renderHook(
      ({ fd }) => useWizardFeatAbilityChoices(fd, createMockAllFeats(), mockSetFormData),
      { initialProps: { fd: formData1 } }
    );

    const initialCalls = computeAllFeatBuffs.mock.calls.length;
    rerender({ fd: formData2 });
    expect(computeAllFeatBuffs.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it('reprocesses when feats change', () => {
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

    const formData1 = createBaseFormData({ feats: ['Tough'] });
    const formData2 = createBaseFormData({ feats: ['Tough', 'Observant'] });

    const { rerender } = renderHook(
      ({ fd }) => useWizardFeatAbilityChoices(fd, createMockAllFeats(), mockSetFormData),
      { initialProps: { fd: formData1 } }
    );

    const initialCalls = computeAllFeatBuffs.mock.calls.length;
    rerender({ fd: formData2 });
    expect(computeAllFeatBuffs.mock.calls.length).toBeGreaterThan(initialCalls);
  });
});
