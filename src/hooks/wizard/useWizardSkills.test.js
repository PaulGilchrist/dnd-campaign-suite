// @maintained-by-ai
// useWizardSkills is a thin config wrapper over useWizardConfig (whose engine
// behaviour — validateFn invocation and warning population, slot resolution,
// preSelect getFn/merge invocation, deps-based re-validation, setWarnings —
// is owned by useWizardConfig.test.js). That engine is MOCKED here, so engine
// round-trips (null/empty pass-through, rerender reactivity) run nothing and
// are omitted. This file keeps only what it owns: the wiring contract (two
// limit slots, state keys), the allFeats closure forwarding to every
// skillValidation callback (including null/[] passed through unchanged — this
// wrapper's distinguishing parameter), the warnings → skillWarnings rename,
// the skills-specific getDeps/preSelect.deps selectors, and the
// skillProficiencies dedupe merge. Pure mocks, synchronous, deterministic —
// no churn expected as the app changes.
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardSkills from './useWizardSkills.js';
import * as skillValidation from '../../services/character/skillValidation.js';

vi.mock('./useWizardConfig.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../services/character/skillValidation.js', () => ({
  validateSkills: vi.fn(),
  getSkillLimits: vi.fn(),
  getExpertiseLimits: vi.fn(),
  getPreSelectedSkills: vi.fn(),
}));

import useWizardConfig from './useWizardConfig.js';

const DEFAULT_FORM_DATA = {
  class: { name: 'Fighter' },
  race: { name: 'Human' },
  background: 'Soldier',
  skillProficiencies: ['Athletics'],
  expertSkills: [],
  rules: '5e',
  level: 1,
};

const MOCK_SET_FORM_DATA = vi.fn();

function renderSkills(formData = DEFAULT_FORM_DATA, setFormData = MOCK_SET_FORM_DATA, allFeats = null) {
  return renderHook(() => useWizardSkills(formData, setFormData, allFeats));
}

function getConfig() {
  return useWizardConfig.mock.calls[0][0];
}

function mockEngineResult(warnings = []) {
  useWizardConfig.mockReturnValue({
    skillLimits: null,
    expertiseLimits: null,
    preSelectedSkills: [],
    warnings,
    setWarnings: vi.fn(),
  });
}

describe('useWizardSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEngineResult();
  });

  it('passes the skills config (formData, setFormData, two limit slots, state keys, selector functions) to useWizardConfig', () => {
    renderSkills();
    const config = getConfig();

    expect(config.formData).toBe(DEFAULT_FORM_DATA);
    expect(config.setFormData).toBe(MOCK_SET_FORM_DATA);

    expect(config.slots).toHaveLength(2);
    expect(config.slots[0].state).toEqual({ initial: null, key: 'skillLimits' });
    expect(config.slots[0].isLimit).toBe(true);
    expect(config.slots[1].state).toEqual({ initial: null, key: 'expertiseLimits' });
    expect(config.slots[1].isLimit).toBe(true);

    expect(config.preSelect.stateKey).toBe('preSelectedSkills');
    expect(typeof config.validateFn).toBe('function');
    expect(typeof config.getDeps).toBe('function');
  });

  it('validateFn, both slot getters, and preSelect.getFn delegate to skillValidation with formData and the closed-over allFeats', async () => {
    const mockFeats = [
      { name: 'Skill Expert', benefits: [] },
      { name: 'Skilled', benefits: [] },
    ];
    renderSkills(DEFAULT_FORM_DATA, MOCK_SET_FORM_DATA, mockFeats);
    const config = getConfig();

    await config.validateFn(DEFAULT_FORM_DATA);
    expect(skillValidation.validateSkills).toHaveBeenCalledWith(DEFAULT_FORM_DATA, mockFeats);

    await config.slots[0].get(DEFAULT_FORM_DATA);
    expect(skillValidation.getSkillLimits).toHaveBeenCalledWith(DEFAULT_FORM_DATA, mockFeats);

    await config.slots[1].get(DEFAULT_FORM_DATA);
    expect(skillValidation.getExpertiseLimits).toHaveBeenCalledWith(DEFAULT_FORM_DATA, mockFeats);

    await config.preSelect.getFn(DEFAULT_FORM_DATA);
    expect(skillValidation.getPreSelectedSkills).toHaveBeenCalledWith(DEFAULT_FORM_DATA, mockFeats);
  });

  it('forwards null and empty-array allFeats to every callback unchanged (no fabricated defaults)', async () => {
    for (const allFeats of [null, []]) {
      vi.clearAllMocks();
      mockEngineResult();
      renderSkills(DEFAULT_FORM_DATA, MOCK_SET_FORM_DATA, allFeats);
      const config = getConfig();

      await config.validateFn(DEFAULT_FORM_DATA);
      expect(skillValidation.validateSkills).toHaveBeenCalledWith(DEFAULT_FORM_DATA, allFeats);

      await config.slots[0].get(DEFAULT_FORM_DATA);
      expect(skillValidation.getSkillLimits).toHaveBeenCalledWith(DEFAULT_FORM_DATA, allFeats);

      await config.slots[1].get(DEFAULT_FORM_DATA);
      expect(skillValidation.getExpertiseLimits).toHaveBeenCalledWith(DEFAULT_FORM_DATA, allFeats);

      await config.preSelect.getFn(DEFAULT_FORM_DATA);
      expect(skillValidation.getPreSelectedSkills).toHaveBeenCalledWith(DEFAULT_FORM_DATA, allFeats);
    }
  });

  it('returns the engine values, renaming warnings to skillWarnings (and exposing no warnings key)', () => {
    const setWarnings = vi.fn();
    useWizardConfig.mockReturnValue({
      skillLimits: { maxSkills: 4 },
      expertiseLimits: { allowed: true, count: 1 },
      preSelectedSkills: ['Athletics', 'Stealth'],
      warnings: ['Too many skills'],
      setWarnings,
    });
    const { result } = renderSkills();

    expect(Object.keys(result.current)).toEqual([
      'skillLimits',
      'expertiseLimits',
      'preSelectedSkills',
      'setWarnings',
      'skillWarnings',
    ]);
    // The only transformation this hook performs: warnings → skillWarnings.
    expect(result.current.skillWarnings).toEqual(['Too many skills']);
    expect(result.current).not.toHaveProperty('warnings');
    expect(result.current.setWarnings).toBe(setWarnings);
    expect(result.current.skillLimits).toEqual({ maxSkills: 4 });
    expect(result.current.expertiseLimits).toEqual({ allowed: true, count: 1 });
    expect(result.current.preSelectedSkills).toEqual(['Athletics', 'Stealth']);
  });

  describe('deps selectors', () => {
    it('getDeps and preSelect.deps read the skills-relevant form fields', () => {
      renderSkills();

      expect(getConfig().getDeps(DEFAULT_FORM_DATA)).toEqual([
        ['Athletics'],
        [],
        'Fighter',
        undefined, // class.major.name
        undefined, // class.subclass.name
        'Human',
        'Soldier',
        '5e',
        1,
        undefined, // feats
        undefined, // toolProficiencies
      ]);
      expect(getConfig().preSelect.deps(DEFAULT_FORM_DATA)).toEqual([
        'Soldier',
        'Human',
        'Fighter',
        '5e',
        undefined, // feats
      ]);
    });

    it('guard missing nested class/race fields via optional chaining (no throw, undefined slots)', () => {
      renderSkills();

      expect(getConfig().getDeps({})).toEqual(Array(11).fill(undefined));
      expect(getConfig().preSelect.deps({})).toEqual(Array(5).fill(undefined));

      // Present fields are preserved while absent nested fields stay undefined.
      expect(getConfig().getDeps({ skillProficiencies: ['Stealth'], rules: '2024' })).toEqual([
        ['Stealth'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '2024',
        undefined,
        undefined,
        undefined,
      ]);
      expect(getConfig().preSelect.deps({ race: { name: 'Elf' } })).toEqual([
        undefined,
        'Elf',
        undefined,
        undefined,
        undefined,
      ]);
    });
  });

  describe('preSelect.merge', () => {
    function getMerge() {
      renderSkills();
      return getConfig().preSelect.merge;
    }

    it('adds new pre-selected skills to skillProficiencies without duplicating, preserving other form fields', () => {
      const merge = getMerge();

      const prev = { skillProficiencies: ['Athletics', 'Stealth'], name: 'Test' };
      const result = merge(prev, ['Stealth', 'Perception'], []);

      expect(result.skillProficiencies).toEqual(['Athletics', 'Stealth', 'Perception']);
      expect(result.name).toBe('Test');
    });

    it('creates skillProficiencies when prev lacks it and leaves prev untouched for empty items', () => {
      const merge = getMerge();

      expect(merge({}, ['Athletics'], []).skillProficiencies).toEqual(['Athletics']);
      expect(merge({ skillProficiencies: ['Athletics'] }, [], []).skillProficiencies).toEqual(['Athletics']);
    });
  });
});
