// @maintained-by-ai 2026-11-24
/**
 * Regression tests for the Save-gate belt of
 * `bug-ruleset-switch-ledger-persists-overcap-feats-skills`.
 *
 * The wizard's sidebar Save is a monotonic valid-PREFIX ladder over the
 * EARLY steps, and handleSubmit only re-validated the CURRENT step — so a
 * ruleset switch (or a disk-loaded draft) carrying over-cap feats/skills
 * saved forever while the steps honestly printed "1 of 0 allowed feat(s)"
 * and "3 of 2 allowed skill proficiency/ies". Mirrors the skill-cap twin
 * (utils.skill-cap.test.js): the limits services are mocked here on
 * purpose — their own suites cover the allowance math; these tests pin the
 * gating contract: step 8 gates on the USER (non-pre-selected) feat count
 * vs getFeatLimits().allowed, and validateSelectionCaps merges the feats +
 * skills cap errors into one whole-form audit the wizard gates Save on.
 * Error texts are pinned as literals (never imported).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateStep, validateSelectionCaps } from './utils.js';

vi.mock('../services/character/featValidation.js', () => ({
  getFeatLimits: vi.fn(),
  getPreSelectedFeats: vi.fn(),
}));
vi.mock('../services/character/skillValidation/index.js', () => ({
  getSkillLimits: vi.fn(),
}));

import { getFeatLimits, getPreSelectedFeats } from '../services/character/featValidation.js';
import { getSkillLimits } from '../services/character/skillValidation/index.js';

const featError = (allowed, selected, level = 1) =>
  `Rules allow ${allowed} feat(s) at level ${level}. You have selected ${selected}. Deselect ${selected - allowed} to continue.`;
const skillError = (allowed, selected) =>
  `Rules allow ${allowed} skill proficiency/ies. You have selected ${selected}. Deselect ${selected - allowed} to continue.`;

const fighterForm = (overrides = {}) => ({
  name: 'CapGateProbe',
  level: 1,
  rules: '5e',
  race: { name: 'Human' },
  class: { name: 'Fighter', subclass: { name: 'Champion' } },
  background: '',
  feats: [],
  skillProficiencies: [],
  ...overrides,
});

describe('validateStep 8 (Feats) cap gate', () => {
  beforeEach(() => {
    getFeatLimits.mockReset().mockResolvedValue({ allowed: 0 });
    getPreSelectedFeats.mockReset().mockResolvedValue([]);
  });

  it('blocks the exact bug state: a held feat on a 5e level-1 build (1 selected of 0 allowed)', async () => {
    await expect(validateStep(8, fighterForm({ feats: ['Savage Attacker'] })))
      .resolves.toEqual({ feats: featError(0, 1) });
  });

  it('counts USER feats past the cap and names the deselect remainder', async () => {
    getFeatLimits.mockResolvedValue({ allowed: 1 });
    await expect(validateStep(8, fighterForm({ level: 4, feats: ['Alert', 'Lucky'] })))
      .resolves.toEqual({ feats: featError(1, 2, 4) });
  });

  it('excludes background pre-selections from the user count (WizardStepFeats parity)', async () => {
    getFeatLimits.mockResolvedValue({ allowed: 0 });
    getPreSelectedFeats.mockResolvedValue(['Savage Attacker']);
    await expect(validateStep(8, fighterForm({
      rules: '2024',
      background: 'Soldier',
      feats: ['Savage Attacker'],
    }))).resolves.toEqual({});
  });

  it('accepts selections at or below the cap, including a missing feats field', async () => {
    await expect(validateStep(8, fighterForm())).resolves.toEqual({});
    getFeatLimits.mockResolvedValue({ allowed: 2 });
    await expect(validateStep(8, fighterForm({ feats: ['Alert'] }))).resolves.toEqual({});
    const form = fighterForm();
    delete form.feats;
    await expect(validateStep(8, form)).resolves.toEqual({});
  });

  it('forwards formData to getFeatLimits and pre-selected feats to the count', async () => {
    const formData = fighterForm({ feats: ['Alert'] });
    await validateStep(8, formData);
    expect(getFeatLimits).toHaveBeenCalledWith(formData);
    expect(getPreSelectedFeats).toHaveBeenCalledWith(formData);
  });
});

describe('validateSelectionCaps — whole-form feats+skills audit (Save belt)', () => {
  beforeEach(() => {
    getFeatLimits.mockReset().mockResolvedValue({ allowed: 0 });
    getPreSelectedFeats.mockReset().mockResolvedValue([]);
    getSkillLimits.mockReset().mockResolvedValue({ allowed: 2 });
  });

  it('merges both cap violations into one errors object (the bug state: 1 feat of 0 + 3 skills of 2)', async () => {
    const formData = fighterForm({
      feats: ['Savage Attacker'],
      skillProficiencies: ['Athletics', 'Acrobatics', 'Intimidation'],
    });
    await expect(validateSelectionCaps(formData, { allFeats: [] }))
      .resolves.toEqual({
        feats: featError(0, 1),
        skillProficiencies: skillError(2, 3),
      });
  });

  it('flags the skills lane ALONE when only skills are over-cap (ledger cannot pre-drop skill rows)', async () => {
    const formData = fighterForm({
      skillProficiencies: ['Athletics', 'Acrobatics', 'Intimidation'],
    });
    await expect(validateSelectionCaps(formData, { allFeats: [] }))
      .resolves.toEqual({ skillProficiencies: skillError(2, 3) });
  });

  it('returns no errors when both lanes sit at or under their caps (a compliant save never blocks)', async () => {
    getFeatLimits.mockResolvedValue({ allowed: 1 });
    const formData = fighterForm({ level: 4, feats: ['Alert'], skillProficiencies: ['Athletics', 'Acrobatics'] });
    await expect(validateSelectionCaps(formData, { allFeats: [] })).resolves.toEqual({});
  });

  it('forwards context.allFeats to getSkillLimits, defaulting to an empty list', async () => {
    const formData = fighterForm({ skillProficiencies: ['Athletics'] });
    await validateSelectionCaps(formData, { allFeats: [{ name: 'Skilled' }] });
    expect(getSkillLimits).toHaveBeenCalledWith(formData, [{ name: 'Skilled' }]);
    await validateSelectionCaps(formData);
    expect(getSkillLimits).toHaveBeenLastCalledWith(formData, []);
  });
});
