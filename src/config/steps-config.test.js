// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { WIZARD_STEPS, getStepConfig, getVisibleSteps, getTotalSteps } from './steps-config.js';

/**
 * Canonical step titles shown in the wizard sidebar and step headings.
 * Ordered by step number; a rename here is a deliberate spec change.
 */
const EXPECTED_TITLES = [
  'Ruleset',
  'Basic Information',
  'Race',
  'Subrace',
  'Background',
  'Class',
  'Subclass / Major',
  'Feats',
  'Ability Scores',
  'Skill Proficiencies',
  'Tool Proficiencies',
  'Languages & Fighting Styles',
  'Resistances & Immunities',
  'Spells',
  'Magic Items',
  'Inventory',
  'Special Actions',
];

/**
 * getProps contract per step: componentPropName → wizardContextKey.
 * This is the seam between CharacterCreationWizard's shared context and
 * each step component. Most props pass through unchanged; a few steps
 * rename context keys (e.g. step 9 maps updateBackgroundIncrease →
 * onBackgroundIncreaseChange, step 12 maps languageWarnings → warnings).
 */
const GET_PROPS_CONTRACT = {
  1: {
    ruleset: 'ruleset',
    errors: 'errors',
    onRulesetChange: 'onRulesetChange',
  },
  2: {
    formData: 'formData',
    errors: 'errors',
    backgrounds: 'backgrounds',
    ruleset: 'ruleset',
    campaignName: 'campaignName',
    onInputChange: 'onInputChange',
  },
  3: {
    formData: 'formData',
    errors: 'errors',
    allRacesData: 'allRacesData',
    racesData: 'racesData',
    ruleset: 'ruleset',
    onInputChange: 'onInputChange',
  },
  4: {
    formData: 'formData',
    errors: 'errors',
    allRacesData: 'allRacesData',
    racesData: 'racesData',
    ruleset: 'ruleset',
    onInputChange: 'onInputChange',
  },
  5: {
    formData: 'formData',
    errors: 'errors',
    backgrounds: 'backgrounds',
    ruleset: 'ruleset',
    onInputChange: 'onInputChange',
  },
  6: {
    formData: 'formData',
    errors: 'errors',
    allClassesData: 'allClassesData',
    classSubtypes: 'classSubtypes',
    ruleset: 'ruleset',
    onInputChange: 'onInputChange',
  },
  7: {
    formData: 'formData',
    errors: 'errors',
    classSubtypes: 'classSubtypes',
    ruleset: 'ruleset',
    onInputChange: 'onInputChange',
    allClassesData: 'allClassesData',
  },
  8: {
    formData: 'formData',
    allFeats: 'allFeats',
    onArrayFieldChange: 'onArrayFieldChange',
    preSelectedFeats: 'preSelectedFeats',
    computedBuffs: 'computedBuffs',
  },
  9: {
    formData: 'formData',
    errors: 'errors',
    onAbilityBaseScoreChange: 'onAbilityBaseScoreChange',
    onAbilityMiscIncreaseChange: 'onAbilityMiscIncreaseChange',
    onBackgroundIncreaseChange: 'updateBackgroundIncrease',
    backgroundAbilityChoices: 'backgroundAbilityNames',
    backgroundAbilityAssignments: 'backgroundAbilityAssignments',
    backgroundValidationWarnings: 'backgroundValidationWarnings',
    allFeats: 'allFeats',
    featAbilityChoices: 'featAbilityChoices',
    featAbilityAssignments: 'featAbilityAssignments',
    onFeatAbilityChoiceChange: 'handleFeatAbilityChoice',
    onFeatAbilityModeChange: 'onFeatAbilityModeChange',
    racesData: 'racesData',
  },
  10: {
    formData: 'formData',
    errors: 'errors',
    onSkillToggle: 'onSkillToggle',
    onSkillExpertiseToggle: 'onSkillExpertiseToggle',
    skillLimits: 'skillLimits',
    expertiseLimits: 'expertiseLimits',
    warnings: 'warnings',
    preSelectedSkills: 'preSelectedSkills',
  },
  11: {
    formData: 'formData',
    errors: 'errors',
    onToolToggle: 'onToolToggle',
    toolLimits: 'toolLimits',
    toolWarnings: 'toolWarnings',
    preSelectedTools: 'preSelectedTools',
    skillLimits: 'skillLimits',
  },
  12: {
    formData: 'formData',
    errors: 'errors',
    onLanguageToggle: 'onLanguageToggle',
    onFightingStyleToggle: 'onFightingStyleToggle',
    languageLimits: 'languageLimits',
    fightingStyleLimits: 'fightingStyleLimits',
    warnings: 'languageWarnings',
    preSelectedLanguages: 'preSelectedLanguages',
    preSelectedFightingStyles: 'preSelectedFightingStyles',
  },
  13: {
    formData: 'formData',
    onResistanceToggle: 'onResistanceToggle',
    onImmunityToggle: 'onImmunityToggle',
    warnings: 'resistanceWarnings',
    preSelectedResistances: 'preSelectedResistances',
    preSelectedImmunities: 'preSelectedImmunities',
  },
  14: {
    formData: 'formData',
    allSpells: 'allSpells',
    onArrayFieldChange: 'onArrayFieldChange',
    preSelectedSpells: 'preSelectedSpells',
  },
  15: {
    formData: 'formData',
    allMagicItems: 'allMagicItems',
    ruleset: 'ruleset',
    classSubtypes: 'classSubtypes',
    onArrayFieldChange: 'onArrayFieldChange',
  },
  16: {
    formData: 'formData',
    tempInventory: 'tempInventory',
    onInventoryChange: 'onInventoryChange',
    onTempInventoryChange: 'onTempInventoryChange',
  },
  17: {
    formData: 'formData',
    onArrayFieldChange: 'onArrayFieldChange',
  },
};

describe('steps-config', () => {
  describe('WIZARD_STEPS declaration', () => {
    it('declares exactly one entry per canonical title, numbered contiguously from 1', () => {
      expect(WIZARD_STEPS).toHaveLength(EXPECTED_TITLES.length);
      expect(WIZARD_STEPS.map((step) => step.step)).toEqual(
        EXPECTED_TITLES.map((_, i) => i + 1)
      );
    });

    it('matches the canonical titles shown in the sidebar and step headings', () => {
      expect(WIZARD_STEPS.map((step) => step.title)).toEqual(EXPECTED_TITLES);
    });

    it('assigns a distinct renderable component to every step', () => {
      const components = WIZARD_STEPS.map((step) => step.component);
      const isRenderable = (component) =>
        typeof component === 'function' ||
        (typeof component === 'object' && component !== null && typeof component.type === 'function');
      for (const component of components) {
        expect(isRenderable(component)).toBe(true);
      }
      expect(new Set(components).size).toBe(components.length);
    });

    it('provides a getProps function on every step (consumed by WizardStepRenderer)', () => {
      for (const step of WIZARD_STEPS) {
        expect(step.getProps).toBeTypeOf('function');
      }
    });
  });

  describe('getProps context → component props mapping', () => {
    it('declares a contract for every step and nothing extra', () => {
      expect(Object.keys(GET_PROPS_CONTRACT).map(Number).sort((a, b) => a - b))
        .toEqual(WIZARD_STEPS.map((step) => step.step));
    });

    for (const step of WIZARD_STEPS) {
      it(`step ${step.step} (${step.title}) maps wizard context to exactly the component's props`, () => {
        const contract = GET_PROPS_CONTRACT[step.step];
        // Unique sentinel per context key so any mis-wired passthrough or
        // rename shows up as a value mismatch, not just a key mismatch.
        const contextKeys = new Set([...Object.keys(contract), ...Object.values(contract)]);
        const context = Object.fromEntries(
          [...contextKeys].map((key) => [key, `s${step.step}:${key}`])
        );
        context.unrelatedContextKey = 'noise'; // must not leak into props

        const expectedProps = Object.fromEntries(
          Object.entries(contract).map(([propName, contextKey]) => [propName, `s${step.step}:${contextKey}`])
        );

        expect(step.getProps(context)).toEqual(expectedProps);
      });
    }
  });

  describe('getStepConfig', () => {
    it('returns the exact config entry for every valid step number', () => {
      for (const entry of WIZARD_STEPS) {
        expect(getStepConfig(entry.step)).toBe(entry);
      }
      // First and last boundaries resolve by content, not just identity.
      expect(getStepConfig(1).title).toBe('Ruleset');
      expect(getStepConfig(17).title).toBe('Special Actions');
    });

    it('returns undefined for numbers outside the 1..17 wizard range', () => {
      expect(getStepConfig(0)).toBeUndefined();
      expect(getStepConfig(-1)).toBeUndefined();
      expect(getStepConfig(18)).toBeUndefined();
      expect(getStepConfig(100)).toBeUndefined();
    });
  });

  // Full numbering behavior (5e/2024/editing flows) is covered in
  // WizardStepNumbering.test.jsx — only the default-arguments behavior
  // documented on getVisibleSteps/getTotalSteps is asserted here.
  describe('documented defaults', () => {
    it('treats a call with no options as a non-2024 create flow (Background skipped)', () => {
      const steps = getVisibleSteps();
      expect(steps).toHaveLength(getTotalSteps() - 1);
      expect(steps.map((step) => step.step)).not.toContain(5);
      expect(steps.map((step) => step.displayNumber)).toEqual(
        steps.map((_, i) => i + 1)
      );
    });
  });
});
