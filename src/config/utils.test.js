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
  ability_score_max: { standard: 20, level_20: 24 }
};

describe('character-creation/utils', () => {
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
