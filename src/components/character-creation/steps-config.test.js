import { describe, it, expect } from 'vitest';
import { WIZARD_STEPS, getTotalSteps, getStepConfig } from './steps-config';

describe('steps-config', () => {
  describe('WIZARD_STEPS', () => {
    it('should be an array', () => {
      expect(Array.isArray(WIZARD_STEPS)).toBe(true);
         });

    it('should have 12 steps', () => {
      expect(WIZARD_STEPS.length).toBe(12);
         });

    it('should have step 1 as Ruleset', () => {
      const step1 = WIZARD_STEPS.find(step => step.step === 1);
      expect(step1).toBeDefined();
      expect(step1.title).toBe('Ruleset');
      expect(typeof step1.getProps).toBe('function');
         });

    it('should have step 2 as Basic Information', () => {
      const step2 = WIZARD_STEPS.find(step => step.step === 2);
      expect(step2).toBeDefined();
      expect(step2.title).toBe('Basic Information');
         });

    it('should have step 3 as Race & Class', () => {
      const step3 = WIZARD_STEPS.find(step => step.step === 3);
      expect(step3).toBeDefined();
      expect(step3.title).toBe('Race & Class');
         });

    it('should have step 4 as Feats', () => {
      const step4 = WIZARD_STEPS.find(step => step.step === 4);
      expect(step4).toBeDefined();
      expect(step4.title).toBe('Feats');
         });

    it('should have step 5 as Ability Scores', () => {
      const step5 = WIZARD_STEPS.find(step => step.step === 5);
      expect(step5).toBeDefined();
      expect(step5.title).toBe('Ability Scores');
         });

    it('should have step 6 as Skill Proficiencies', () => {
      const step6 = WIZARD_STEPS.find(step => step.step === 6);
      expect(step6).toBeDefined();
      expect(step6.title).toBe('Skill Proficiencies');
         });

    it('should have step 7 as Languages & Fighting Styles', () => {
      const step7 = WIZARD_STEPS.find(step => step.step === 7);
      expect(step7).toBeDefined();
      expect(step7.title).toBe('Languages & Fighting Styles');
         });

    it('should have step 8 as Resistances & Immunities', () => {
      const step8 = WIZARD_STEPS.find(step => step.step === 8);
      expect(step8).toBeDefined();
      expect(step8.title).toBe('Resistances & Immunities');
         });

    it('should have step 9 as Spells', () => {
      const step9 = WIZARD_STEPS.find(step => step.step === 9);
      expect(step9).toBeDefined();
      expect(step9.title).toBe('Spells');
         });

    it('should have step 10 as Magic Items', () => {
      const step10 = WIZARD_STEPS.find(step => step.step === 10);
      expect(step10).toBeDefined();
      expect(step10.title).toBe('Magic Items');
         });

    it('should have step 11 as Inventory', () => {
      const step11 = WIZARD_STEPS.find(step => step.step === 11);
      expect(step11).toBeDefined();
      expect(step11.title).toBe('Inventory');
         });

    it('should have step 12 as Special Actions', () => {
      const step12 = WIZARD_STEPS.find(step => step.step === 12);
      expect(step12).toBeDefined();
      expect(step12.title).toBe('Special Actions');
         });

    it('should have getProps function for each step', () => {
      WIZARD_STEPS.forEach(step => {
        expect(typeof step.getProps).toBe('function');
          });
         });

    it('should return correct props for step 1', () => {
      const step1 = WIZARD_STEPS.find(step => step.step === 1);
      const props = step1.getProps({
        ruleset: '5e',
        errors: {},
        onRulesetChange: () => {}
          });

      expect(props.ruleset).toBe('5e');
      expect(props.errors).toEqual({});
      expect(typeof props.onRulesetChange).toBe('function');
         });
      });

  describe('getTotalSteps', () => {
    it('should return the total number of steps', () => {
      const total = getTotalSteps();
      expect(total).toBe(12);
         });

    it('should match WIZARD_STEPS length', () => {
      expect(getTotalSteps()).toBe(WIZARD_STEPS.length);
         });
      });

  describe('getStepConfig', () => {
    it('should return step config for valid step number', () => {
      const config = getStepConfig(1);
      expect(config).toBeDefined();
      expect(config.step).toBe(1);
      expect(config.title).toBe('Ruleset');
         });

    it('should return step config for step 6', () => {
      const config = getStepConfig(6);
      expect(config).toBeDefined();
      expect(config.step).toBe(6);
      expect(config.title).toBe('Skill Proficiencies');
         });

    it('should return undefined for invalid step number', () => {
      const config = getStepConfig(99);
      expect(config).toBeUndefined();
         });

    it('should return undefined for step 0', () => {
      const config = getStepConfig(0);
      expect(config).toBeUndefined();
         });
      });
});
