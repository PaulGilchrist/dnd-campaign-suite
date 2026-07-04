// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { WIZARD_STEPS, getTotalSteps, getStepConfig } from './steps-config.js';

describe('steps-config', () => {
  describe('WIZARD_STEPS', () => {
    it('should have 12 steps', () => {
      expect(WIZARD_STEPS).toHaveLength(12);
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

    it('should have sequential step numbers starting at 1', () => {
      WIZARD_STEPS.forEach((step, index) => {
        expect(step.step).toBe(index + 1);
      });
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

    it('should return undefined for invalid step numbers', () => {
      expect(getStepConfig(999)).toBeUndefined();
      expect(getStepConfig(0)).toBeUndefined();
      expect(getStepConfig(-1)).toBeUndefined();
      expect(getStepConfig(1.5)).toBeUndefined();
      expect(getStepConfig('1')).toBeUndefined();
      expect(getStepConfig(null)).toBeUndefined();
      expect(getStepConfig(undefined)).toBeUndefined();
    });

    it('should return the same object reference when called multiple times for the same step', () => {
      const config1 = getStepConfig(5);
      const config2 = getStepConfig(5);
      expect(config1).toBe(config2);
    });
  });

  describe('getProps functions', () => {
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

    it('should return a new object from getProps (not the input reference)', () => {
      const config = getStepConfig(1);
      const input = { ruleset: '5e', errors: {}, onRulesetChange: () => {} };
      const props = config.getProps(input);
      expect(props).not.toBe(input);
    });
  });
});
