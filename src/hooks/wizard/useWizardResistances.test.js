// @maintained-by-ai
// useWizardResistances is a thin config wrapper over useWizardConfig (whose engine
// behaviour — validateFn invocation and warning population, re-validation on dep change,
// slot/preSelect resolution, getFn error handling, setWarnings — is owned by
// useWizardConfig.test.js). That engine is MOCKED here, so engine round-trips
// (async load, re-validate-on-rerender, error pass-through) run nothing and are omitted.
// This file keeps only what it owns: the wiring contract (one non-limit slot, getter
// identity, deps selectors), the return-key renames (warnings → resistanceWarnings),
// the resistances+immunities dedupe merge, and the custom hasItems guard.
// Pure mocks, synchronous, deterministic — no churn expected as the app changes.
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardResistances from './useWizardResistances.js';

vi.mock('./useWizardConfig.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../services/character/resistancesValidation.js', () => ({
  getPreSelectedResistances: vi.fn(),
  validateResistances: vi.fn(),
}));

import useWizardConfig from './useWizardConfig.js';
import { getPreSelectedResistances, validateResistances } from '../../services/character/resistancesValidation.js';

const DEFAULT_FORM_DATA = {
  class: { name: 'Fighter' },
  race: { name: 'Dwarf', subrace: { name: 'Hill Dwarf' } },
  background: 'Soldier',
  resistances: ['Poison'],
  immunities: [],
  rules: '5e',
  level: 1,
};

function renderResistances(formData = DEFAULT_FORM_DATA, setFormData = vi.fn()) {
  return renderHook(() => useWizardResistances(formData, setFormData));
}

function getConfig() {
  return useWizardConfig.mock.calls[0][0];
}

describe('useWizardResistances', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWizardConfig.mockReturnValue({
      preSelectedResistancesList: { resistances: [], immunities: [] },
      warnings: [],
      setWarnings: vi.fn(),
    });
  });

  describe('useWizardConfig wiring', () => {
    it('passes the resistances config (formData, setFormData, validateFn, one non-limit slot, deps selector) to useWizardConfig', () => {
      const setFormData = vi.fn();
      renderResistances(DEFAULT_FORM_DATA, setFormData);
      const config = getConfig();

      expect(config.formData).toBe(DEFAULT_FORM_DATA);
      expect(config.setFormData).toBe(setFormData);
      expect(config.validateFn).toBe(validateResistances);

      expect(config.slots).toHaveLength(1);
      expect(config.slots[0].get).toBe(getPreSelectedResistances);
      expect(config.slots[0].isLimit).toBe(false);
      expect(config.slots[0].state).toEqual({
        initial: { resistances: [], immunities: [] },
        key: 'preSelectedResistancesList',
      });

      expect(config.getDeps(DEFAULT_FORM_DATA)).toEqual([
        ['Poison'],
        [],
        'Fighter',
        'Dwarf',
        'Hill Dwarf',
        'Soldier',
        '5e',
        1,
      ]);

      expect(config.preSelect.getFn).toBe(getPreSelectedResistances);
      expect(config.preSelect.stateKey).toBe('preSelectedResistancesList');
      expect(config.preSelect.stateInitial).toEqual({ resistances: [], immunities: [] });
      expect(config.preSelect.deps(DEFAULT_FORM_DATA)).toEqual(['Dwarf', 'Hill Dwarf', 'Fighter', '5e']);
    });
  });

  describe('return value', () => {
    it('returns the engine values, renaming warnings to resistanceWarnings and setWarnings to setResistanceWarnings', () => {
      const setWarnings = vi.fn();
      const preSelected = { resistances: ['Cold'], immunities: ['Poison'] };
      useWizardConfig.mockReturnValue({
        preSelectedResistancesList: preSelected,
        warnings: [{ message: 'Hill Dwarf poison resistance', type: 'info' }],
        setWarnings,
      });
      const { result } = renderResistances();

      expect(Object.keys(result.current)).toEqual([
        'preSelectedResistancesList',
        'resistanceWarnings',
        'setResistanceWarnings',
      ]);
      // The only transformations this hook performs: warnings → resistanceWarnings.
      expect(result.current.resistanceWarnings).toEqual([{ message: 'Hill Dwarf poison resistance', type: 'info' }]);
      expect(result.current.setResistanceWarnings).toBe(setWarnings);
      expect(result.current.preSelectedResistancesList).toBe(preSelected);
    });
  });

  describe('deps selectors', () => {
    it('guard missing nested class/race/resistances fields via optional chaining (no throw, undefined slots)', () => {
      renderResistances();

      expect(getConfig().getDeps({})).toEqual([
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ]);
      expect(getConfig().preSelect.deps({})).toEqual([undefined, undefined, undefined, undefined]);

      // Present fields are preserved while absent nested fields stay undefined.
      expect(getConfig().getDeps({ resistances: ['Fire'], rules: '2024' })).toEqual([
        ['Fire'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '2024',
        undefined,
      ]);
      expect(getConfig().preSelect.deps({ race: { name: 'Elf' } })).toEqual(['Elf', undefined, undefined, undefined]);
    });
  });

  describe('preSelect.merge', () => {
    function getMerge() {
      renderResistances();
      return getConfig().preSelect.merge;
    }

    it('adds new pre-selected resistances and immunities without duplicating, preserving user picks and other form fields', () => {
      const merge = getMerge();

      const prev = { ...DEFAULT_FORM_DATA, resistances: ['Poison'], immunities: [] };
      const result = merge(prev, { resistances: ['Poison', 'Cold'], immunities: ['Disease'] }, []);

      expect(result.resistances).toEqual(['Poison', 'Cold']);
      expect(result.immunities).toEqual(['Disease']);
      expect(result.background).toBe('Soldier');
      expect(result.level).toBe(1);
    });

    it('leaves arrays untouched when every pre-selected item is already present', () => {
      const merge = getMerge();

      const prev = { resistances: ['Poison'], immunities: ['Disease'] };
      const result = merge(prev, { resistances: ['Poison'], immunities: ['Disease'] }, []);

      expect(result.resistances).toEqual(['Poison']);
      expect(result.immunities).toEqual(['Disease']);
    });

    it('treats undefined and null prev resistances/immunities as empty arrays', () => {
      const merge = getMerge();

      const undefinedPrev = merge({ resistances: undefined, immunities: undefined }, { resistances: ['Fire'], immunities: ['Psychic'] }, []);
      expect(undefinedPrev.resistances).toEqual(['Fire']);
      expect(undefinedPrev.immunities).toEqual(['Psychic']);

      const nullPrev = merge({ resistances: null, immunities: null }, { resistances: ['Lightning'], immunities: ['Force'] }, []);
      expect(nullPrev.resistances).toEqual(['Lightning']);
      expect(nullPrev.immunities).toEqual(['Force']);
    });
  });

  describe('preSelect.hasItems', () => {
    it('returns true when either resistances or immunities are non-empty, false when both are empty', () => {
      renderResistances();
      const hasItems = getConfig().preSelect.hasItems;

      expect(hasItems({ resistances: ['Poison'], immunities: [] })).toBe(true);
      expect(hasItems({ resistances: [], immunities: ['Disease'] })).toBe(true);
      expect(hasItems({ resistances: [], immunities: [] })).toBe(false);
    });
  });
});
