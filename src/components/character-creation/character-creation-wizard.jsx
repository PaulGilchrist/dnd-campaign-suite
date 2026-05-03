import React, { useState, useCallback, useEffect } from 'react';
import './character-creation-wizard.css';
import { validateStep, validateFinalFormData, getPointBuyCosts } from './utils';
import WizardHeader from './wizard-header';
import WizardProgressBar from './wizard-progress-bar';
import WizardFooter from './wizard-footer';
import { WIZARD_STEPS, getTotalSteps } from './steps-config';
import useWizardForm from './use-wizard-form';
import useWizardData from './use-wizard-data';
import useWizardNavigation from './use-wizard-navigation';
import useWizardSkills from './use-wizard-skills';
import useWizardLanguages from './use-wizard-languages';
import useWizardResistances from './use-wizard-resistances';
import useWizardFeats from './use-wizard-feats';

import useWizardAbilities from './use-wizard-abilities';
import useWizardArrayToggle from '../../hooks/use-wizard-array-toggle';

function CharacterCreationWizard({ onComplete, onCancel, allRaces, allClasses, allSpells, allSpells2024, characterData, isEditing = false }) {
  // Core form state
  const {
    formData,
    errors,
    setFormData,
    setErrors,
    updateField,
    updateArrayField,
    updateAbility,
    updateInventory,
    updateClass,
    resetErrors,
   } = useWizardForm(characterData, isEditing);

  // Ruleset state (needed by data hook)
  const [ruleset, setRuleset] = useState(characterData?.rules ?? null);

  // Load data based on ruleset
  const {
    backgrounds,
    racesData,
    classSubtypes,
    feats,
    magicItems,
    isDataLoading,
   } = useWizardData(ruleset);

  // Navigation
  const {
    currentStep,
    isNextDisabled,
    navigateNext,
    navigatePrevious,
    goToStep,
   } = useWizardNavigation(isEditing ? 2 : 1, formData, racesData, classSubtypes, ruleset);

  // Skills
  const {
    skillLimits,
    expertiseLimits,
    skillWarnings,
    preSelectedSkills,
   } = useWizardSkills(formData, setFormData);

  // Languages & Fighting Styles
  const {
    languageLimits,
    fightingStyleLimits,
    languageWarnings,
    preSelectedLanguages,
    preSelectedFightingStyles,
   } = useWizardLanguages(formData);

  // Resistances
  const {
    resistanceWarnings,
    preSelectedResistancesList,
   } = useWizardResistances(formData, setFormData);

  // Feats
  const {
    preSelectedFeats,
   } = useWizardFeats(formData, setFormData);

	// Inventory
	const [tempInventory, setTempInventory] = useState({ backpack: [], equipped: [] });

	useEffect(() => {
		setTempInventory({
			backpack: formData.inventory?.backpack || [],
			equipped: formData.inventory?.equipped || [],
		});
	}, [formData.inventory]);

	const updateTempInventory = useCallback((field, value) => {
		setTempInventory(prev => ({ ...prev, [field]: value }));
	}, []);

   // Abilities validation
  const {
    onAbilityBaseScoreChange,
    onAbilityImprovementChange,
    onAbilityMiscBonusChange,
  } = useWizardAbilities(formData, currentStep, setErrors, updateAbility);

   // Handlers
  const handleRulesetChange = useCallback(async (newRuleset) => {
    setRuleset(newRuleset);

    if (newRuleset === '2024') {
      setFormData(prev => ({
           ...prev,
        rules: '2024',
        spells: [],
        feats: [],
        background: ''
         }));
       } else {
      setFormData(prev => ({
           ...prev,
        rules: '5e',
        spells: [],
        feats: [],
        background: ''
         }));
       }

    goToStep(2);
    }, [setFormData, goToStep]);

    // Skills - Pattern A: preSelectedItems from closure
   const { toggleItem: handleSkillToggle } = useWizardArrayToggle(
     setFormData, setErrors, 'skillProficiencies', preSelectedSkills
   );

   // Expert Skills - Pattern B: force add/remove via setItem/removeItem
   const { setItem: addExpertSkill, removeItem: removeExpertSkill } = useWizardArrayToggle(
     setFormData, setErrors, 'expertSkills'
   );
   const handleSkillExpertiseToggle = useCallback(
      (skill, isExpert) => isExpert ? addExpertSkill(skill) : removeExpertSkill(skill),
      [addExpertSkill, removeExpertSkill]
   );

   // Languages - Pattern A: preSelectedItems from closure
   const { toggleItem: handleLanguageToggle } = useWizardArrayToggle(
     setFormData, setErrors, 'languages', preSelectedLanguages
   );

   // Fighting Styles - Pattern A, nested field
   const { toggleItem: handleFightingStyleToggle } = useWizardArrayToggle(
     setFormData, setErrors, 'class.fightingStyles', preSelectedFightingStyles
   );

   // Resistances - Pattern C: boolean param guard
   const { toggleItem: handleResistanceToggle } = useWizardArrayToggle(
     setFormData, setErrors, 'resistances'
   );

   // Immunities - Pattern C: boolean param guard
   const { toggleItem: handleImmunityToggle } = useWizardArrayToggle(
     setFormData, setErrors, 'immunities'
   );

  const handleNext = useCallback(async () => {
    const success = await navigateNext();
    if (success) {
      resetErrors();
       }
     }, [navigateNext, resetErrors]);

  const handleSubmit = useCallback(async () => {
    const stepErrors = await validateStep(currentStep, formData, {}, racesData, classSubtypes, ruleset);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
        }
    const finalErrors = validateFinalFormData(formData);
    if (Object.keys(finalErrors).length > 0) {
      setErrors(finalErrors);
      return;
        }
    onComplete(formData);
      }, [currentStep, formData, racesData, classSubtypes, ruleset, onComplete, setErrors]);

  const renderStep = useCallback(() => {
    const stepConfig = WIZARD_STEPS.find((step) => step.step === currentStep);
    if (!stepConfig) {
        return null;
      }

    const StepComponent = stepConfig.component;
    const props = stepConfig.getProps({
      ruleset,
      errors,
      formData,
      backgrounds,
      racesData,
      classSubtypes,
      feats,
      magicItems,
      allSpells,
      preSelectedFeats,
      preSelectedSkills,
      preSelectedLanguages,
      preSelectedFightingStyles,
      preSelectedResistances: preSelectedResistancesList.resistances,
      preSelectedImmunities: preSelectedResistancesList.immunities,
      skillLimits,
      expertiseLimits,
      skillWarnings,
      languageLimits,
      fightingStyleLimits,
      languageWarnings,
      resistanceWarnings,
      tempInventory,
      onRulesetChange: handleRulesetChange,
      onInputChange: updateField,
      onArrayFieldChange: updateArrayField,
      onInventoryChange: updateInventory,
      onTempInventoryChange: updateTempInventory,
      onAbilityBaseScoreChange,
      onAbilityImprovementChange,
      onAbilityMiscBonusChange,
      onSkillToggle: handleSkillToggle,
      onSkillExpertiseToggle: handleSkillExpertiseToggle,
      onLanguageToggle: handleLanguageToggle,
      onFightingStyleToggle: handleFightingStyleToggle,
      onResistanceToggle: handleResistanceToggle,
      onImmunityToggle: handleImmunityToggle,
      warnings: skillWarnings,
      allFeats: feats,
      allMagicItems: magicItems,
      });

    return <StepComponent {...props} />;
     }, [currentStep, ruleset, errors, formData, backgrounds, racesData, classSubtypes, feats, magicItems,
    preSelectedFeats, preSelectedSkills, preSelectedLanguages, preSelectedFightingStyles,
    preSelectedResistancesList, skillLimits, expertiseLimits, skillWarnings,
    languageLimits, fightingStyleLimits, languageWarnings, resistanceWarnings,
    tempInventory, allSpells,
    handleRulesetChange, updateField, updateArrayField, updateInventory, updateTempInventory,
    onAbilityBaseScoreChange, onAbilityImprovementChange, onAbilityMiscBonusChange,
    handleSkillToggle, handleSkillExpertiseToggle, handleLanguageToggle, handleFightingStyleToggle,
    handleResistanceToggle, handleImmunityToggle]);

  const totalSteps = getTotalSteps();

  return (
      <div className="character-creation-wizard-overlay">
        <div className="character-creation-wizard">
          <WizardHeader
          title={isEditing ? "Edit Character" : "Create New Character"}
          onClose={onCancel}
          />
          <WizardProgressBar
          currentStep={currentStep}
          totalSteps={totalSteps}
          isEditing={isEditing}
          />
          <div className="wizard-content">
            {renderStep()}
          </div>
          <WizardFooter
          currentStep={currentStep}
          isFirstStep={isEditing ? currentStep === 2 : currentStep === 1}
          isLastStep={currentStep === totalSteps}
          onCancel={onCancel}
          onPrevious={navigatePrevious}
          onNext={handleNext}
          onSubmit={handleSubmit}
          isEditing={isEditing}
          isNextDisabled={isNextDisabled}
          />
        </div>
      </div>
     );
}

export default CharacterCreationWizard;