import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateSkills } from './validation.js';

vi.mock('./limits.js', () => ({
  getSkillLimits: vi.fn(),
}));
vi.mock('./expertise.js', () => ({
  getExpertiseLimits: vi.fn(),
}));

import { getSkillLimits } from './limits.js';
import { getExpertiseLimits } from './expertise.js';

const SIX = ['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Religion'];

const wizardExpertiseLimits = {
  allowed: true,
  count: 1,
  classCount: 1,
  featCount: 0,
  classExpertiseSkillLists: [SIX],
  featExpertiseSkillLists: null,
  details: 'Wizard can have expertise in 1 skill(s) at level 20',
};

function form(overrides) {
  return {
    rules: '2024',
    class: { name: 'Wizard' },
    level: 20,
    skillProficiencies: ['Arcana', 'History'],
    expertSkills: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getSkillLimits.mockResolvedValue({ allowed: 5, skillChoiceSources: [] });
  getExpertiseLimits.mockResolvedValue(wizardExpertiseLimits);
});

describe('validateSkills class expertise skill-list gate', () => {
  it('accepts a proficient skill from the six-skill list', async () => {
    const warnings = await validateSkills(form({ expertSkills: ['Arcana'] }), []);
    const listWarnings = warnings.filter(w => /Class expertise is limited to/.test(w.message));
    expect(listWarnings).toHaveLength(0);
  });

  it('warns when a non-list proficient skill consumes the class expertise slot', async () => {
    const warnings = await validateSkills(form({ skillProficiencies: ['Arcana', 'History', 'Perception'], expertSkills: ['Perception'] }), []);
    const listWarnings = warnings.filter(w => /Class expertise is limited to/.test(w.message));
    expect(listWarnings).toHaveLength(1);
    expect(listWarnings[0].message).toContain('Perception');
    expect(listWarnings[0].message).toContain('Arcana');
  });

  it('hard-warns when a non-list skill has no usable feat slot (feat slots are restricted)', async () => {
    getExpertiseLimits.mockResolvedValue({
      ...wizardExpertiseLimits,
      count: 2,
      featCount: 1,
      featExpertiseSkillLists: [['Acrobatics']],
    });
    const warnings = await validateSkills(form({ skillProficiencies: ['Arcana', 'History', 'Acrobatics', 'Perception'], expertSkills: ['Acrobatics', 'Perception'] }), []);
    const hardWarnings = warnings.filter(w => /Class expertise is limited to/.test(w.message));
    expect(hardWarnings).toHaveLength(1);
    expect(hardWarnings[0].message).toContain('Perception');
  });

  it('soft-warns when a non-list skill can fall back to a free unrestricted feat slot', async () => {
    getExpertiseLimits.mockResolvedValue({
      ...wizardExpertiseLimits,
      count: 3,
      featCount: 2,
      featExpertiseSkillLists: [['Acrobatics']],
    });
    const warnings = await validateSkills(form({ expertSkills: ['Arcana', 'Acrobatics', 'Perception'] }), []);
    const softWarnings = warnings.filter(w => /can only use a feat expertise slot/.test(w.message));
    expect(softWarnings).toHaveLength(1);
    expect(softWarnings[0].message).toContain('Perception');
  });

  it('keeps the count gate unchanged: two experts against one slot warns', async () => {
    const warnings = await validateSkills(form({ expertSkills: ['Arcana', 'History'] }), []);
    const countWarnings = warnings.filter(w => /only have 1 slot|expertise in 1 skill/.test(w.message));
    expect(countWarnings.length).toBeGreaterThan(0);
  });

  it('does not apply the class list gate when no classExpertiseSkillLists is provided', async () => {
    getExpertiseLimits.mockResolvedValue({ allowed: true, count: 2, classCount: 2, featCount: 0, classExpertiseSkillLists: null, details: 'Rogues get expertise in 2 skills.' });
    const warnings = await validateSkills(form({ skillProficiencies: ['Acrobatics', 'Stealth'], expertSkills: ['Acrobatics'] }), []);
    const listWarnings = warnings.filter(w => /Class expertise is limited to|feat expertise slot/.test(w.message));
    expect(listWarnings).toHaveLength(0);
  });

  it('still warns that expertise requires proficiency first', async () => {
    const warnings = await validateSkills(form({ expertSkills: ['Arcana'], skillProficiencies: ['History'] }), []);
    const profWarnings = warnings.filter(w => /Expertise requires proficiency first/.test(w.message));
    expect(profWarnings).toHaveLength(1);
  });
});
