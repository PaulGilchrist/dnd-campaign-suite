// @cleaned-by-ai
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

    it('returns an error when name is absent or whitespace-only', () => {
      expect(utils.validateFinalFormData({
        level: 1,
        alignment: 'Lawful Good',
        race: { name: 'Human' },
        class: { name: 'Wizard' },
        expertSkills: []
      })).toHaveProperty('name', 'name is required');
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

    it('returns no errors for valid levels at boundaries and mid-range', async () => {
      expect(await utils.validateLevel(1, '5e')).toEqual({});
      expect(await utils.validateLevel(10, '5e')).toEqual({});
      expect(await utils.validateLevel(20, '5e')).toEqual({});
    });

    it('returns an error for out-of-range levels', async () => {
      expect((await utils.validateLevel(0, '5e')).level).toBe('Level must be between 1 and 20');
      expect((await utils.validateLevel(21, '5e')).level).toBe('Level must be between 1 and 20');
    });

    it('returns an error for falsy level values', async () => {
      expect((await utils.validateLevel(null, '5e')).level).toBe('Level must be between 1 and 20');
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

    it('returns no errors for valid base scores', async () => {
      expect(await utils.validateAbility({ baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }, 0, '5e', 1)).toEqual({});
    });

    it('returns an error when baseScore is below the allowed range', async () => {
      expect((await utils.validateAbility({ baseScore: 7, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }, 0, '5e', 1)).baseScore).toBe('Base score must be at least 8');
    });

    it('returns an error when baseScore exceeds the point buy max', async () => {
      expect((await utils.validateAbility({ baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }, 0, '5e', 1)).baseScore).toBe('Base score cannot exceed 15 (point buy max)');
    });

    it('returns an error when totalScore exceeds the level-1 maximum of 20', async () => {
      const errors = await utils.validateAbility({ baseScore: 15, featIncrease: 6, miscIncrease: 0, backgroundIncrease: 0 }, 0, '5e', 1);
      expect(errors).toHaveProperty('totalScore', 'Total score (base + improvements + misc) cannot exceed 20');
    });

    it('allows a higher totalScore max at level 20', async () => {
      const errors = await utils.validateAbility({ baseScore: 15, featIncrease: 5, miscIncrease: 0, backgroundIncrease: 0 }, 0, '5e', 20);
      expect(errors).not.toHaveProperty('totalScore');
    });

    it('returns an error for negative miscIncrease', async () => {
      expect((await utils.validateAbility({ baseScore: 10, featIncrease: 0, miscIncrease: -1, backgroundIncrease: 0 }, 0, '5e', 1)).miscIncrease).toBe('Misc bonus must be 0 or above');
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
      it('returns an error when name is missing or whitespace-only', async () => {
        let errors = await utils.validateStep(2, { level: 1, alignment: 'Good' }, {}, [], [], '5e');
        expect(errors).toHaveProperty('name', 'Character name is required');
        errors = await utils.validateStep(2, { name: '   ', level: 1, alignment: 'Good' }, {}, [], [], '5e');
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

      it('requires background for 2024 ruleset but not for 5e', async () => {
        const formData = { name: 'Test', level: 1, alignment: 'Good' };
        let errors = await utils.validateStep(2, formData, {}, [], [], '2024');
        expect(errors).toHaveProperty('background', 'Background is required');
        errors = await utils.validateStep(2, formData, {}, [], [], '5e');
        expect(errors).not.toHaveProperty('background');
      });
    });

    describe('Step 3: Race & Class', () => {
      it('returns an error when race is missing or race.name is absent', async () => {
        let errors = await utils.validateStep(3, { class: { name: 'Fighter' } }, {}, [], [], '5e');
        expect(errors).toHaveProperty('race', 'Race is required');
        errors = await utils.validateStep(3, { race: {}, class: { name: 'Fighter' } }, {}, [], [], '5e');
        expect(errors).toHaveProperty('race', 'Race is required');
      });

      it('returns an error when class is missing or class.name is absent', async () => {
        let errors = await utils.validateStep(3, { race: { name: 'Human' } }, {}, [], [], '5e');
        expect(errors).toHaveProperty('class', 'Class is required');
        errors = await utils.validateStep(3, { race: { name: 'Human' }, class: {} }, {}, [], [], '5e');
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
  });
});
