// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { WIZARD_STEPS, getTotalSteps, getStepConfig } from './steps-config.js';

describe('steps-config', () => {
  describe('getTotalSteps', () => {
    it('should return the number of wizard steps', () => {
      expect(getTotalSteps()).toBe(WIZARD_STEPS.length);
    });
  });

  describe('getStepConfig', () => {
    it('should return config for valid step numbers', () => {
      expect(getStepConfig(1).step).toBe(1);
      expect(getStepConfig(12).step).toBe(12);
    });

    it('should return undefined for invalid step numbers', () => {
      expect(getStepConfig(0)).toBeUndefined();
    });
  });
});
