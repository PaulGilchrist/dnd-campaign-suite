const { mockLoadValidationRules, mockLoadAbilityScores } = vi.hoisted(() => ({
  mockLoadValidationRules: vi.fn(),
  mockLoadAbilityScores: vi.fn()
}));

vi.mock('../services/data-loader.js', () => ({
  loadValidationRules: mockLoadValidationRules,
  loadAbilityScores: mockLoadAbilityScores
}));

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockValidationRules = {
    level_range: { min: 1, max: 20 },
    point_buy: {
        total_points: 27,
        min_base_score: 8,
        max_base_score: 15,
        max_total_score: 20,
        max_total_score_level_20: 24,
        costs: { "8": 0, "9": 1, "10": 2, "11": 3, "12": 4, "13": 5, "14": 7, "15": 9 }
    },
    feats: {
        available_levels: [4, 8, 12, 16, 19],
        origin_feat_required: false,
        origin_feat_level: 1
    },
    background_languages: 2,
    ability_score_max: { standard: 20, level_20: 24 }
};

// Helper to dynamically import utils to reset module cache
async function importUtils() {
    const utils = await import('./utils.js');
    return utils;
}

describe('character-creation/utils', () => {
    describe('calculateTotalScore', () => {
        let utils;
        beforeEach(async () => {
            vi.resetModules();
            utils = await importUtils();
          });

        it('should calculate total score correctly', () => {
            const ability = {
                baseScore: '10',
                abilityImprovements: '2',
                miscBonus: '1'
                };

            const result = utils.calculateTotalScore(ability);

            expect(result).toBe(13);
           });

        it('should handle string values', () => {
            const ability = {
                baseScore: '15',
                abilityImprovements: '5',
                miscBonus: '0'
                };

            const result = utils.calculateTotalScore(ability);

            expect(result).toBe(20);
           });

        it('should default to 8 for missing baseScore', () => {
            const ability = {
                abilityImprovements: '2',
                miscBonus: '1'
                };

            const result = utils.calculateTotalScore(ability);

            expect(result).toBe(11);
           });

        it('should default to 0 for missing abilityImprovements', () => {
            const ability = {
                baseScore: '10',
                miscBonus: '1'
                };

            const result = utils.calculateTotalScore(ability);

            expect(result).toBe(11);
           });

        it('should default to 0 for missing miscBonus', () => {
            const ability = {
                baseScore: '10',
                abilityImprovements: '2'
                };

            const result = utils.calculateTotalScore(ability);

            expect(result).toBe(12);
           });

        it('should handle empty object', () => {
            const result = utils.calculateTotalScore({});

            expect(result).toBe(8);
           });

        it('should handle negative values', () => {
            const ability = {
                baseScore: '10',
                abilityImprovements: '-1',
                miscBonus: '-1'
                };

            const result = utils.calculateTotalScore(ability);

            expect(result).toBe(8);
           });

        it('should handle invalid values', () => {
            const ability = {
                baseScore: 'invalid',
                abilityImprovements: 'invalid',
                miscBonus: 'invalid'
                };

            const result = utils.calculateTotalScore(ability);

            expect(result).toBe(8);
          });
           });

    describe('validateFinalFormData', () => {
        let utils;
        beforeEach(async () => {
            vi.resetModules();
            utils = await importUtils();
          });

        it('should return no errors for valid form data', () => {
            const formData = {
                name: 'Test Character',
                level: 1,
                alignment: 'Lawful Good',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                expertSkills: []
                 };

            const result = utils.validateFinalFormData(formData);

            expect(result).toEqual({});
           });

        it('should not validate abilities, inventory, or skillProficiencies', () => {
            const formData = {
                name: 'Test Character',
                level: 1,
                alignment: 'Lawful Good',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                abilities: [],
                inventory: [],
                skillProficiencies: [],
                expertSkills: []
                 };

            const result = utils.validateFinalFormData(formData);

            expect(result).toEqual({});
           });

        it('should return error for missing name', () => {
            const formData = {
                level: 1,
                alignment: 'Lawful Good',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                expertSkills: []
                 };

            const result = utils.validateFinalFormData(formData);

            expect(result.name).toBe('name is required');
           });

        it('should return error for empty name', () => {
            const formData = {
                name: '      ',
                level: 1,
                alignment: 'Lawful Good',
                race: { name: 'Human' },
                class: { name: 'Wizard' },
                expertSkills: []
                 };

            const result = utils.validateFinalFormData(formData);

            expect(result.name).toBe('name is required');
           });

        it('should return multiple errors for multiple missing fields', () => {
            const formData = {};

            const result = utils.validateFinalFormData(formData);

            expect(Object.keys(result).length).toBeGreaterThan(0);
          });
           });

    describe('validateLevel', () => {
        let utils;
        beforeEach(async () => {
            vi.resetModules();
            mockLoadValidationRules.mockResolvedValue(mockValidationRules);
            utils = await importUtils();
          });

        it('should return no errors for a valid level', async () => {
            const result = await utils.validateLevel(10, '5e');
            expect(result).toEqual({});
        });

        it('should return error for level below minimum', async () => {
            const result = await utils.validateLevel(0, '5e');
            expect(result.level).toBe('Level must be between 1 and 20');
        });

        it('should return error for level above maximum', async () => {
            const result = await utils.validateLevel(21, '5e');
            expect(result.level).toBe('Level must be between 1 and 20');
        });

        it('should return error for undefined level', async () => {
            const result = await utils.validateLevel(undefined, '5e');
            expect(result.level).toBe('Level must be between 1 and 20');
        });

        it('should return error for null level', async () => {
            const result = await utils.validateLevel(null, '5e');
            expect(result.level).toBe('Level must be between 1 and 20');
     });
      });

    describe('validateAbility', () => {
        let utils;
        beforeEach(async () => {
            vi.resetModules();
            mockLoadValidationRules.mockResolvedValue(mockValidationRules);
            utils = await importUtils();
          });

        it('should return no errors for a valid ability', async () => {
            const ability = {
                baseScore: 10,
                abilityImprovements: 0,
                miscBonus: 0
              };
            const result = await utils.validateAbility(ability, 0, '5e', 1);
            expect(result).toEqual({});
        });

        it('should return error when baseScore is below minimum', async () => {
            const ability = {
                baseScore: 7,
                abilityImprovements: 0,
                miscBonus: 0
              };
            const result = await utils.validateAbility(ability, 0, '5e', 1);
            expect(result.baseScore).toBe('Base score must be at least 8');
        });

        it('should return error when baseScore exceeds maximum', async () => {
            const ability = {
                baseScore: 16,
                abilityImprovements: 0,
                miscBonus: 0
              };
            const result = await utils.validateAbility(ability, 0, '5e', 1);
            expect(result.baseScore).toBe('Base score cannot exceed 15 (point buy max)');
        });

        it('should return error when totalScore exceeds maximum', async () => {
            const ability = {
                baseScore: 15,
                abilityImprovements: 6,
                miscBonus: 0
              };
            const result = await utils.validateAbility(ability, 0, '5e', 1);
            expect(result.totalScore).toBe('Total score (base + improvements + misc) cannot exceed 20');
        });

        it('should allow higher totalScore max at level 20', async () => {
            const ability = {
                baseScore: 15,
                abilityImprovements: 5,
                miscBonus: 0
              };
            const result = await utils.validateAbility(ability, 0, '5e', 20);
            expect(result.totalScore).toBeUndefined();
        });

        it('should return error for negative abilityImprovements', async () => {
            const ability = {
                baseScore: 10,
                abilityImprovements: -1,
                miscBonus: 0
              };
            const result = await utils.validateAbility(ability, 0, '5e', 1);
            expect(result.abilityImprovements).toBe('Improvements must be 0 or above');
        });

        it('should return error for negative miscBonus', async () => {
            const ability = {
                baseScore: 10,
                abilityImprovements: 0,
                miscBonus: -1
              };
            const result = await utils.validateAbility(ability, 0, '5e', 1);
            expect(result.miscBonus).toBe('Misc bonus must be 0 or above');
     });
      });

    describe('calculatePointBuyCost', () => {
        let utils;
        beforeEach(async () => {
            vi.resetModules();
            mockLoadValidationRules.mockResolvedValue(mockValidationRules);
            utils = await importUtils();
          });

        it('should return the correct cost for a given base score', async () => {
            const cost = await utils.calculatePointBuyCost(10, '5e');
            expect(cost).toBe(2);
        });

        it('should return 0 for score 8 (baseline)', async () => {
            const cost = await utils.calculatePointBuyCost(8, '5e');
            expect(cost).toBe(0);
        });

        it('should return 9 for score 15 (max point buy)', async () => {
            const cost = await utils.calculatePointBuyCost(15, '5e');
            expect(cost).toBe(9);
        });

        it('should default to score 8 when given invalid input', async () => {
            const cost = await utils.calculatePointBuyCost(NaN, '5e');
            expect(cost).toBe(0);
     });
      });

    describe('getPointBuyCosts', () => {
        let utils;
        beforeEach(async () => {
            vi.resetModules();
            mockLoadValidationRules.mockResolvedValue(mockValidationRules);
            utils = await importUtils();
          });

        it('should return point buy costs object', async () => {
            const costs = await utils.getPointBuyCosts('5e');
            expect(costs).toEqual(mockValidationRules.point_buy.costs);
        });

        it('should return empty object when point_buy is missing', async () => {
            vi.resetModules();
            mockLoadValidationRules.mockResolvedValue({ level_range: { min: 1, max: 20 } });
            utils = await importUtils();
            const costs = await utils.getPointBuyCosts('5e');
            expect(costs).toEqual({});
       });
       });

    describe('getFeatRules', () => {
        let utils;
        beforeEach(async () => {
            vi.resetModules();
            mockLoadValidationRules.mockResolvedValue(mockValidationRules);
            utils = await importUtils();
          });

        it('should return feat rules object', async () => {
            const rules = await utils.getFeatRules('5e');
            expect(rules).toEqual(mockValidationRules.feats);
        });

        it('should return empty object when feats is missing', async () => {
            vi.resetModules();
            mockLoadValidationRules.mockResolvedValue({ level_range: { min: 1, max: 20 } });
            utils = await importUtils();
            const rules = await utils.getFeatRules('5e');
            expect(rules).toEqual({});
       });
       });

    describe('getBackgroundLanguageCount', () => {
        let utils;
        beforeEach(async () => {
            vi.resetModules();
            mockLoadValidationRules.mockResolvedValue(mockValidationRules);
            utils = await importUtils();
          });

        it('should return background language count', async () => {
            const count = await utils.getBackgroundLanguageCount('5e');
            expect(count).toBe(2);
        });

        it('should return default value of 2 when background_languages is missing', async () => {
            vi.resetModules();
            mockLoadValidationRules.mockResolvedValue({});
            utils = await importUtils();
            const count = await utils.getBackgroundLanguageCount('5e');
            expect(count).toBe(2);
       });
       });

    describe('getSkillsFromAbilityScores', () => {
        let utils;
        beforeEach(async () => {
            vi.resetModules();
            utils = await importUtils();
          });

        it('should return unique skills from ability scores', async () => {
            mockLoadAbilityScores.mockResolvedValue([
                      { full_name: 'Strength', skills: ['Athletics'] },
                      { full_name: 'Dexterity', skills: ['Acrobatics', 'Sleight of Hand', 'Stealth'] },
                      { full_name: 'Intelligence', skills: ['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Religion'] }
                  ]);
            const skills = await utils.getSkillsFromAbilityScores('5e');
            expect(skills).toContain('Athletics');
            expect(skills).toContain('Acrobatics');
            expect(skills).toContain('Arcana');
            expect(skills.length).toBeGreaterThan(0);
        });

        it('should return fallback skills when loadAbilityScores fails', async () => {
            mockLoadAbilityScores.mockRejectedValue(new Error('Network error'));
            console.error = vi.fn();

            const skills = await utils.getSkillsFromAbilityScores('5e');
            expect(skills).toContain('Acrobatics');
            expect(skills).toContain('Athletics');
            expect(skills).toContain('Perception');
      });
       });

    describe('getAbilityNamesFromJson', () => {
        let utils;
        beforeEach(async () => {
            vi.resetModules();
            utils = await importUtils();
          });

        it('should return ability names from JSON', async () => {
            mockLoadAbilityScores.mockResolvedValue([
                      { full_name: 'Strength' },
                      { full_name: 'Dexterity' },
                      { full_name: 'Constitution' },
                      { full_name: 'Intelligence' },
                      { full_name: 'Wisdom' },
                      { full_name: 'Charisma' }
                  ]);
            const names = await utils.getAbilityNamesFromJson();
            expect(names).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']);
        });

        it('should return fallback names when loadAbilityScores fails', async () => {
            mockLoadAbilityScores.mockRejectedValue(new Error('Network error'));
            console.error = vi.fn();

            const names = await utils.getAbilityNamesFromJson();
            expect(names).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']);
      });
       });

    describe('validateStep', () => {
        let utils;
        beforeEach(async () => {
            vi.resetModules();
            mockLoadValidationRules.mockResolvedValue(mockValidationRules);
            utils = await importUtils();
          });

        describe('Step 2: Basic Information', () => {
            it('should return errors when name is missing', async () => {
                const formData = { level: 1, alignment: 'Good' };
                const errors = await utils.validateStep(2, formData, {}, [], [], '5e');
                expect(errors.name).toBe('Character name is required');
            });

            it('should return errors when alignment is missing', async () => {
                const formData = { name: 'Test', level: 1 };
                const errors = await utils.validateStep(2, formData, {}, [], [], '5e');
                expect(errors.alignment).toBe('Alignment is required');
            });

            it('should return no errors when all required fields are present for 5e', async () => {
                const formData = { name: 'Test', level: 1, alignment: 'Good' };
                const errors = await utils.validateStep(2, formData, {}, [], [], '5e');
                expect(errors.name).toBeUndefined();
                expect(errors.alignment).toBeUndefined();
                expect(errors.background).toBeUndefined();
            });

            it('should require background for 2024 ruleset', async () => {
                const formData = { name: 'Test', level: 1, alignment: 'Good' };
                const errors = await utils.validateStep(2, formData, {}, [], [], '2024');
                expect(errors.background).toBe('Background is required');
         });
          });

        describe('Step 3: Race & Class', () => {
            it('should return errors when race is missing', async () => {
                const formData = { class: { name: 'Fighter' } };
                const errors = await utils.validateStep(3, formData, {}, [], [], '5e');
                expect(errors.race).toBe('Race is required');
            });

            it('should return errors when class is missing', async () => {
                const formData = { race: { name: 'Human' } };
                const errors = await utils.validateStep(3, formData, {}, [], [], '5e');
                expect(errors.class).toBe('Class is required');
            });

            it('should require subrace when race has subraces', async () => {
                const racesData = [{ name: 'Elf', subraces: [{ name: 'High Elf' }, { name: 'Wood Elf' }] }];
                const formData = { race: { name: 'Elf' }, class: { name: 'Fighter' } };
                const errors = await utils.validateStep(3, formData, {}, racesData, [], '5e');
                expect(errors.subrace).toBe('Subrace is required');
            });

            it('should not require subrace when race has no subraces', async () => {
                const racesData = [{ name: 'Human', subraces: [] }];
                const formData = { race: { name: 'Human' }, class: { name: 'Fighter' } };
                const errors = await utils.validateStep(3, formData, {}, racesData, [], '5e');
                expect(errors.subrace).toBeUndefined();
            });

            it('should require subclass when class has subclasses', async () => {
                const classSubtypes = [{ className: 'Fighter', subtypes: [{ name: 'Champion' }] }];
                const formData = { race: { name: 'Human' }, class: { name: 'Fighter' } };
                const errors = await utils.validateStep(3, formData, {}, [], classSubtypes, '5e');
                expect(errors.subclass).toBe('Subclass is required');
            });

            it('should not require subclass when class has no subclasses', async () => {
                const classSubtypes = [{ className: 'Fighter', subtypes: [] }];
                const formData = { race: { name: 'Human' }, class: { name: 'Fighter' } };
                const errors = await utils.validateStep(3, formData, {}, [], classSubtypes, '5e');
                expect(errors.subclass).toBeUndefined();
     });
          });
       });
});
