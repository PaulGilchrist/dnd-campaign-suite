import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
  fetchBackgroundData: vi.fn(),
  fetchFeatData: vi.fn(),
  loadFeatData: vi.fn(),
  loadEquipment: vi.fn(async () => []),
}));

import {
  validateSkills,
  getSkillInfo,
} from './skillValidation.js';

describe('skillValidation — validateSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return warnings when too many skills selected', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History',
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
      skillProficiencies: ['Arcana', 'History', 'Insight', 'Religion'],
    });

    expect(warnings).toHaveLength(2);
    expect(warnings.some((w) => w.message.includes('Rules allow'))).toBe(true);
    expect(warnings.some((w) => w.message.includes('not available'))).toBe(true);
  });

  it('should return info when fewer skills selected than allowed', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History',
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
      skillProficiencies: ['Arcana'],
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('info');
    expect(warnings[0].message).toContain('up to');
  });

  it('should return no warnings when exactly the right number of skills selected', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History',
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
      skillProficiencies: ['Arcana', 'History'],
    });

    expect(warnings).toEqual([]);
  });

  it('should warn when expertise selected but not allowed for class', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History',
      class_levels: [{ level: 1, features: [] }],
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Fighter' },
      race: { name: 'Human' },
      skillProficiencies: ['Arcana'],
      expertSkills: ['Arcana'],
    });

    expect(warnings.some((w) => w.message.includes('Expertise is not available'))).toBe(
      true,
    );
  });

  it('should warn when expert skills not in proficient list', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History',
      class_levels: [
        {
          level: 2,
          features: [
            { name: 'Expertise', feature_specific: { expertise: { count: 2 } } },
          ],
        },
      ],
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Rogue' },
      race: { name: 'Human' },
      level: 2,
      skillProficiencies: ['Arcana'],
      expertSkills: ['History'],
    });

    expect(
      warnings.some((w) => w.message.includes('Expertise requires proficiency')),
    ).toBe(true);
  });

  it('should warn about duplicate skills in selection', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History',
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
      skillProficiencies: ['Arcana', 'Arcana'],
    });

    expect(warnings.some((w) => w.message.includes('multiple times'))).toBe(true);
  });

  it('should return empty warnings when no skills selected', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
      skillProficiencies: [],
    });

    expect(warnings).toEqual([]);
  });

  it('should warn when too many expertise slots selected', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History',
      class_levels: [
        {
          level: 2,
          features: [
            { name: 'Expertise', feature_specific: { expertise: { count: 1 } } },
          ],
        },
      ],
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Rogue' },
      race: { name: 'Human' },
      level: 2,
      skillProficiencies: ['Arcana', 'History'],
      expertSkills: ['Arcana', 'History'],
    });

    expect(
      warnings.some((w) => w.message.includes('expertise in 1 skill')),
    ).toBe(true);
  });

  it('should combine multiple warning types', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History',
      class_levels: [{ level: 1, features: [] }],
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Fighter' },
      race: { name: 'Human' },
      skillProficiencies: ['Arcana', 'History', 'Insight'],
      expertSkills: ['Arcana'],
    });

    expect(warnings.some((w) => w.message.includes('Rules allow'))).toBe(true);
    expect(warnings.some((w) => w.message.includes('Expertise is not available'))).toBe(
      true,
    );
  });

  it('should handle missing skillProficiencies and expertSkills gracefully', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

    const warnings = await validateSkills({
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
    });

    expect(warnings).toEqual([]);
  });

  it('should use default class name when class is missing in expertise warning', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

    const warnings = await validateSkills({
      rules: '2024',
      skillProficiencies: ['Arcana'],
      expertSkills: ['Arcana'],
    });

    expect(
      warnings.some((w) => w.message.includes('this class')),
    ).toBe(true);
  });
});

describe('skillValidation — getSkillInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should identify skill source from class', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History',
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

    const result = await getSkillInfo('Arcana', {
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
    });

    expect(result.isAllowed).toBe(true);
    expect(result.source).toContain('Class');
  });

  it('should identify skill source from race and mark as pre-selected', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
      skill_proficiencies: 'Insight',
    });

    const result = await getSkillInfo('Insight', {
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Dwarf' },
    });

    expect(result.isAllowed).toBe(true);
    expect(result.isPreSelected).toBe(true);
    expect(result.source).toContain('Race');
  });

  it('should return isAllowed false when skill not in any source', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Arcana',
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

    const result = await getSkillInfo('Stealth', {
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
    });

    expect(result.isAllowed).toBe(false);
    expect(result.source).toBe('');
    expect(result.isPreSelected).toBe(false);
  });

  it('should identify skill from background in 2024', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
      skill_proficiencies: 'Deception and Persuasion',
    });

    const result = await getSkillInfo('Deception', {
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
      background: 'Charlatan',
    });

    expect(result.isAllowed).toBe(true);
    expect(result.source).toContain('Background');
    expect(result.isPreSelected).toBe(true);
  });

  it('should not check background for 5e ruleset', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
      skill_proficiencies: 'Deception',
    });

    const result = await getSkillInfo('Deception', {
      rules: '5e',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
      background: 'Charlatan',
    });

    expect(result.isAllowed).toBe(false);
  });

  it('should list multiple sources when skill comes from class and race', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Insight',
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
      skill_proficiencies: 'Insight',
    });

    const result = await getSkillInfo('Insight', {
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
    });

    expect(result.isAllowed).toBe(true);
    expect(result.source).toBe('Class, Race');
  });

  it('should mark as not pre-selected when skill is from a choice source', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      skill_proficiencies: 'Choose 2 from Arcana, History',
    });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

    const result = await getSkillInfo('Arcana', {
      rules: '2024',
      class: { name: 'Wizard' },
      race: { name: 'Human' },
    });

    expect(result.isAllowed).toBe(true);
    expect(result.isPreSelected).toBe(false);
  });
});
