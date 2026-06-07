import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

// Mock the dataLoader module
vi.mock('../ui/dataLoader.js', () => ({
    fetchClassData: vi.fn(),
    fetchRaceData: vi.fn(),
    fetchBackgroundData: vi.fn(),
}));

// Import after mocking
import { 
    getSkillLimits, 
    getPreSelectedSkills, 
    getExpertiseLimits,
    validateSkills,
    getSkillInfo
} from './skillValidation.js';

describe('skillValidation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getSkillLimits', () => {
        it('should return skill limits for 2024 ruleset', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                skill_proficiencies: 'Choose 2 from Arcana, History, Insight'
            });
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                skill_proficiencies: 'Insight'
            });
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
                skill_proficiencies: 'Deception and Persuasion'
            });

            const result = await getSkillLimits({
                rules: '2024',
                class: { name: 'Wizard' },
                race: { name: 'Human' },
                background: 'Charlatan'
            });

            expect(result.allowed).toBeGreaterThan(0);
            expect(result.fromClass.isChoice).toBe(true);
            expect(result.fromClass.count).toBe(2);
            expect(result.fromRace.skills).toContain('Insight');
            expect(result.fromBackground.skills).toContain('Deception');
            expect(result.fromBackground.skills).toContain('Persuasion');
        });

        it('should return skill limits for 5e ruleset', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                skill_proficiencies: 'Choose 2 from Arcana, History'
            });
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                skill_proficiencies: 'Insight'
            });

            const result = await getSkillLimits({
                rules: '5e',
                class: { name: 'Wizard' },
                race: { name: 'Human' },
                background: 'Acolyte'
            });

            expect(result.allowed).toBeGreaterThan(0);
            expect(result.fromClass.isChoice).toBe(true);
            expect(result.fromBackground.count).toBe(2);
        });

        it('should handle empty form data', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);

            const result = await getSkillLimits({});

            expect(result.allowed).toBe(2); // Default background count for 5e
        });

        it('should handle race with no skill proficiencies', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                skill_proficiencies: 'Choose 1 from Arcana'
            });
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

            const result = await getSkillLimits({
                rules: '2024',
                class: { name: 'Wizard' },
                race: { name: 'Human' }
            });

            expect(result.fromRace.count).toBe(0);
            expect(result.fromRace.skills).toEqual([]);
        });

        it('should parse "Choose X from..." format correctly', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                skill_proficiencies: 'Choose 3 from Arcana, History, Insight, Religion'
            });
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

            const result = await getSkillLimits({
                rules: '2024',
                class: { name: 'Cleric' },
                race: { name: 'Human' }
            });

            expect(result.fromClass.count).toBe(3);
            expect(result.fromClass.skills).toContain('Arcana');
            expect(result.fromClass.skills).toContain('History');
            expect(result.fromClass.skills).toContain('Insight');
            expect(result.fromClass.skills).toContain('Religion');
        });

        it('should handle race with "or" before last skill', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                skill_proficiencies: 'Insight, Perception, Survival'
                  });

            const result = await getSkillLimits({
                rules: '2024',
                class: { name: 'Wizard' },
                race: { name: 'Dwarf' }
            });

            expect(result.fromRace.skills).toContain('Insight');
            expect(result.fromRace.skills).toContain('Perception');
            expect(result.fromRace.skills).toContain('Survival');
         });
          });

    describe('getPreSelectedSkills', () => {
        it('should return pre-selected skills from race', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                skill_proficiencies: 'Insight and Perception'
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                skill_proficiencies: 'Choose 2 from Arcana, History'
            });

            const result = await getPreSelectedSkills({
                rules: '2024',
                class: { name: 'Wizard' },
                race: { name: 'Dwarf' }
            });

            expect(result).toContain('Insight');
            expect(result).toContain('Perception');
        });

        it('should return pre-selected skills from background in 2024', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
                skill_proficiencies: 'Deception and Persuasion'
            });

            const result = await getPreSelectedSkills({
                rules: '2024',
                class: { name: 'Wizard' },
                race: { name: 'Human' },
                background: 'Charlatan'
            });

            expect(result).toContain('Deception');
            expect(result).toContain('Persuasion');
        });

        it('should not pre-select skills for 5e backgrounds', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});

            const result = await getPreSelectedSkills({
                rules: '5e',
                class: { name: 'Wizard' },
                race: { name: 'Human' },
                background: 'Acolyte'
            });

            expect(result).toEqual([]);
        });

        it('should return empty array when no skills are pre-selected', async () => {
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                skill_proficiencies: 'Choose 1 from Insight, Perception'
            });
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                skill_proficiencies: 'Choose 2 from Arcana, History'
            });

            const result = await getPreSelectedSkills({
                rules: '2024',
                class: { name: 'Wizard' },
                race: { name: 'Human' }
            });

            expect(result).toEqual([]);
         });
          });

    describe('getExpertiseLimits', () => {
        it('should return expertise limits for a class with expertise feature', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                      { level: 1, features: [] },
                      { level: 2, features: [
                          { name: 'Expertise', feature_specific: { expertise: { count: 2 } } }
                      ]}
                  ]
                  });

            const result = await getExpertiseLimits({
                rules: '2024',
                class: { name: 'Rogue' },
                level: 2
            });

            expect(result.allowed).toBe(true);
            expect(result.count).toBe(2);
        });

        it('should return no expertise for class without expertise feature', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                      { level: 1, features: [] },
                      { level: 2, features: [{ name: 'Second Wind' }] }
                  ]
                  });

            const result = await getExpertiseLimits({
                rules: '2024',
                class: { name: 'Fighter' },
                level: 2
            });

            expect(result.allowed).toBe(false);
            expect(result.count).toBe(0);
        });

        it('should return no expertise when no class is selected', async () => {
            const result = await getExpertiseLimits({
                rules: '2024',
                level: 1
            });

            expect(result.allowed).toBe(false);
            expect(result.count).toBe(0);
        });

        it('should handle expertise in feature description', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                      { level: 1, features: [] },
                      { level: 2, features: [
                          { name: 'Expertise', desc: 'Choose 2 skills' }
                      ]}
                  ]
                  });

            const result = await getExpertiseLimits({
                rules: '2024',
                class: { name: 'Rogue' },
                level: 2
            });

            expect(result.allowed).toBe(true);
            expect(result.count).toBe(2);
        });

        it('should not count expertise if level is too low', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [
                      { level: 1, features: [] },
                      { level: 2, features: [
                          { name: 'Expertise', feature_specific: { expertise: { count: 2 } } }
                      ]}
                  ]
                  });

            const result = await getExpertiseLimits({
                rules: '2024',
                class: { name: 'Rogue' },
                level: 1
            });

            expect(result.allowed).toBe(false);
            expect(result.count).toBe(0);
        });

        it('should handle subclass expertise for 2024', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [{ level: 1, features: [] }],
                majors: [
                      {
                          name: 'Arcane Trickster',
                          features: [
                              { level: 3, name: 'Expertise', description: 'Choose 2 skills' }
                          ]
                      }
                  ]
                  });

            const result = await getExpertiseLimits({
                rules: '2024',
                class: { name: 'Rogue', subclass: { name: 'Arcane Trickster' } },
                level: 3
            });

            expect(result.allowed).toBe(true);
            expect(result.count).toBe(2);
        });

        it('should handle subclass expertise for 5e', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                class_levels: [{ level: 1, features: [] }],
                subclasses: [
                        {
                           name: 'Arcane Trickster',
                           class_levels: [
                                { level: 3, features: [
                                      { name: 'Expertise', description: 'Choose 2 skills' }
                                ]}
                            ]
                        }
                  ]
                  });

            const result = await getExpertiseLimits({
                rules: '5e',
                class: { name: 'Rogue', subclass: { name: 'Arcane Trickster' } },
                level: 3
            });

            expect(result.allowed).toBe(true);
            expect(result.count).toBe(2);
    });
         });

    describe('validateSkills', () => {
        it('should return warning when too many skills selected', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                skill_proficiencies: 'Choose 2 from Arcana, History'
            });
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

            const warnings = await validateSkills({
                rules: '2024',
                class: { name: 'Wizard' },
                race: { name: 'Human' },
                skillProficiencies: ['Arcana', 'History', 'Insight', 'Religion']
            });

            expect(warnings.length).toBeGreaterThan(0);
            expect(warnings[0].type).toBe('warning');
        });

        it('should return info when fewer skills selected than allowed', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                skill_proficiencies: 'Choose 2 from Arcana, History'
            });
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

            const warnings = await validateSkills({
                rules: '2024',
                class: { name: 'Wizard' },
                race: { name: 'Human' },
                skillProficiencies: ['Arcana']
            });

            expect(warnings.some(w => w.type === 'info')).toBe(true);
        });

        it('should warn when expertise selected but not allowed', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                skill_proficiencies: 'Choose 2 from Arcana, History',
                class_levels: [{ level: 1, features: [] }]
            });
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

            const warnings = await validateSkills({
                rules: '2024',
                class: { name: 'Fighter' },
                race: { name: 'Human' },
                skillProficiencies: ['Arcana'],
                expertSkills: ['Arcana']
            });

            expect(warnings.some(w => w.message.includes('Expertise is not available'))).toBe(true);
        });

        it('should warn when expert skills not in proficient list', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                skill_proficiencies: 'Choose 2 from Arcana, History',
                class_levels: [
                      { level: 2, features: [{ name: 'Expertise', feature_specific: { expertise: { count: 2 } } }] }
                  ]
                  });
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

            const warnings = await validateSkills({
                rules: '2024',
                class: { name: 'Rogue' },
                race: { name: 'Human' },
                level: 2,
                skillProficiencies: ['Arcana'],
                expertSkills: ['History']
            });

            expect(warnings.some(w => w.message.includes('Expertise requires proficiency'))).toBe(true);
        });

        it('should warn about duplicate skills', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                skill_proficiencies: 'Choose 2 from Arcana, History'
            });
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

            const warnings = await validateSkills({
                rules: '2024',
                class: { name: 'Wizard' },
                race: { name: 'Human' },
                skillProficiencies: ['Arcana', 'Arcana']
            });

            expect(warnings.some(w => w.message.includes('multiple times'))).toBe(true);
        });

        it('should return empty warnings when no skills selected', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

            const warnings = await validateSkills({
                rules: '2024',
                class: { name: 'Wizard' },
                race: { name: 'Human' },
                skillProficiencies: []
            });

            expect(warnings).toEqual([]);
    });
         });

    describe('getSkillInfo', () => {
        it('should identify skill source from class', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                skill_proficiencies: 'Choose 2 from Arcana, History'
            });
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

            const result = await getSkillInfo('Arcana', {
                rules: '2024',
                class: { name: 'Wizard' },
                race: { name: 'Human' }
            });

            expect(result.isAllowed).toBe(true);
            expect(result.source).toContain('Class');
        });

        it('should identify skill source from race', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
                skill_proficiencies: 'Insight'
            });

            const result = await getSkillInfo('Insight', {
                rules: '2024',
                class: { name: 'Wizard' },
                race: { name: 'Dwarf' }
            });

            expect(result.isAllowed).toBe(true);
            expect(result.isPreSelected).toBe(true);
        });

        it('should return isAllowed false when skill not in any source', async () => {
            vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
                skill_proficiencies: 'Arcana'
            });
            vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

            const result = await getSkillInfo('Stealth', {
                rules: '2024',
                class: { name: 'Wizard' },
                race: { name: 'Human' }
            });

            expect(result.isAllowed).toBe(false);
    });
         });
});

