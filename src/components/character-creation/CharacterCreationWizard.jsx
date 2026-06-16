import React, { useState, useCallback, useEffect } from 'react';
import './CharacterCreationWizard.css';
import { validateStep, validateFinalFormData } from '../../config/utils.js';
import WizardHeader from './WizardHeader.jsx';
import WizardProgressBar from './WizardProgressBar.jsx';
import WizardFooter from './WizardFooter.jsx';
import WizardSidebar from './WizardSidebar.jsx';
import { WIZARD_STEPS, getTotalSteps } from '../../config/steps-config.js';
import useWizardForm from '../../hooks/wizard/useWizardForm.js';
import useWizardData from '../../hooks/wizard/useWizardData.js';
import useWizardNavigation from '../../hooks/wizard/useWizardNavigation.js';
import useWizardSkills from '../../hooks/wizard/useWizardSkills.js';
import useWizardLanguages from '../../hooks/wizard/useWizardLanguages.js';
import useWizardResistances from '../../hooks/wizard/useWizardResistances.js';
import useWizardFeats from '../../hooks/wizard/useWizardFeats.js';
import useWizardFeatBuffs from '../../hooks/wizard/useWizardFeatBuffs.js';
import useWizardSpells from '../../hooks/wizard/useWizardSpells.js';
import useWizardBackgroundAbility from '../../hooks/wizard/useWizardBackgroundAbility.js';

import useWizardAbilities from '../../hooks/wizard/useWizardAbilities.js';
import useWizardArrayToggle from '../../hooks/wizard/useWizardArrayToggle.js';

const WizardStepRenderer = React.memo(({
  currentStep,
  ruleset,
  errors,
  formData,
  backgrounds,
  racesData,
  classSubtypes,
  allClasses,
  feats,
  magicItems,
  allSpells,
  preSelectedFeats,
  computedBuffs,
  preSelectedSpells,
  preSelectedSkills,
  preSelectedLanguages,
  preSelectedFightingStyles,
  preSelectedResistances,
  preSelectedImmunities,
  _preSelectedBackgroundAbility,
  bgAbilityNames,
  bgAbilityAssignments,
  bgValidationWarnings,
  skillLimits,
  expertiseLimits,
  skillWarnings,
  languageLimits,
  fightingStyleLimits,
  languageWarnings,
  resistanceWarnings,
  tempInventory,
  onRulesetChange,
  onInputChange,
  onArrayFieldChange,
  onInventoryChange,
  onTempInventoryChange,
  onAbilityBaseScoreChange,
  onAbilityImprovementChange,
  onAbilityMiscBonusChange,
  onSkillToggle,
  onSkillExpertiseToggle,
  onLanguageToggle,
  onFightingStyleToggle,
  onResistanceToggle,
  onImmunityToggle,
  warnings,
  allFeats,
  allMagicItems,
  updateBgAbilityBonus,
}) => {
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
    allClasses,
    feats,
    magicItems,
    allSpells,
    preSelectedFeats,
    computedBuffs,
    preSelectedSpells,
    preSelectedSkills,
    preSelectedLanguages,
    preSelectedFightingStyles,
    preSelectedResistances,
    preSelectedImmunities,
    _preSelectedBackgroundAbility,
    bgAbilityNames,
    bgAbilityAssignments,
    bgValidationWarnings,
    skillLimits,
    expertiseLimits,
    skillWarnings,
    languageLimits,
    fightingStyleLimits,
    languageWarnings,
    resistanceWarnings,
    tempInventory,
    onRulesetChange,
    onInputChange,
    onArrayFieldChange,
    onInventoryChange,
    onTempInventoryChange,
    onAbilityBaseScoreChange,
    onAbilityImprovementChange,
    onAbilityMiscBonusChange,
    onSkillToggle,
    onSkillExpertiseToggle,
    onLanguageToggle,
    onFightingStyleToggle,
    onResistanceToggle,
    onImmunityToggle,
    warnings,
    allFeats,
    allMagicItems,
    updateBgAbilityBonus,
  });

  return <StepComponent {...props} />;
});
WizardStepRenderer.displayName = 'WizardStepRenderer';

function CharacterCreationWizard({ onComplete, onCancel, allSpells, allClasses, characterData, isEditing = false }) {
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
   } = useWizardData(ruleset);

  // Navigation
  const {
    currentStep,
    isNextDisabled,
    navigateNext,
    navigatePrevious,
    goToStep,
    getStepEnabled,
    isSaveEnabled,
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

  // Feat buffs (applies ability score increases, proficiencies, etc.)
  const { computedBuffs } = useWizardFeatBuffs(formData, feats, setFormData);

  // Spells
  const {
    preSelectedSpells,
     } = useWizardSpells(formData, setFormData);

  // Background ability score choice (2024)
  const { bgAbilityNames, bgAbilityAssignments, updateBgAbilityBonus, bgValidationWarnings } = useWizardBackgroundAbility(formData, setFormData);

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

    // Resistances - Pattern A: preSelectedResistancesList from useWizardResistances
    const { toggleItem: handleResistanceToggle } = useWizardArrayToggle(
      setFormData, setErrors, 'resistances', preSelectedResistancesList.resistances
    );

    // Immunities - Pattern A: preSelectedResistancesList from useWizardResistances
    const { toggleItem: handleImmunityToggle } = useWizardArrayToggle(
      setFormData, setErrors, 'immunities', preSelectedResistancesList.immunities
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
    return (
      <WizardStepRenderer
        currentStep={currentStep}
        ruleset={ruleset}
        errors={errors}
        formData={formData}
        backgrounds={backgrounds}
        racesData={racesData}
        classSubtypes={classSubtypes}
        allClasses={allClasses}
        feats={feats}
        magicItems={magicItems}
        allSpells={allSpells}
        preSelectedFeats={preSelectedFeats}
        computedBuffs={computedBuffs}
        preSelectedSpells={preSelectedSpells}
        preSelectedSkills={preSelectedSkills}
        preSelectedLanguages={preSelectedLanguages}
        preSelectedFightingStyles={preSelectedFightingStyles}
        preSelectedResistances={preSelectedResistancesList.resistances}
        preSelectedImmunities={preSelectedResistancesList.immunities}
        bgAbilityNames={bgAbilityNames}
        bgAbilityAssignments={bgAbilityAssignments}
        bgValidationWarnings={bgValidationWarnings}
        skillLimits={skillLimits}
        expertiseLimits={expertiseLimits}
        skillWarnings={skillWarnings}
        languageLimits={languageLimits}
        fightingStyleLimits={fightingStyleLimits}
        languageWarnings={languageWarnings}
        resistanceWarnings={resistanceWarnings}
        tempInventory={tempInventory}
        onRulesetChange={handleRulesetChange}
        onInputChange={updateField}
        onArrayFieldChange={updateArrayField}
        onInventoryChange={updateInventory}
        onTempInventoryChange={updateTempInventory}
        onAbilityBaseScoreChange={onAbilityBaseScoreChange}
        onAbilityImprovementChange={onAbilityImprovementChange}
        onAbilityMiscBonusChange={onAbilityMiscBonusChange}
        onSkillToggle={handleSkillToggle}
        onSkillExpertiseToggle={handleSkillExpertiseToggle}
        onLanguageToggle={handleLanguageToggle}
        onFightingStyleToggle={handleFightingStyleToggle}
        onResistanceToggle={handleResistanceToggle}
        onImmunityToggle={handleImmunityToggle}
        warnings={skillWarnings}
        allFeats={feats}
        allMagicItems={magicItems}
        updateBgAbilityBonus={updateBgAbilityBonus}
      />
    );
  }, [
    currentStep,
    ruleset,
    errors,
    formData,
    backgrounds,
    racesData,
    classSubtypes,
    allClasses,
    feats,
    magicItems,
    allSpells,
    preSelectedFeats,
    computedBuffs,
    preSelectedSkills,
    preSelectedLanguages,
    preSelectedFightingStyles,
    preSelectedResistancesList,
    preSelectedSpells,
    bgAbilityNames,
    bgAbilityAssignments,
    bgValidationWarnings,
    skillLimits,
    expertiseLimits,
    skillWarnings,
    languageLimits,
    fightingStyleLimits,
    languageWarnings,
    resistanceWarnings,
    tempInventory,
    handleRulesetChange,
    updateField,
    updateArrayField,
    updateInventory,
    updateTempInventory,
    onAbilityBaseScoreChange,
    onAbilityImprovementChange,
    onAbilityMiscBonusChange,
    handleSkillToggle,
    handleSkillExpertiseToggle,
    handleLanguageToggle,
    handleFightingStyleToggle,
    handleResistanceToggle,
    handleImmunityToggle,
    updateBgAbilityBonus,
  ]);

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
          <div className="wizard-body">
            <WizardSidebar
              currentStep={currentStep}
              isEditing={isEditing}
              getStepEnabled={getStepEnabled}
              goToStep={goToStep}
              isSaveEnabled={isSaveEnabled}
              onSave={handleSubmit}
            />
            <div className="wizard-content">
              {renderStep()}
            </div>
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