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
    getProps: ({ ruleset, errors, onRulesetChange, buildMode, onBuildModeChange, isEditing }) => ({
      ruleset,
      errors,
      onRulesetChange,
      buildMode,
      onBuildModeChange,
      isEditing,
    }),
  },
  {
    step: 2,
    title: 'Basic Information',
    component: WizardStepBasic,
    getProps: ({ formData, errors, backgrounds, ruleset, campaignName, onInputChange, onNameBlur }) => ({
      formData,
      errors,
      backgrounds,
      ruleset,
      campaignName,
      onInputChange,
      onNameBlur,
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
    getProps: ({ formData, errors, allClassesData, ruleset, onInputChange }) => ({
      formData,
      errors,
      allClassesData,
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
    getProps: ({ formData, errors, onToolToggle, toolLimits, toolWarnings, preSelectedTools, skillLimits }) => ({
      formData,
      errors,
      onToolToggle,
      toolLimits,
      toolWarnings,
      preSelectedTools,
      skillLimits,
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
 * Get the steps actually walked for a given flow, numbered consecutively.
 * Single source of truth for both the sidebar indicator and the content
 * headings: `displayNumber` is 1-based over visible steps only.
 *  - ruleset !== '2024': step 5 (Background) is skipped (2024-only by design).
 * The Ruleset step (1) is visible in BOTH flows: fresh builds choose it on
 * arrival; edits reach it from the sidebar to switch the saved character's
 * ruleset through the keep/remove ledger guard (RulesetSwitchConfirmModal).
 * Editing only changes the ARRIVAL step (Basic Information), never the index.
 */
export const getVisibleSteps = ({ ruleset } = {}) =>
  WIZARD_STEPS
    .filter((step) => {
      if (ruleset !== '2024' && step.step === 5) return false;
      return true;
    })
    .map((step, index) => ({ ...step, displayNumber: index + 1 }));

/**
 * Get the consecutive display number for a canonical step number in a given flow.
 * Returns undefined when the step is not part of the flow.
 */
export const getDisplayNumber = (stepNumber, { ruleset } = {}) =>
  getVisibleSteps({ ruleset }).find((step) => step.step === stepNumber)?.displayNumber;

/**
 * Get the step configuration for a given step number.
 */
export const getStepConfig = (stepNumber) => WIZARD_STEPS.find((step) => step.step === stepNumber);

/**
 * Cause sentence shown on every ladder-disabled wizard control (sidebar tabs,
 * sidebar ✓ Save, edit-mode footer Save Changes): names the first step the
 * valid-prefix ladder is waiting on, using the CURRENT ruleset flow's titles.
 * Returns undefined when nothing blocks the ladder (null firstInvalidStep —
 * e.g. a caps-only Save disablement, which owns its own messaging via
 * getSaveCauseTitle) or when the blocking step is not part of the visible
 * flow (stale mid-switch render).
 */
export const getLadderCauseTitle = (firstInvalidStep, { ruleset } = {}) => {
  if (firstInvalidStep == null) return undefined;
  const title = getVisibleSteps({ ruleset }).find((step) => step.step === firstInvalidStep)?.title;
  return title ? `Complete "${title}" first` : undefined;
};

/**
 * Cause sentence shown on BOTH save controls (sidebar ✓ Save and the
 * edit-mode footer Save Changes) while the Save gate is closed. Mirrors the
 * ladder idiom above so a disabled Save always names its cause: a ladder
 * break wins (it is what blocks navigation too); otherwise the caps lanes
 * that close the belt say so — a disk-loaded or ruleset-switched over-cap
 * draft used to leave both buttons disabled with a NULL title.
 * Returns undefined only when nothing blocks Save at all.
 *
 * @param {object} options
 * @param {number|null} options.firstInvalidStep - Ladder blocker (see above).
 * @param {string} options.ruleset - Current flow's ruleset for step titles.
 * @param {boolean} options.abilityCapBroken - Any ability total over cap.
 * @param {boolean} options.selectionCapBroken - Feats/skills over their slots.
 */
export const getSaveCauseTitle = ({
  firstInvalidStep = null,
  ruleset,
  abilityCapBroken = false,
  selectionCapBroken = false,
} = {}) => {
  const ladder = getLadderCauseTitle(firstInvalidStep, { ruleset });
  if (ladder) return ladder;
  const lanes = [];
  if (abilityCapBroken) lanes.push('ability totals');
  if (selectionCapBroken) lanes.push('feats/skills');
  if (lanes.length === 0) return undefined;
  const phrase = lanes.join(' and ');
  return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} exceed the rules limit — fix highlighted steps`;
};

