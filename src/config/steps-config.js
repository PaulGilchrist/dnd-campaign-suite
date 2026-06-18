import WizardStepRules from '../components/character-creation/WizardStepRules.jsx';
import WizardStepBasic from '../components/character-creation/WizardStepBasic.jsx';
import WizardStepRaceClass from '../components/character-creation/WizardStepRaceClass.jsx';
import WizardStepFeats from '../components/character-creation/WizardStepFeats.jsx';
import WizardStepAbilities from '../components/character-creation/WizardStepAbilities.jsx';
import WizardStepSkills from '../components/character-creation/WizardStepSkills.jsx';
import WizardStepLanguages from '../components/character-creation/WizardStepLanguages.jsx';
import WizardStepResistances from '../components/character-creation/WizardStepResistances.jsx';
import WizardStepSpells from '../components/character-creation/WizardStepSpells.jsx';
import WizardStepMagicItems from '../components/character-creation/WizardStepMagicItems.jsx';
import WizardStepInventory from '../components/character-creation/WizardStepInventory.jsx';
import WizardStepSpecial from '../components/character-creation/WizardStepSpecial.jsx';

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
    getProps: ({ formData, errors, racesData, classSubtypes, ruleset, onInputChange, allClasses }) => ({
      formData,
      errors,
      racesData,
      classSubtypes,
      ruleset,
      onInputChange,
      allClasses,
    }),
  },
  {
    step: 4,
    title: 'Feats',
    component: WizardStepFeats,
    getProps: ({ formData, allFeats, onArrayFieldChange, preSelectedFeats, computedBuffs }) => ({
      formData,
      allFeats,
      onArrayFieldChange,
      preSelectedFeats,
      computedBuffs,
    }),
  },
  {
    step: 5,
    title: 'Ability Scores',
    component: WizardStepAbilities,
    getProps: ({ formData, errors, onAbilityBaseScoreChange, onAbilityMiscIncreaseChange, updateBackgroundIncrease, backgroundAbilityNames, backgroundAbilityAssignments, backgroundValidationWarnings, allFeats, featAbilityChoices, featAbilityAssignments, handleFeatAbilityChoice }) => ({
      formData,
      errors,
      onAbilityBaseScoreChange,
      onAbilityMiscIncreaseChange,
      onBackgroundIncreaseChange: updateBackgroundIncrease,
      backgroundAbilityChoices: backgroundAbilityNames,
      backgroundAbilityAssignments,
      backgroundValidationWarnings,
      allFeats,
      featAbilityChoices,
      featAbilityAssignments,
      onFeatAbilityChoiceChange: handleFeatAbilityChoice,
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
    getProps: ({ formData, errors, onLanguageToggle, onFightingStyleToggle, languageLimits, fightingStyleLimits, languageWarnings, preSelectedLanguages, preSelectedFightingStyles }) => ({
      formData,
      errors,
      onLanguageToggle,
      onFightingStyleToggle,
      languageLimits,
      fightingStyleLimits,
      warnings: languageWarnings,
      preSelectedLanguages,
      preSelectedFightingStyles,
    }),
  },
  {
    step: 8,
    title: 'Resistances & Immunities',
    component: WizardStepResistances,
    getProps: ({ formData, onResistanceToggle, onImmunityToggle, resistanceWarnings, preSelectedResistances, preSelectedImmunities }) => ({
      formData,
      onResistanceToggle,
      onImmunityToggle,
      warnings: resistanceWarnings,
      preSelectedResistances,
      preSelectedImmunities,
    }),
  },
  {
    step: 9,
    title: 'Spells',
    component: WizardStepSpells,
    getProps: ({ formData, allSpells, onArrayFieldChange, preSelectedSpells }) => ({
      formData,
      allSpells,
      onArrayFieldChange,
      preSelectedSpells,
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