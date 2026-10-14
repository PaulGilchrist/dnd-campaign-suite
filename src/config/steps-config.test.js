import { describe, it, expect } from 'vitest';
import { WIZARD_STEPS, getStepConfig } from './steps-config.js';

const expectedTitles = {
  1: 'Ruleset',
  2: 'Basic Information',
  3: 'Race',
  4: 'Subrace',
  5: 'Background',
  6: 'Class',
  7: 'Subclass / Major',
  8: 'Feats',
  9: 'Ability Scores',
  10: 'Skill Proficiencies',
  11: 'Tool Proficiencies',
  12: 'Languages & Fighting Styles',
  13: 'Resistances & Immunities',
  14: 'Spells',
  15: 'Magic Items',
  16: 'Inventory',
  17: 'Special Actions',
};

describe('steps-config', () => {
  describe('WIZARD_STEPS integrity', () => {
    it('has 17 numbered steps contiguously from 1 with no gaps or duplicates', () => {
      expect(WIZARD_STEPS).toHaveLength(17);
      const stepNumbers = WIZARD_STEPS.map((step) => step.step);
      expect(stepNumbers).toEqual(
        Array.from({ length: stepNumbers.length }, (_, i) => i + 1)
      );
    });

    it('uses a distinct component for every step', () => {
      const components = WIZARD_STEPS.map((step) => step.component);
      expect(new Set(components).size).toBe(components.length);
    });

    it('defines step (number), title (non-empty string), component (renderable), and getProps (function) on every step', () => {
      for (const step of WIZARD_STEPS) {
        expect(step.step).toBeTypeOf('number');
        expect(step.title).toBeTypeOf('string');
        expect(step.title.length).toBeGreaterThan(0);
        const isRenderable = typeof step.component === 'function' ||
          (typeof step.component === 'object' && step.component !== null && typeof step.component.type === 'function');
        expect(isRenderable).toBe(true);
        expect(step.getProps).toBeTypeOf('function');
      }
    });
  });

  describe('step titles', () => {
    it('assigns the expected title to every step', () => {
      for (const step of WIZARD_STEPS) {
        expect(`${step.step}: ${step.title}`).toBe(`${step.step}: ${expectedTitles[step.step]}`);
      }
    });
  });

  describe('getStepConfig', () => {
    it('returns undefined for out-of-range step numbers', () => {
      expect(getStepConfig(0)).toBeUndefined();
      expect(getStepConfig(-1)).toBeUndefined();
      expect(getStepConfig(100)).toBeUndefined();
    });
  });
});
