import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getExpertiseLimits, parseClassExpertiseSkillList } from './expertise.js';

vi.mock('../../ui/dataLoader.js', () => ({
  fetchClassData: vi.fn(),
  loadFeatData: vi.fn(),
}));

import { fetchClassData, loadFeatData } from '../../ui/dataLoader.js';

const SCHOLAR_DESCRIPTION = 'By studying magic, you also specialized in another field of study. Choose one of the following skills in which you have proficiency: Arcana, History, Investigation, Medicine, Nature, or Religion. You have Expertise in the chosen skill.';

const wizardData = {
  class_levels: [
    { level: 1, features: [] },
    { level: 2, features: [{ name: 'Scholar', description: SCHOLAR_DESCRIPTION, level: 2, type: 'class_feature' }] },
  ],
  majors: [],
};

const bardData = {
  class_levels: [
    { level: 2, features: [{ name: 'Expertise', description: 'You gain Expertise in two of your skill proficiencies of your choice.', level: 2 }] },
  ],
};

const wizardForm = { rules: '2024', class: { name: 'Wizard' }, level: 20 };
const bardForm = { rules: '2024', class: { name: 'Bard' }, level: 20 };

beforeEach(() => {
  vi.clearAllMocks();
  loadFeatData.mockResolvedValue([]);
});

describe('parseClassExpertiseSkillList', () => {
  it('parses the six Scholar skills from the Wizard class feature description', () => {
    const list = parseClassExpertiseSkillList({ name: 'Scholar', description: SCHOLAR_DESCRIPTION });
    expect(list).toEqual(['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Religion']);
  });

  it('returns null for unrestricted expertise features (Bard Expertise)', () => {
    const list = parseClassExpertiseSkillList({ name: 'Expertise', description: 'You gain Expertise in two of your skill proficiencies of your choice.' });
    expect(list).toBeNull();
  });

  it('returns null when description does not mention expertise', () => {
    expect(parseClassExpertiseSkillList({ name: 'Extra Attack', description: 'You can attack twice.' })).toBeNull();
  });

  it('prefers explicit feature_specific.expertise.skills when present', () => {
    const list = parseClassExpertiseSkillList({
      name: 'Scholar',
      description: SCHOLAR_DESCRIPTION,
      feature_specific: { expertise: { count: 1, skills: ['Arcana', 'History'] } },
    });
    expect(list).toEqual(['Arcana', 'History']);
  });
});

describe('getExpertiseLimits classExpertiseSkillLists', () => {
  it('returns the six-skill Scholar list and unchanged count for 2024 Wizard', async () => {
    fetchClassData.mockResolvedValue(wizardData);
    const limits = await getExpertiseLimits(wizardForm, []);
    expect(limits.classCount).toBe(1);
    expect(limits.count).toBe(1);
    expect(limits.classExpertiseSkillLists).toEqual([['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Religion']]);
    expect(limits.details).toContain('Class expertise is limited to: Arcana, History, Investigation, Medicine, Nature, Religion');
  });

  it('returns null classExpertiseSkillLists for unrestricted expertise classes (Bard)', async () => {
    fetchClassData.mockResolvedValue(bardData);
    const limits = await getExpertiseLimits(bardForm, []);
    expect(limits.classCount).toBe(2);
    expect(limits.classExpertiseSkillLists).toBeNull();
  });

  it('returns null classExpertiseSkillLists when no class selected', async () => {
    const limits = await getExpertiseLimits({ rules: '2024', level: 1 }, []);
    expect(limits.classExpertiseSkillLists).toBeNull();
  });

  it('returns null classExpertiseSkillLists when class data is missing', async () => {
    fetchClassData.mockResolvedValue(null);
    const limits = await getExpertiseLimits({ rules: '2024', class: { name: 'Wizard' }, level: 20 }, []);
    expect(limits.classExpertiseSkillLists).toBeNull();
  });

  it('disables the class list gate when a class has both restricted and unrestricted expertise sources', async () => {
    fetchClassData.mockResolvedValue({
      class_levels: [
        { level: 2, features: [{ name: 'Scholar', description: SCHOLAR_DESCRIPTION }] },
        { level: 10, features: [{ name: 'Expertise', description: 'You gain Expertise in two of your skill proficiencies of your choice.' }] },
      ],
    });
    const limits = await getExpertiseLimits(wizardForm, []);
    expect(limits.classCount).toBe(3);
    expect(limits.classExpertiseSkillLists).toBeNull();
  });

  it('collects restricted lists from 2024 majors subclass features', async () => {
    fetchClassData.mockResolvedValue({
      class_levels: [{ level: 1, features: [] }],
      majors: [{ name: 'Order of Scribes', features: [{ level: 6, name: 'Restricted Expertise', description: 'Choose one of the following skills in which you have proficiency: Arcana, History, or Religion. You gain Expertise in that skill.' }] }],
    });
    const limits = await getExpertiseLimits({ rules: '2024', class: { name: 'Wizard', subclass: { name: 'Order of Scribes' } }, level: 20 }, []);
    expect(limits.classExpertiseSkillLists).toEqual([['Arcana', 'History', 'Religion']]);
  });
});
