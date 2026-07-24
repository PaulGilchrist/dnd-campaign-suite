import WizardStepRules from '../components/character-creation/WizardStepRules.jsx';
import WizardStepBasic from '../components/character-creation/WizardStepBasic.jsx';
import WizardStepRace from '../components/character-creation/WizardStepRace.jsx';
import WizardStepSubrace from '../components/character-creation/WizardStepSubrace.jsx';
import WizardStepBackground from '../components/character-creation/WizardStepBackground.jsx';
import WizardStepClass from '../components/character-creation/WizardStepClass.jsx';
import WizardStepSubclass from '../components/character-creation/WizardStepSubclass.jsx';
import WizardStepFeats from '../components/character-creation/WizardStepFeats.jsx';
import WizardStepAbilities from '../components/character-creation/WizardStepAbilities.jsx';
import WizardStepSkills from '../components/character-creation/WizardStepSkills.jsx';
import WizardStepTools from '../components/character-creation/WizardStepTools.jsx';
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
    getProps: ({ formData, errors, backgrounds, ruleset, campaignName, onInputChange }) => ({
      formData,
      errors,
      backgrounds,
      ruleset,
      campaignName,
      onInputChange,
    }),
  },
  {
    step: 3,
    title: 'Race',
    component: WizardStepRace,
    getProps: ({ formData, errors, allRacesData, racesData, ruleset, onInputChange }) => ({
      formData,
      errors,
      allRacesData,
      racesData,
      ruleset,
      onInputChange,
    }),
  },
  {
    step: 4,
    title: 'Subrace',
    component: WizardStepSubrace,
    getProps: ({ formData, errors, allRacesData, racesData, ruleset, onInputChange }) => ({
      formData,
      errors,
      allRacesData,
      racesData,
      ruleset,
      onInputChange,
    }),
  },
  {
    step: 5,
    title: 'Background',
    component: WizardStepBackground,
    getProps: ({ formData, errors, backgrounds, ruleset, onInputChange }) => ({
      formData,
      errors,
      backgrounds,
      ruleset,
      onInputChange,
    }),
  },
  {
    step: 6,
    title: 'Class',
    component: WizardStepClass,
    getProps: ({ formData, errors, allClassesData, classSubtypes, ruleset, onInputChange }) => ({
      formData,
      errors,
      allClassesData,
      classSubtypes,
      ruleset,
      onInputChange,
    }),
  },
  {
    step: 7,
    title: 'Subclass / Major',
    component: WizardStepSubclass,
    getProps: ({ formData, errors, classSubtypes, ruleset, onInputChange, allClassesData }) => ({
      formData,
      errors,
      classSubtypes,
      ruleset,
      onInputChange,
      allClassesData,
    }),
  },
  {
    step: 8,
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
    step: 9,
    title: 'Ability Scores',
    component: WizardStepAbilities,
    getProps: ({ formData, errors, onAbilityBaseScoreChange, onAbilityMiscIncreaseChange, updateBackgroundIncrease, backgroundAbilityNames, backgroundAbilityAssignments, backgroundValidationWarnings, allFeats, featAbilityChoices, featAbilityAssignments, handleFeatAbilityChoice, onFeatAbilityModeChange, racesData }) => ({
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
      onFeatAbilityModeChange,
      racesData,
    }),
  },
  {
    step: 10,
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
    step: 11,
    title: 'Tool Proficiencies',
    component: WizardStepTools,
    getProps: ({ formData, errors, onToolToggle, toolLimits, toolWarnings, preSelectedTools }) => ({
      formData,
      errors,
      onToolToggle,
      toolLimits,
      toolWarnings,
      preSelectedTools,
    }),
  },
  {
    step: 12,
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
    step: 13,
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
    step: 14,
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
    step: 15,
    title: 'Magic Items',
    component: WizardStepMagicItems,
    getProps: ({ formData, allMagicItems, ruleset, classSubtypes, onArrayFieldChange }) => ({
      formData,
      allMagicItems,
      ruleset,
      classSubtypes,
      onArrayFieldChange,
    }),
  },
  {
    step: 16,
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
    step: 17,
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
