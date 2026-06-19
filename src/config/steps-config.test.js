// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { WIZARD_STEPS, getTotalSteps, getStepConfig } from './steps-config.js';

describe('steps-config', () => {
  describe('WIZARD_STEPS', () => {
    it('should have 12 steps', () => {
      expect(WIZARD_STEPS).toHaveLength(12);
    });

    it('should have unique step numbers', () => {
      const stepNumbers = WIZARD_STEPS.map(s => s.step);
      const uniqueSteps = [...new Set(stepNumbers)];
      expect(uniqueSteps).toHaveLength(stepNumbers.length);
    });

    it('should have all required properties on every step', () => {
      WIZARD_STEPS.forEach(step => {
        expect(step.step).toBeDefined();
        expect(step.title).toBeDefined();
        expect(step.component).toBeDefined();
        expect(step.getProps).toBeDefined();
        expect(typeof step.getProps).toBe('function');
      });
    });

    it('should have correct step titles', () => {
      expect(WIZARD_STEPS[0].title).toBe('Ruleset');
      expect(WIZARD_STEPS[1].title).toBe('Basic Information');
      expect(WIZARD_STEPS[2].title).toBe('Race & Class');
      expect(WIZARD_STEPS[3].title).toBe('Feats');
      expect(WIZARD_STEPS[4].title).toBe('Ability Scores');
      expect(WIZARD_STEPS[5].title).toBe('Skill Proficiencies');
      expect(WIZARD_STEPS[6].title).toBe('Languages & Fighting Styles');
      expect(WIZARD_STEPS[7].title).toBe('Resistances & Immunities');
      expect(WIZARD_STEPS[8].title).toBe('Spells');
      expect(WIZARD_STEPS[9].title).toBe('Magic Items');
      expect(WIZARD_STEPS[10].title).toBe('Inventory');
      expect(WIZARD_STEPS[11].title).toBe('Special Actions');
    });

    it('should have sequential step numbers starting at 1', () => {
      WIZARD_STEPS.forEach((step, index) => {
        expect(step.step).toBe(index + 1);
      });
    });

    it('should export distinct component references for each step', () => {
      const components = WIZARD_STEPS.map(s => s.component);
      const uniqueComponents = [...new Set(components)];
      expect(uniqueComponents).toHaveLength(12);
    });
  });

  describe('getTotalSteps', () => {
    it('should return the length of WIZARD_STEPS', () => {
      expect(getTotalSteps()).toBe(WIZARD_STEPS.length);
    });
  });

  describe('getStepConfig', () => {
    it('should return config for step 1', () => {
      const config = getStepConfig(1);
      expect(config).toBeDefined();
      expect(config.step).toBe(1);
      expect(config.title).toBe('Ruleset');
    });

    it('should return config for step 12', () => {
      const config = getStepConfig(12);
      expect(config).toBeDefined();
      expect(config.step).toBe(12);
      expect(config.title).toBe('Special Actions');
    });

    it('should return undefined for invalid step', () => {
      expect(getStepConfig(999)).toBeUndefined();
    });

    it('should return undefined for 0', () => {
      expect(getStepConfig(0)).toBeUndefined();
    });

    it('should return undefined for negative step', () => {
      expect(getStepConfig(-1)).toBeUndefined();
    });

    it('should return undefined for non-numeric inputs', () => {
      expect(getStepConfig('1')).toBeUndefined();
      expect(getStepConfig(null)).toBeUndefined();
      expect(getStepConfig(undefined)).toBeUndefined();
    });

    it('should return undefined for float values', () => {
      expect(getStepConfig(1.5)).toBeUndefined();
    });

    it('should return the same object reference when called multiple times for the same step', () => {
      const config1 = getStepConfig(5);
      const config2 = getStepConfig(5);
      expect(config1).toBe(config2);
    });

    it('should return distinct configs for distinct steps', () => {
      const config1 = getStepConfig(1);
      const config2 = getStepConfig(2);
      expect(config1).not.toBe(config2);
      expect(config1.step).not.toBe(config2.step);
    });
  });

  describe('getProps functions', () => {
    it('should pass through all input props for step 1 (Ruleset)', () => {
      const config = getStepConfig(1);
      const input = {
        ruleset: '5e',
        errors: { step1: true },
        onRulesetChange: () => {},
      };
      const props = config.getProps(input);
      expect(props).toEqual(input);
    });

    it('should pass through all input props for step 2 (Basic Information)', () => {
      const config = getStepConfig(2);
      const input = {
        formData: { name: 'Test' },
        errors: {},
        backgrounds: ['Soldier'],
        ruleset: '5e',
        onInputChange: () => {},
      };
      const props = config.getProps(input);
      expect(props).toEqual(input);
    });

    it('should pass through all input props for step 3 (Race & Class)', () => {
      const config = getStepConfig(3);
      const input = {
        formData: {},
        errors: {},
        racesData: [{ name: 'Human' }],
        classSubtypes: [{ name: 'Fighter' }],
        ruleset: '5e',
        onInputChange: () => {},
        allClasses: [{ name: 'Wizard' }],
      };
      const props = config.getProps(input);
      expect(props).toEqual(input);
    });

    it('should pass through all input props for step 4 (Feats)', () => {
      const config = getStepConfig(4);
      const input = {
        formData: { feats: ['Great Weapon Master'] },
        allFeats: [{ name: 'Great Weapon Master' }],
        onArrayFieldChange: () => {},
        preSelectedFeats: [],
        computedBuffs: [],
      };
      const props = config.getProps(input);
      expect(props).toEqual(input);
    });

    it('should map prop names correctly for step 5 (Ability Scores)', () => {
      const config = getStepConfig(5);
      const input = {
        formData: { abilities: [] },
        errors: {},
        onAbilityBaseScoreChange: () => {},
        onAbilityMiscIncreaseChange: () => {},
        updateBackgroundIncrease: () => {},
        backgroundAbilityNames: ['Strength'],
        backgroundAbilityAssignments: {},
        backgroundValidationWarnings: [],
        allFeats: [],
        featAbilityChoices: {},
        featAbilityAssignments: {},
        handleFeatAbilityChoice: () => {},
      };
      const props = config.getProps(input);
      expect(props.formData).toBe(input.formData);
      expect(props.errors).toBe(input.errors);
      expect(props.onAbilityBaseScoreChange).toBe(input.onAbilityBaseScoreChange);
      expect(props.onAbilityMiscIncreaseChange).toBe(input.onAbilityMiscIncreaseChange);
      expect(props.onBackgroundIncreaseChange).toBe(input.updateBackgroundIncrease);
      expect(props.backgroundAbilityChoices).toBe(input.backgroundAbilityNames);
      expect(props.backgroundAbilityAssignments).toBe(input.backgroundAbilityAssignments);
      expect(props.backgroundValidationWarnings).toBe(input.backgroundValidationWarnings);
      expect(props.allFeats).toBe(input.allFeats);
      expect(props.featAbilityChoices).toBe(input.featAbilityChoices);
      expect(props.featAbilityAssignments).toBe(input.featAbilityAssignments);
      expect(props.onFeatAbilityChoiceChange).toBe(input.handleFeatAbilityChoice);
    });

    it('should pass through all input props for step 6 (Skill Proficiencies)', () => {
      const config = getStepConfig(6);
      const input = {
        formData: { skillProficiencies: [] },
        errors: {},
        onSkillToggle: () => {},
        onSkillExpertiseToggle: () => {},
        skillLimits: null,
        expertiseLimits: null,
        warnings: [],
        preSelectedSkills: [],
      };
      const props = config.getProps(input);
      expect(props).toEqual(input);
    });

    it('should map prop names correctly for step 7 (Languages & Fighting Styles)', () => {
      const config = getStepConfig(7);
      const input = {
        formData: { languages: [] },
        errors: {},
        onLanguageToggle: () => {},
        onFightingStyleToggle: () => {},
        languageLimits: null,
        fightingStyleLimits: null,
        languageWarnings: ['Too many languages'],
        preSelectedLanguages: [],
        preSelectedFightingStyles: [],
      };
      const props = config.getProps(input);
      expect(props.formData).toBe(input.formData);
      expect(props.errors).toBe(input.errors);
      expect(props.onLanguageToggle).toBe(input.onLanguageToggle);
      expect(props.onFightingStyleToggle).toBe(input.onFightingStyleToggle);
      expect(props.languageLimits).toBe(input.languageLimits);
      expect(props.fightingStyleLimits).toBe(input.fightingStyleLimits);
      expect(props.warnings).toBe(input.languageWarnings);
      expect(props.preSelectedLanguages).toBe(input.preSelectedLanguages);
      expect(props.preSelectedFightingStyles).toBe(input.preSelectedFightingStyles);
    });

    it('should map prop names correctly for step 8 (Resistances & Immunities)', () => {
      const config = getStepConfig(8);
      const input = {
        formData: { resistances: [], immunities: [] },
        onResistanceToggle: () => {},
        onImmunityToggle: () => {},
        resistanceWarnings: { resistances: ['Duplicate'], immunities: [] },
        preSelectedResistances: { resistances: [], immunities: [] },
        preSelectedImmunities: { resistances: [], immunities: [] },
      };
      const props = config.getProps(input);
      expect(props.formData).toBe(input.formData);
      expect(props.onResistanceToggle).toBe(input.onResistanceToggle);
      expect(props.onImmunityToggle).toBe(input.onImmunityToggle);
      expect(props.warnings).toBe(input.resistanceWarnings);
      expect(props.preSelectedResistances).toBe(input.preSelectedResistances);
      expect(props.preSelectedImmunities).toBe(input.preSelectedImmunities);
    });

    it('should pass through all input props for step 9 (Spells)', () => {
      const config = getStepConfig(9);
      const input = {
        formData: { spells: [] },
        allSpells: [],
        onArrayFieldChange: () => {},
        preSelectedSpells: [],
      };
      const props = config.getProps(input);
      expect(props).toEqual(input);
    });

    it('should pass through all input props for step 10 (Magic Items)', () => {
      const config = getStepConfig(10);
      const input = {
        formData: { inventory: { magicItems: [] } },
        allMagicItems: [],
        ruleset: '5e',
        onArrayFieldChange: () => {},
      };
      const props = config.getProps(input);
      expect(props).toEqual(input);
    });

    it('should pass through all input props for step 11 (Inventory)', () => {
      const config = getStepConfig(11);
      const input = {
        formData: { inventory: {} },
        tempInventory: { backpack: [], equipped: [] },
        onInventoryChange: () => {},
        onTempInventoryChange: () => {},
      };
      const props = config.getProps(input);
      expect(props).toEqual(input);
    });

    it('should pass through all input props for step 12 (Special Actions)', () => {
      const config = getStepConfig(12);
      const input = {
        formData: { actions: [], bonusActions: [], reactions: [], specialActions: [] },
        onArrayFieldChange: () => {},
      };
      const props = config.getProps(input);
      expect(props).toEqual(input);
    });

    it('should return a new object from getProps (not the input reference)', () => {
      const config = getStepConfig(1);
      const input = { ruleset: '5e', errors: {}, onRulesetChange: () => {} };
      const props = config.getProps(input);
      expect(props).not.toBe(input);
    });
  });
});
