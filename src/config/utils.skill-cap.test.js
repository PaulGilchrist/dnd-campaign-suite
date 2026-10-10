// Regression tests for FT-002: the wizard Skill Proficiencies step (10)
// previously had no blocking validator — the counter honestly displayed
// "You have selected 3 of 2 allowed" but Next/Save stayed enabled and the
// over-cap selection persisted. Next/Save must be gated while the
// selection exceeds the allowed count (both rulesets share this path).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateStep } from './utils.js';
import { getSkillLimits } from '../services/character/skillValidation/index.js';

vi.mock('../services/character/skillValidation/index.js', () => ({
  getSkillLimits: vi.fn(),
}));

const wizardFormData = (skillProficiencies) => ({
  name: 'BugTestWizard',
  level: 1,
  alignment: 'True Neutral',
  rules: '5e',
  race: { name: 'Human' },
  class: { name: 'Wizard', subclass: { name: 'Evocation' } },
  skillProficiencies,
  expertSkills: [],
});

const context5e = {
  racesData: [],
  classSubtypes: [],
  ruleset: '5e',
  existingNames: [],
  allFeats: [],
};

describe('validateStep 10 (Skill Proficiencies) cap gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Canonical 5e Wizard lvl1: proficiency_choices choose 2 (classes.json)
    getSkillLimits.mockResolvedValue({ allowed: 2, details: 'Choose 2' });
  });

  it('blocks Next when 3 of 2 allowed skills are selected', async () => {
    const errors = await validateStep(10, wizardFormData(['Arcana', 'History', 'Religion']), context5e);
    expect(errors).toHaveProperty('skillProficiencies');
    expect(errors.skillProficiencies).toContain('allow 2');
    expect(errors.skillProficiencies).toContain('selected 3');
  });

  it('accepts exactly the allowed number of skills', async () => {
    const errors = await validateStep(10, wizardFormData(['Arcana', 'History']), context5e);
    expect(errors).toEqual({});
  });

  it('accepts an empty selection (no minimum enforced)', async () => {
    const errors = await validateStep(10, wizardFormData([]), context5e);
    expect(errors).toEqual({});
  });

  it('accepts over-cap selection when limits allow it (e.g. Boon of Skill)', async () => {
    getSkillLimits.mockResolvedValue({ allowed: 21, details: 'all skills' });
    const errors = await validateStep(10, wizardFormData(['Arcana', 'History', 'Religion']), context5e);
    expect(errors).toEqual({});
  });

  it('forwards allFeats from context to getSkillLimits', async () => {
    const allFeats = [{ name: 'Skilled' }];
    await validateStep(10, wizardFormData(['Arcana']), { ...context5e, allFeats });
    expect(getSkillLimits).toHaveBeenCalledWith(expect.anything(), allFeats);
  });

  it('gates the 2024 ruleset through the same validator', async () => {
    getSkillLimits.mockResolvedValue({ allowed: 2, details: 'Choose 2' });
    const formData = { ...wizardFormData(['Arcana', 'History', 'Religion']), rules: '2024' };
    const errors = await validateStep(10, formData, { ...context5e, ruleset: '2024' });
    expect(errors).toHaveProperty('skillProficiencies');
  });
});
