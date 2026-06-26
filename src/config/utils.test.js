// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dataLoader from '../services/ui/dataLoader.js';

const mockValidationRules = {
  level_range: { min: 1, max: 20 },
  point_buy: {
    total_points: 27,
    min_base_score: 8,
    max_base_score: 15,
    max_total_score: 20,
    max_total_score_level_20: 24,
    costs: { '8': 0, '9': 1, '10': 2, '11': 3, '12': 4, '13': 5, '14': 7, '15': 9 }
  },
  feats: {
    available_levels: [4, 8, 12, 16, 19],
    origin_feat_required: false,
    origin_feat_level: 1
  },
  background_languages: 2,
  ability_score_max: { standard: 20, level_20: 24 }
};

const mockAbilityScoresData = [
  { full_name: 'Strength', skills: ['Athletics'] },
  { full_name: 'Dexterity', skills: ['Acrobatics', 'Sleight of Hand', 'Stealth'] },
  { full_name: 'Constitution', skills: [] },
  { full_name: 'Intelligence', skills: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'] },
  { full_name: 'Wisdom', skills: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'] },
  { full_name: 'Charisma', skills: ['Deception', 'Intimidation', 'Performance', 'Persuasion'] }
];

describe('character-creation/utils', () => {
  describe('calculateTotalScore', () => {
    // No beforeEach needed — calculateTotalScore is synchronous and pure,
    // so we import once and reuse across all tests.
    let utils;
    beforeEach(async () => {
      utils = await import('./utils.js');
    });

    it('sums baseScore, featIncrease, backgroundIncrease, and miscIncrease', () => {
      const ability = { baseScore: '10', featIncrease: '2', miscIncrease: '1', backgroundIncrease: '0' };
      expect(utils.calculateTotalScore(ability)).toBe(13);
    });

    it('defaults missing baseScore to 8', () => {
      const ability = { featIncrease: '2', miscIncrease: '1', backgroundIncrease: '0' };
      expect(utils.calculateTotalScore(ability)).toBe(11);
    });

    it('defaults each numeric field individually when absent', () => {
      expect(utils.calculateTotalScore({ baseScore: '10', miscIncrease: '1', backgroundIncrease: '0' })).toBe(11);
      expect(utils.calculateTotalScore({ baseScore: '10', featIncrease: '2', backgroundIncrease: '0' })).toBe(12);
      expect(utils.calculateTotalScore({ baseScore: '10', featIncrease: '2', miscIncrease: '1' })).toBe(13);
    });

    it('defaults to 8 when given an empty object', () => {
      expect(utils.calculateTotalScore({})).toBe(8);
    });

    it('treats invalid numeric strings as 0, falling back to 8 for missing baseScore', () => {
      const ability = { baseScore: 'invalid', featIncrease: 'invalid', miscIncrease: 'invalid', backgroundIncrease: 'invalid' };
      expect(utils.calculateTotalScore(ability)).toBe(8);
    });

    it('allows negative increases to reduce the total', () => {
      const ability = { baseScore: '10', featIncrease: '-1', miscIncrease: '-1', backgroundIncrease: '0' };
      expect(utils.calculateTotalScore(ability)).toBe(8);
    });

    it('handles maximum valid scores', () => {
      const ability = { baseScore: '15', featIncrease: '5', miscIncrease: '0', backgroundIncrease: '0' };
      expect(utils.calculateTotalScore(ability)).toBe(20);
    });
  });

  describe('validateFinalFormData', () => {
    let utils;
    beforeEach(async () => {
      utils = await import('./utils.js');
    });

    it('returns no errors when all required fields are present', () => {
      const formData = {
        name: 'Test Character',
        level: 1,
        alignment: 'Lawful Good',
        race: { name: 'Human' },
        class: { name: 'Wizard' },
        expertSkills: []
      };
      expect(utils.validateFinalFormData(formData)).toEqual({});
    });

    it('skips validation for abilities, inventory, and skillProficiencies', () => {
      const formData = {
        name: 'Test',
        level: 1,
        alignment: 'Lawful Good',
        race: { name: 'Human' },
        class: { name: 'Wizard' },
        abilities: [],
        inventory: [],
        skillProficiencies: [],
        expertSkills: []
      };
      expect(utils.validateFinalFormData(formData)).toEqual({});
    });

    it('returns an error when name is absent', () => {
      const formData = {
        level: 1,
        alignment: 'Lawful Good',
        race: { name: 'Human' },
        class: { name: 'Wizard' },
        expertSkills: []
      };
      const errors = utils.validateFinalFormData(formData);
      expect(errors).toHaveProperty('name', 'name is required');
    });

    it('returns an error when name is blank/whitespace-only', () => {
      const formData = {
        name: '      ',
        level: 1,
        alignment: 'Lawful Good',
        race: { name: 'Human' },
        class: { name: 'Wizard' },
        expertSkills: []
      };
      const errors = utils.validateFinalFormData(formData);
      expect(errors).toHaveProperty('name', 'name is required');
    });

    it('returns errors for every missing required field', () => {
      const errors = utils.validateFinalFormData({});
      const expectedFields = ['name', 'level', 'alignment', 'race', 'class', 'expertSkills'];
      for (const field of expectedFields) {
        expect(errors).toHaveProperty(field);
      }
    });

    it('returns no errors when only abilities, inventory, and skillProficiencies are missing', () => {
      const formData = {
        name: 'Test',
        level: 1,
        alignment: 'Lawful Good',
        race: { name: 'Human' },
        class: { name: 'Wizard' },
        expertSkills: []
      };
      const errors = utils.validateFinalFormData(formData);
      expect(errors).not.toHaveProperty('abilities');
      expect(errors).not.toHaveProperty('inventory');
      expect(errors).not.toHaveProperty('skillProficiencies');
    });
  });

  describe('validateLevel', () => {
    let utils;
    beforeEach(async () => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(mockValidationRules);
      utils = await import('./utils.js');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns no errors for a valid level within range', async () => {
      expect(await utils.validateLevel(10, '5e')).toEqual({});
    });

    it('returns no errors for boundary values (1 and 20)', async () => {
      expect(await utils.validateLevel(1, '5e')).toEqual({});
      expect(await utils.validateLevel(20, '5e')).toEqual({});
    });

    it('returns an error when level is below the minimum', async () => {
      const errors = await utils.validateLevel(0, '5e');
      expect(errors).toHaveProperty('level', 'Level must be between 1 and 20');
    });

    it('returns an error when level is above the maximum', async () => {
      const errors = await utils.validateLevel(21, '5e');
      expect(errors).toHaveProperty('level', 'Level must be between 1 and 20');
    });

    it('returns an error for falsy level values', async () => {
      expect((await utils.validateLevel(undefined, '5e')).level).toBe('Level must be between 1 and 20');
      expect((await utils.validateLevel(null, '5e')).level).toBe('Level must be between 1 and 20');
      expect((await utils.validateLevel(0, '5e')).level).toBe('Level must be between 1 and 20');
      expect((await utils.validateLevel('', '5e')).level).toBe('Level must be between 1 and 20');
    });

    it('uses level_range defaults when rules lack level_range', async () => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue({});
      const freshUtils = await import('./utils.js');
      expect((await freshUtils.validateLevel(0, '5e')).level).toBe('Level must be between 1 and 20');
    });
  });

  describe('validateAbility', () => {
    let utils;
    beforeEach(async () => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(mockValidationRules);
      utils = await import('./utils.js');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns no errors for a valid ability at default level', async () => {
      const ability = { baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 };
      expect(await utils.validateAbility(ability, 0, '5e', 1)).toEqual({});
    });

    it('returns no errors for boundary base scores (8 and 15)', async () => {
      expect((await utils.validateAbility({ baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }, 0, '5e', 1)).baseScore).toBeUndefined();
      expect((await utils.validateAbility({ baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }, 0, '5e', 1)).baseScore).toBeUndefined();
    });

    it('returns an error when baseScore is below the minimum', async () => {
      const errors = await utils.validateAbility({ baseScore: 7, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }, 0, '5e', 1);
      expect(errors).toHaveProperty('baseScore', 'Base score must be at least 8');
    });

    it('returns an error when baseScore exceeds the maximum', async () => {
      const errors = await utils.validateAbility({ baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }, 0, '5e', 1);
      expect(errors).toHaveProperty('baseScore', 'Base score cannot exceed 15 (point buy max)');
    });

    it('returns an error when totalScore exceeds the level-1 maximum of 20', async () => {
      const errors = await utils.validateAbility({ baseScore: 15, featIncrease: 6, miscIncrease: 0, backgroundIncrease: 0 }, 0, '5e', 1);
      expect(errors).toHaveProperty('totalScore', 'Total score (base + improvements + misc) cannot exceed 20');
    });

    it('allows a higher totalScore max at level 20', async () => {
      const errors = await utils.validateAbility({ baseScore: 15, featIncrease: 5, miscIncrease: 0, backgroundIncrease: 0 }, 0, '5e', 20);
      expect(errors).not.toHaveProperty('totalScore');
    });

    it('does not validate featIncrease (source does not check it)', async () => {
      const errors = await utils.validateAbility({ baseScore: 10, featIncrease: -1, miscIncrease: 0, backgroundIncrease: 0 }, 0, '5e', 1);
      expect(errors).not.toHaveProperty('featIncrease');
    });

    it('returns an error for negative miscIncrease', async () => {
      const errors = await utils.validateAbility({ baseScore: 10, featIncrease: 0, miscIncrease: -1, backgroundIncrease: 0 }, 0, '5e', 1);
      expect(errors).toHaveProperty('miscIncrease', 'Misc bonus must be 0 or above');
    });

    it('does not error when miscIncrease is exactly 0', async () => {
      const errors = await utils.validateAbility({ baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }, 0, '5e', 1);
      expect(errors).not.toHaveProperty('miscIncrease');
    });

    it('prioritizes the above-minimum error over the below-maximum error when both apply', async () => {
      const errors = await utils.validateAbility({ baseScore: 5, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }, 0, '5e', 1);
      expect(errors).toHaveProperty('baseScore', 'Base score must be at least 8');
    });
  });

  describe('calculatePointBuyCost', () => {
    let utils;
    beforeEach(async () => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(mockValidationRules);
      utils = await import('./utils.js');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns 0 for score 8 (baseline)', async () => {
      expect(await utils.calculatePointBuyCost(8, '5e')).toBe(0);
    });

    it('returns 2 for score 10', async () => {
      expect(await utils.calculatePointBuyCost(10, '5e')).toBe(2);
    });

    it('returns 9 for score 15 (max point buy)', async () => {
      expect(await utils.calculatePointBuyCost(15, '5e')).toBe(9);
    });

    it('defaults to score 8 cost (0) when given NaN', async () => {
      expect(await utils.calculatePointBuyCost(NaN, '5e')).toBe(0);
    });

    it('defaults to score 8 cost (0) when given a score not in the cost table', async () => {
      expect(await utils.calculatePointBuyCost(20, '5e')).toBe(0);
    });

    it('defaults to score 8 cost (0) when given a non-numeric string', async () => {
      expect(await utils.calculatePointBuyCost('invalid', '5e')).toBe(0);
    });

    it('returns the correct cost for every valid score in the table', async () => {
      const expected = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
      for (const [score, cost] of Object.entries(expected)) {
        expect(await utils.calculatePointBuyCost(Number(score), '5e')).toBe(cost);
      }
    });
  });

  describe('getPointBuyCosts', () => {
    let utils;
    beforeEach(async () => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(mockValidationRules);
      utils = await import('./utils.js');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns the point buy costs object from rules', async () => {
      expect(await utils.getPointBuyCosts('5e')).toEqual(mockValidationRules.point_buy.costs);
    });

    it('returns an empty object when point_buy is missing', async () => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue({ level_range: { min: 1, max: 20 } });
      const freshUtils = await import('./utils.js');
      expect(await freshUtils.getPointBuyCosts('5e')).toEqual({});
    });

    it('returns an empty object when point_buy.costs is missing', async () => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue({ point_buy: {} });
      const freshUtils = await import('./utils.js');
      expect(await freshUtils.getPointBuyCosts('5e')).toEqual({});
    });
  });

  describe('getFeatRules', () => {
    let utils;
    beforeEach(async () => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(mockValidationRules);
      utils = await import('./utils.js');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns the feat rules object from rules', async () => {
      expect(await utils.getFeatRules('5e')).toEqual(mockValidationRules.feats);
    });

    it('returns an empty object when feats is missing', async () => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue({ level_range: { min: 1, max: 20 } });
      const freshUtils = await import('./utils.js');
      expect(await freshUtils.getFeatRules('5e')).toEqual({});
    });
  });

  describe('getBackgroundLanguageCount', () => {
    let utils;
    beforeEach(async () => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(mockValidationRules);
      utils = await import('./utils.js');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns the background_languages count from rules', async () => {
      expect(await utils.getBackgroundLanguageCount('5e')).toBe(2);
    });

    it('returns 2 when background_languages is missing', async () => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue({});
      const freshUtils = await import('./utils.js');
      expect(await freshUtils.getBackgroundLanguageCount('5e')).toBe(2);
    });

    it('returns the actual value when background_languages is set to a non-default number', async () => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue({ background_languages: 4 });
      const freshUtils = await import('./utils.js');
      expect(await freshUtils.getBackgroundLanguageCount('5e')).toBe(4);
    });
  });

  describe('getSkillsFromAbilityScores', () => {
    let utils;
    beforeEach(async () => {
      utils = await import('./utils.js');
    });

    it('returns unique skills extracted from ability scores', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAbilityScoresData)
      });
      const skills = await utils.getSkillsFromAbilityScores('5e');
      expect(skills).toContain('Athletics');
      expect(skills).toContain('Acrobatics');
      expect(skills).toContain('Arcana');
      expect(skills).toContain('Perception');
      // Constitution has no skills; total unique skills across all abilities
      expect(skills).toHaveLength(18);
    });

    it('returns fallback skills when fetch response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false });
      const errorSpy = vi.spyOn(console, 'error');
      const skills = await utils.getSkillsFromAbilityScores('5e');
      expect(skills).toContain('Acrobatics');
      expect(skills).toContain('Athletics');
      expect(skills).toContain('Perception');
      expect(errorSpy).toHaveBeenCalledWith('Error loading ability-scores.json:', expect.any(Error));
      errorSpy.mockRestore();
    });

    it('returns fallback skills when fetch throws', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const errorSpy = vi.spyOn(console, 'error');
      const skills = await utils.getSkillsFromAbilityScores('5e');
      expect(skills).toContain('Acrobatics');
      expect(skills).toContain('Athletics');
      expect(skills).toContain('Perception');
      expect(errorSpy).toHaveBeenCalledWith('Error loading ability-scores.json:', expect.any(Error));
      errorSpy.mockRestore();
    });
  });

  describe('getAbilityNamesFromJson', () => {
    let utils;
    beforeEach(async () => {
      utils = await import('./utils.js');
    });

    it('returns ability full_name values from the data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAbilityScoresData)
      });
      const names = await utils.getAbilityNamesFromJson();
      expect(names).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']);
    });

    it('returns fallback names when fetch response is not ok', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: false });
      const errorSpy = vi.spyOn(console, 'error');
      const names = await utils.getAbilityNamesFromJson();
      expect(names).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']);
      expect(errorSpy).toHaveBeenCalledWith('Error loading ability-scores.json:', expect.any(Error));
      errorSpy.mockRestore();
    });

    it('returns fallback names when fetch throws', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const errorSpy = vi.spyOn(console, 'error');
      const names = await utils.getAbilityNamesFromJson();
      expect(names).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']);
      expect(errorSpy).toHaveBeenCalledWith('Error loading ability-scores.json:', expect.any(Error));
      errorSpy.mockRestore();
    });
  });

  describe('validateStep', () => {
    let utils;
    beforeEach(async () => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(mockValidationRules);
      utils = await import('./utils.js');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe('Step 2: Basic Information', () => {
      it('returns an error when name is missing', async () => {
        const formData = { level: 1, alignment: 'Good' };
        const errors = await utils.validateStep(2, formData, {}, [], [], '5e');
        expect(errors).toHaveProperty('name', 'Character name is required');
      });

      it('returns an error when name is whitespace-only', async () => {
        const formData = { name: '   ', level: 1, alignment: 'Good' };
        const errors = await utils.validateStep(2, formData, {}, [], [], '5e');
        expect(errors).toHaveProperty('name', 'Character name is required');
      });

      it('returns an error when alignment is missing', async () => {
        const formData = { name: 'Test', level: 1 };
        const errors = await utils.validateStep(2, formData, {}, [], [], '5e');
        expect(errors).toHaveProperty('alignment', 'Alignment is required');
      });

      it('returns an error when level is missing', async () => {
        const formData = { name: 'Test', alignment: 'Good' };
        const errors = await utils.validateStep(2, formData, {}, [], [], '5e');
        expect(errors).toHaveProperty('level', 'Level must be between 1 and 20');
      });

      it('returns no errors when all required fields are present for 5e', async () => {
        const formData = { name: 'Test', level: 1, alignment: 'Good' };
        const errors = await utils.validateStep(2, formData, {}, [], [], '5e');
        expect(errors).toEqual({});
      });

      it('requires background for 2024 ruleset', async () => {
        const formData = { name: 'Test', level: 1, alignment: 'Good' };
        const errors = await utils.validateStep(2, formData, {}, [], [], '2024');
        expect(errors).toHaveProperty('background', 'Background is required');
      });

      it('does not require background for 5e ruleset', async () => {
        const formData = { name: 'Test', level: 1, alignment: 'Good' };
        const errors = await utils.validateStep(2, formData, {}, [], [], '5e');
        expect(errors).not.toHaveProperty('background');
      });
    });

    describe('Step 3: Race & Class', () => {
      it('returns an error when race is missing', async () => {
        const formData = { class: { name: 'Fighter' } };
        const errors = await utils.validateStep(3, formData, {}, [], [], '5e');
        expect(errors).toHaveProperty('race', 'Race is required');
      });

      it('returns an error when class is missing', async () => {
        const formData = { race: { name: 'Human' } };
        const errors = await utils.validateStep(3, formData, {}, [], [], '5e');
        expect(errors).toHaveProperty('class', 'Class is required');
      });

      it('returns an error when race.name is missing but race object exists', async () => {
        const formData = { race: {}, class: { name: 'Fighter' } };
        const errors = await utils.validateStep(3, formData, {}, [], [], '5e');
        expect(errors).toHaveProperty('race', 'Race is required');
      });

      it('returns an error when class.name is missing but class object exists', async () => {
        const formData = { race: { name: 'Human' }, class: {} };
        const errors = await utils.validateStep(3, formData, {}, [], [], '5e');
        expect(errors).toHaveProperty('class', 'Class is required');
      });

      it('requires subrace when the selected race has subraces and none is chosen', async () => {
        const racesData = [{ name: 'Elf', subraces: [{ name: 'High Elf' }, { name: 'Wood Elf' }] }];
        const formData = { race: { name: 'Elf' }, class: { name: 'Fighter' } };
        const errors = await utils.validateStep(3, formData, {}, racesData, [], '5e');
        expect(errors).toHaveProperty('subrace', 'Subrace is required');
      });

      it('does not require subrace when the selected race has no subraces', async () => {
        const racesData = [{ name: 'Human', subraces: [] }];
        const formData = { race: { name: 'Human' }, class: { name: 'Fighter' } };
        const errors = await utils.validateStep(3, formData, {}, racesData, [], '5e');
        expect(errors).not.toHaveProperty('subrace');
      });

      it('does not require subrace when the race is not found in racesData', async () => {
        const formData = { race: { name: 'Gnome' }, class: { name: 'Fighter' } };
        const errors = await utils.validateStep(3, formData, {}, [], [], '5e');
        expect(errors).not.toHaveProperty('subrace');
      });

      it('requires subclass when the selected class has subclasses and none is chosen', async () => {
        const classSubtypes = [{ className: 'Fighter', subtypes: [{ name: 'Champion' }] }];
        const formData = { race: { name: 'Human' }, class: { name: 'Fighter' } };
        const errors = await utils.validateStep(3, formData, {}, [], classSubtypes, '5e');
        expect(errors).toHaveProperty('subclass', 'Subclass is required');
      });

      it('does not require subclass when the class has no subclasses', async () => {
        const classSubtypes = [{ className: 'Fighter', subtypes: [] }];
        const formData = { race: { name: 'Human' }, class: { name: 'Fighter' } };
        const errors = await utils.validateStep(3, formData, {}, [], classSubtypes, '5e');
        expect(errors).not.toHaveProperty('subclass');
      });

      it('does not require subclass when the class is not found in classSubtypes', async () => {
        const formData = { race: { name: 'Human' }, class: { name: 'Rogue' } };
        const errors = await utils.validateStep(3, formData, {}, [], [], '5e');
        expect(errors).not.toHaveProperty('subclass');
      });
    });

    describe('Steps 4+', () => {
      it('returns no errors regardless of missing data for steps beyond 3', async () => {
        const errors = await utils.validateStep(4, {}, {}, [], [], '5e');
        expect(errors).toEqual({});
      });

      it('returns no errors for step 10 with empty form data', async () => {
        const errors = await utils.validateStep(10, {}, {}, [], [], '5e');
        expect(errors).toEqual({});
      });
    });
  });
});
