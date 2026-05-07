import WizardStepRules from './wizard-step-rules.jsx';
import WizardStepBasic from './wizard-step-basic.jsx';
import WizardStepRaceClass from './wizard-step-race-class.jsx';
import WizardStepFeats from './wizard-step-feats.jsx';
import WizardStepAbilities from './wizard-step-abilities.jsx';
import WizardStepSkills from './wizard-step-skills.jsx';
import WizardStepLanguages from './wizard-step-languages.jsx';
import WizardStepResistances from './wizard-step-resistances.jsx';
import WizardStepSpells from './wizard-step-spells.jsx';
import WizardStepMagicItems from './wizard-step-magic-items.jsx';
import WizardStepInventory from './wizard-step-inventory.jsx';
import WizardStepSpecial from './wizard-step-special.jsx';

/**
 * Declarative configuration for wizard steps.
 * Each step defines:
 *  - step: the step number
 *  - title: display title for the step
 *  - component: the React component to render
 *  - props: a function that returns the props object for the component
 */
export const WIZARD_STEPS = [
  {
    step: 1,
    title: 'Ruleset',
    component: WizardStepRules,
    getProps: ({ ruleset, errors, onRulesetChange }) => ({
      ruleset,
      errors,
      onRulesetChange,
    }),
  },
  {
    step: 2,
    title: 'Basic Information',
    component: WizardStepBasic,
    getProps: ({ formData, errors, backgrounds, ruleset, onInputChange }) => ({
      formData,
      errors,
      backgrounds,
      ruleset,
      onInputChange,
    }),
  },
  {
    step: 3,
    title: 'Race & Class',
    component: WizardStepRaceClass,
    getProps: ({ formData, errors, racesData, classSubtypes, ruleset, onInputChange }) => ({
      formData,
      errors,
      racesData,
      classSubtypes,
      ruleset,
      onInputChange,
    }),
  },
  {
    step: 4,
    title: 'Feats',
    component: WizardStepFeats,
    getProps: ({ formData, allFeats, onArrayFieldChange, preSelectedFeats }) => ({
      formData,
      allFeats,
      onArrayFieldChange,
      preSelectedFeats,
    }),
  },
  {
    step: 5,
    title: 'Ability Scores',
    component: WizardStepAbilities,
    getProps: ({ formData, errors, onAbilityBaseScoreChange, onAbilityImprovementChange, onAbilityMiscBonusChange }) => ({
      formData,
      errors,
      onAbilityBaseScoreChange,
      onAbilityImprovementChange,
      onAbilityMiscBonusChange,
    }),
  },
  {
    step: 6,
    title: 'Skill Proficiencies',
    component: WizardStepSkills,
    getProps: ({ formData, errors, onSkillToggle, onSkillExpertiseToggle, skillLimits, expertiseLimits, warnings, preSelectedSkills }) => ({
      formData,
      errors,
      onSkillToggle,
      onSkillExpertiseToggle,
      skillLimits,
      expertiseLimits,
      warnings,
      preSelectedSkills,
    }),
  },
  {
    step: 7,
    title: 'Languages & Fighting Styles',
    component: WizardStepLanguages,
    getProps: ({ formData, errors, onLanguageToggle, onFightingStyleToggle, languageLimits, fightingStyleLimits, warnings, preSelectedLanguages, preSelectedFightingStyles }) => ({
      formData,
      errors,
      onLanguageToggle,
      onFightingStyleToggle,
      languageLimits,
      fightingStyleLimits,
      warnings,
      preSelectedLanguages,
      preSelectedFightingStyles,
    }),
  },
  {
    step: 8,
    title: 'Resistances & Immunities',
    component: WizardStepResistances,
    getProps: ({ formData, onResistanceToggle, onImmunityToggle, warnings, preSelectedResistances, preSelectedImmunities }) => ({
      formData,
      onResistanceToggle,
      onImmunityToggle,
      warnings,
      preSelectedResistances,
      preSelectedImmunities,
    }),
  },
  {
    step: 9,
    title: 'Spells',
    component: WizardStepSpells,
    getProps: ({ formData, allSpells, onArrayFieldChange }) => ({
      formData,
      allSpells,
      onArrayFieldChange,
    }),
  },
  {
    step: 10,
    title: 'Magic Items',
    component: WizardStepMagicItems,
    getProps: ({ formData, allMagicItems, ruleset, onArrayFieldChange }) => ({
      formData,
      allMagicItems,
      ruleset,
      onArrayFieldChange,
    }),
  },
  {
    step: 11,
    title: 'Inventory',
    component: WizardStepInventory,
    getProps: ({ formData, tempInventory, onInventoryChange, onTempInventoryChange }) => ({
      formData,
      tempInventory,
      onInventoryChange,
      onTempInventoryChange,
    }),
  },
  {
    step: 12,
    title: 'Special Actions',
    component: WizardStepSpecial,
    getProps: ({ formData, onArrayFieldChange }) => ({
      formData,
      onArrayFieldChange,
    }),
  },
];

/**
 * Get the total number of wizard steps.
 */
export const getTotalSteps = () => WIZARD_STEPS.length;

/**
 * Get the step configuration for a given step number.
 */
export const getStepConfig = (stepNumber) => WIZARD_STEPS.find((step) => step.step === stepNumber);