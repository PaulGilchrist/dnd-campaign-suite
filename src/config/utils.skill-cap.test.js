// @maintained-by-ai: 2026-10-14
// Regression tests for FT-002: the wizard Skill Proficiencies step (10)
// previously had no blocking validator — the counter honestly displayed
// "You have selected 3 of 2 allowed" but Next/Save stayed enabled and the
// over-cap selection persisted. Next/Save must be gated while the
// selection exceeds the allowed count (both rulesets share this path).
//
// Seam: getSkillLimits is mocked here on purpose. Its own computation
// (class/race/background/feat allowances, Boon of Skill, Skilled pools)
// is covered by the skillValidation suites (skillValidation-core,
// -feats, -choice-sources, validation). These tests pin only the step-10
// gating contract in validateStep: it consults getSkillLimits, gates on
// `allowed`, and reports the exact user-facing message. The error text is
// pinned as a literal (never imported) so accidentally changing the message
// breaks these tests.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateStep } from './utils.js';

vi.mock('../services/character/skillValidation/index.js', () => ({
  getSkillLimits: vi.fn(),
}));

import { getSkillLimits } from '../services/character/skillValidation/index.js';

// Canonical 5e Wizard lvl1: proficiency_choices choose 2 (classes.json).
// Only `allowed` drives the gate, so the mock returns just that field.
const ALLOWED_2 = { allowed: 2 };

const capError = (allowed, selected) =>
  `Rules allow ${allowed} skill proficiency/ies. You have selected ${selected}. Deselect ${selected - allowed} to continue.`;

const wizardForm = (skillProficiencies, rules = '5e') => ({
  name: 'BugTestWizard',
  level: 1,
  rules,
  race: { name: 'Human' },
  class: { name: 'Wizard', subclass: { name: 'Evocation' } },
  skillProficiencies,
  expertSkills: [],
});

describe('validateStep 10 (Skill Proficiencies) cap gate', () => {
  beforeEach(() => {
    getSkillLimits.mockReset().mockResolvedValue(ALLOWED_2);
  });

  it.each(['5e', '2024'])('blocks over-cap selection under the %s ruleset and computes the deselect count', async (rules) => {
    await expect(validateStep(10, wizardForm(['Arcana', 'History', 'Religion'], rules)))
      .resolves.toEqual({ skillProficiencies: capError(2, 3) });
    await expect(validateStep(10, wizardForm(['Arcana', 'History', 'Religion', 'Nature'], rules)))
      .resolves.toEqual({ skillProficiencies: capError(2, 4) });
  });

  it('accepts selections at or below the cap, including a missing selection field (no minimum, no crash)', async () => {
    await expect(validateStep(10, wizardForm(['Arcana', 'History']))).resolves.toEqual({});
    await expect(validateStep(10, wizardForm(['Arcana']))).resolves.toEqual({});
    const form = wizardForm([]);
    delete form.skillProficiencies;
    await expect(validateStep(10, form)).resolves.toEqual({});
  });

  it('accepts the same over-cap selection once the limits service raises the cap (e.g. Boon of Skill)', async () => {
    getSkillLimits.mockResolvedValue({ allowed: 21 });
    await expect(validateStep(10, wizardForm(['Arcana', 'History', 'Religion']))).resolves.toEqual({});
  });

  it('forwards formData and context.allFeats to getSkillLimits, defaulting allFeats to an empty list', async () => {
    const formData = wizardForm(['Arcana']);
    const allFeats = [{ name: 'Skilled' }];
    await validateStep(10, formData, { allFeats });
    expect(getSkillLimits).toHaveBeenCalledWith(formData, allFeats);
    await validateStep(10, formData, {});
    expect(getSkillLimits).toHaveBeenLastCalledWith(formData, []);
  });
});
