// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { WIZARD_STEPS, getTotalSteps, getStepConfig } from './steps-config.js';

describe('steps-config', () => {
  describe('WIZARD_STEPS', () => {
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
    it('should return the number of wizard steps', () => {
      expect(getTotalSteps()).toBeGreaterThan(0);
    });
  });

  describe('getStepConfig', () => {
    it('should return config for valid step numbers', () => {
      const firstConfig = getStepConfig(1);
      expect(firstConfig).toBeDefined();
      expect(firstConfig.step).toBe(1);

      const lastConfig = getStepConfig(12);
      expect(lastConfig).toBeDefined();
      expect(lastConfig.step).toBe(12);
      expect(lastConfig.title).toBe('Special Actions');
    });

    it('should return undefined for invalid step numbers', () => {
      expect(getStepConfig(999)).toBeUndefined();
      expect(getStepConfig(0)).toBeUndefined();
      expect(getStepConfig(-1)).toBeUndefined();
    });

    it('should return config with correct props for step 5 (Ability Scores)', () => {
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
      expect(typeof props).toBe('object');
      expect(Object.keys(props)).toEqual(expect.arrayContaining([
        'formData', 'errors', 'onAbilityBaseScoreChange', 'onAbilityMiscIncreaseChange',
        'onBackgroundIncreaseChange', 'backgroundAbilityChoices', 'backgroundAbilityAssignments',
        'backgroundValidationWarnings', 'allFeats', 'featAbilityChoices',
        'featAbilityAssignments', 'onFeatAbilityChoiceChange',
      ]));
    });
  });
});
