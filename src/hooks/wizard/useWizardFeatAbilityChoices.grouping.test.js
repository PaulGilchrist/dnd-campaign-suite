// @maintained-by-ai
// Sole owner of grouped-choice structure coverage for useWizardFeatAbilityChoices.js:
// buildGroupedChoices (fixed / choice 1-2 / multi-amount-fallback branches) and the
// normalizeAbilityNames parsing branches ("Increase your X score", "Choose ... from:",
// all-abilities fallback), asserted via result.current.featAbilityChoices.
// Siblings assert only the savedChoices payload passed to setFormData, never this
// structure. Fully deterministic (computeAllFeatBuffs mocked); stable contract for
// the wizard UI renderer.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useWizardFeatAbilityChoices from './useWizardFeatAbilityChoices.js';

vi.mock('../../services/character/featBuffService.js', () => ({
  computeAllFeatBuffs: vi.fn(),
}));

import { computeAllFeatBuffs } from '../../services/character/featBuffService.js';

describe('useWizardFeatAbilityChoices - building grouped choices', () => {
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

  const renderWithIncrease = (increase, featName) =>
    renderHook(() => {
      computeAllFeatBuffs.mockReturnValue({ abilityScoreIncreases: [increase] });
      return useWizardFeatAbilityChoices(
        createBaseFormData({ feats: [featName] }),
        createMockAllFeats([featName]),
        mockSetFormData
      );
    });

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetFormData.mockImplementation((fn) => {
      if (typeof fn === 'function') {
        return fn(mockSetFormData.lastFormData || {});
      }
    });
  });

  it('creates a fixed group for single-amount ability increases', () => {
    const { result } = renderWithIncrease({
      name: 'any',
      amount: 1,
      isChoice: true,
      description: 'Increase your Strength score',
      featName: 'Tough',
      featDescription: 'Test feat',
    }, 'Tough');

    expect(result.current.featAbilityChoices).toHaveLength(1);
    const group = result.current.featAbilityChoices[0];
    expect(group.id).toBe('Tough-0');
    expect(group.featName).toBe('Tough');
    expect(group.featDescription).toBe('Test feat');
    expect(group.type).toBe('fixed');
    expect(group.amount).toBe(1);
    expect(group.abilityNames).toEqual(['Strength']);
  });

  it('creates a choice group for 1/2 amount patterns', () => {
    const { result } = renderWithIncrease({
      name: 'any',
      amount: [1, 2],
      isChoice: true,
      description: 'Choose one ability score from: Strength, Dexterity, Constitution',
      featName: 'Custom',
      featDescription: 'Custom feat',
    }, 'Custom');

    expect(result.current.featAbilityChoices).toHaveLength(1);
    const group = result.current.featAbilityChoices[0];
    expect(group.id).toBe('Custom-0');
    expect(group.type).toBe('choice');
    expect(group.mode).toBe('single');
    expect(group.featDescription).toBe('Custom feat');
    expect(group.options.single.amount).toBe(2);
    expect(group.options.single.abilityNames).toEqual(['Strength', 'Dexterity', 'Constitution']);
    expect(group.options.dual.amount).toBe(1);
    expect(group.options.dual.count).toBe(2);
    expect(group.options.dual.abilityNames).toEqual(['Strength', 'Dexterity', 'Constitution']);
  });

  it('falls back to a fixed group using the first amount for non-1/2 amount arrays', () => {
    const { result } = renderWithIncrease({
      name: 'any',
      amount: [2, 2],
      isChoice: true,
      description: 'Increase your Wisdom score',
      featName: 'Custom',
    }, 'Custom');

    expect(result.current.featAbilityChoices).toHaveLength(1);
    const group = result.current.featAbilityChoices[0];
    expect(group.type).toBe('fixed');
    expect(group.amount).toBe(2);
    expect(group.featDescription).toBe('');
    expect(group.abilityNames).toEqual(['Wisdom']);
  });

  it('parses multi-ability names from "Increase your X or Y score" pattern', () => {
    const { result } = renderWithIncrease({
      name: 'any',
      amount: 1,
      isChoice: true,
      description: 'Increase your Strength or Dexterity score',
      featName: 'Feat',
    }, 'Feat');

    const group = result.current.featAbilityChoices[0];
    expect(group.abilityNames).toEqual(['Strength', 'Dexterity']);
  });

  it('falls back to all abilities when no pattern matches', () => {
    const { result } = renderWithIncrease({
      name: 'any',
      amount: 1,
      isChoice: true,
      description: 'Some random description without a pattern',
      featName: 'Mystery',
    }, 'Mystery');

    const group = result.current.featAbilityChoices[0];
    expect(group.abilityNames).toEqual([
      'Strength', 'Dexterity', 'Constitution',
      'Intelligence', 'Wisdom', 'Charisma',
    ]);
  });
});
