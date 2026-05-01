import React, { useState, useCallback } from 'react';
import './character-creation-wizard.css';
import './character-creation-wizard-dark.css';
import { validateStep, validateFinalFormData, getPointBuyCosts } from './utils';
import WizardHeader from './wizard-header';
import WizardProgressBar from './wizard-progress-bar';
import WizardFooter from './wizard-footer';
import WizardStepRules from './wizard-step-rules';
import WizardStepBasic from './wizard-step-basic';
import WizardStepRaceClass from './wizard-step-race-class';
import WizardStepAbilities from './wizard-step-abilities';
import WizardStepSkills from './wizard-step-skills';
import WizardStepLanguages from './wizard-step-languages';
import WizardStepInventory from './wizard-step-inventory';
import WizardStepSpells from './wizard-step-spells';
import WizardStepFeats from './wizard-step-feats';
import WizardStepSpecial from './wizard-step-special';
import WizardStepResistances from './wizard-step-resistances';
import WizardStepMagicItems from './wizard-step-magic-items';

import useWizardForm from './use-wizard-form';
import useWizardData from './use-wizard-data';
import useWizardNavigation from './use-wizard-navigation';
import useWizardSkills from './use-wizard-skills';
import useWizardLanguages from './use-wizard-languages';
import useWizardResistances from './use-wizard-resistances';
import useWizardFeats from './use-wizard-feats';
import useWizardInventory from './use-wizard-inventory';
import useWizardAbilities from './use-wizard-abilities';

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
  const {
    tempInventory,
    updateTempInventory,
   } = useWizardInventory(formData);

  // Abilities validation
  useWizardAbilities(formData, currentStep, setErrors);

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

  const handleAbilityBaseScoreChange = useCallback(async (index, value) => {
    const newBaseScore = parseInt(value) || 8;
    const oldBaseScore = parseInt(formData.abilities[index].baseScore) || 8;

    const rules = await getPointBuyCosts(formData.rules || '5e');
    const calculateCost = (score) => rules[score] || 0;

    const newCost = calculateCost(newBaseScore);
    const oldCost = calculateCost(oldBaseScore);

    const currentTotalSpent = formData.abilities.reduce((sum, ability, i) => {
      if (i === index) {
        return sum + newCost;
         }
      const baseScore = parseInt(ability.baseScore) || 8;
      const cost = calculateCost(baseScore);
      return sum + cost;
       }, 0);

    if (currentTotalSpent <= 27) {
      updateAbility(index, 'baseScore', newBaseScore);
       }
     }, [formData.abilities, formData.rules, updateAbility]);

  const handleAbilityImprovementChange = useCallback((index, value) => {
    updateAbility(index, 'abilityImprovements', value);
    }, [updateAbility]);

  const handleAbilityMiscBonusChange = useCallback((index, value) => {
    updateAbility(index, 'miscBonus', value);
    }, [updateAbility]);

  const handleSkillToggle = useCallback((skill) => {
    setFormData(prev => {
      const currentSkills = prev.skillProficiencies || [];
      const isPreSelected = preSelectedSkills.includes(skill);
      const isCurrentlySelected = currentSkills.includes(skill);

      if (isCurrentlySelected && isPreSelected) {
        return prev;
         }

      const newSkills = isCurrentlySelected
           ? currentSkills.filter(s => s !== skill)
           : [...currentSkills, skill];
      return { ...prev, skillProficiencies: newSkills };
       });
    setErrors(prev => ({ ...prev, skillProficiencies: null }));
    }, [preSelectedSkills, setFormData, setErrors]);

  const handleSkillExpertiseToggle = useCallback((skill, isExpert) => {
    setFormData(prev => {
      if (isExpert) {
        const currentExpertSkills = prev.expertSkills || [];
        const newExpertSkills = [...currentExpertSkills, skill];
        return { ...prev, expertSkills: newExpertSkills };
         } else {
        const currentExpertSkills = prev.expertSkills || [];
        const newExpertSkills = currentExpertSkills.filter(s => s !== skill);
        return { ...prev, expertSkills: newExpertSkills };
         }
       });
    setErrors(prev => ({ ...prev, expertSkills: null }));
    }, [setFormData, setErrors]);

  const handleLanguageToggle = useCallback((language) => {
    setFormData(prev => {
      const currentLanguages = prev.languages || [];
      const isPreSelected = preSelectedLanguages.includes(language);
      const isCurrentlySelected = currentLanguages.includes(language);

      if (isCurrentlySelected && isPreSelected) {
        return prev;
         }

      const newLanguages = currentLanguages.includes(language)
           ? currentLanguages.filter(l => l !== language)
           : [...currentLanguages, language];
      return { ...prev, languages: newLanguages };
       });
    setErrors(prev => ({ ...prev, languages: null }));
    }, [preSelectedLanguages, setFormData, setErrors]);

  const handleFightingStyleToggle = useCallback((style) => {
    setFormData(prev => {
      const currentStyles = prev.class?.fightingStyles || [];
      const isPreSelected = preSelectedFightingStyles.includes(style);
      const isCurrentlySelected = currentStyles.includes(style);

      if (isCurrentlySelected && isPreSelected) {
        return prev;
         }

      const newStyles = currentStyles.includes(style)
           ? currentStyles.filter(s => s !== style)
           : [...currentStyles, style];
      return { ...prev, class: { ...prev.class, fightingStyles: newStyles } };
       });
    setErrors(prev => ({ ...prev, fightingStyles: null }));
    }, [preSelectedFightingStyles, setFormData, setErrors]);

  const handleResistanceToggle = useCallback((type, isPreSelected) => {
    if (isPreSelected) {
      return;
       }

    setFormData(prev => {
      const currentResistances = prev.resistances || [];
      const newResistances = currentResistances.includes(type)
           ? currentResistances.filter(r => r !== type)
           : [...currentResistances, type];
      return { ...prev, resistances: newResistances };
       });
    setErrors(prev => ({ ...prev, resistances: null }));
    }, [setFormData, setErrors]);

  const handleImmunityToggle = useCallback((type, isPreSelected) => {
    if (isPreSelected) {
      return;
       }

    setFormData(prev => {
      const currentImmunities = prev.immunities || [];
      const newImmunities = currentImmunities.includes(type)
           ? currentImmunities.filter(i => i !== type)
           : [...currentImmunities, type];
      return { ...prev, immunities: newImmunities };
       });
    setErrors(prev => ({ ...prev, immunities: null }));
    }, [setFormData, setErrors]);

  const handleNext = useCallback(async () => {
    const success = await navigateNext();
    if (success) {
      resetErrors();
       }
     }, [navigateNext, resetErrors]);

  const handleSubmit = useCallback(async () => {
    const stepErrors = await validateStep(currentStep, formData, {}, racesData, classSubtypes, ruleset);
    if (Object.keys(stepErrors).length === 0) {
      const finalErrors = validateFinalFormData(formData);
      if (Object.keys(finalErrors).length > 0) {
        setErrors(finalErrors);
        return;
         }
      onComplete(formData);
       }
     }, [currentStep, formData, racesData, classSubtypes, ruleset, onComplete, setErrors]);

  const renderStep = useCallback(() => {
    switch (currentStep) {
      case 1:
        return (
             <WizardStepRules
            ruleset={ruleset}
            errors={errors}
            onRulesetChange={handleRulesetChange}
            />
           );
      case 2:
        return (
             <WizardStepBasic
            formData={formData}
            errors={errors}
            backgrounds={backgrounds}
            ruleset={ruleset}
            onInputChange={updateField}
            />
           );
      case 3:
        return (
             <WizardStepRaceClass
            formData={formData}
            errors={errors}
            racesData={racesData}
            classSubtypes={classSubtypes}
            ruleset={ruleset}
            onInputChange={updateField}
            />
           );
      case 4:
        return (
             <WizardStepFeats
            formData={formData}
            allFeats={feats}
            onArrayFieldChange={updateArrayField}
            preSelectedFeats={preSelectedFeats}
            />
           );
      case 5:
        return (
             <WizardStepAbilities
            formData={formData}
            errors={errors}
            onAbilityBaseScoreChange={handleAbilityBaseScoreChange}
            onAbilityImprovementChange={handleAbilityImprovementChange}
            onAbilityMiscBonusChange={handleAbilityMiscBonusChange}
            />
           );
      case 6:
        return (
             <WizardStepSkills
            formData={formData}
            errors={errors}
            onSkillToggle={handleSkillToggle}
            onSkillExpertiseToggle={handleSkillExpertiseToggle}
            skillLimits={skillLimits}
            expertiseLimits={expertiseLimits}
            warnings={skillWarnings}
            preSelectedSkills={preSelectedSkills}
            />
           );
      case 7:
        return (
             <WizardStepLanguages
            formData={formData}
            errors={errors}
            onLanguageToggle={handleLanguageToggle}
            onFightingStyleToggle={handleFightingStyleToggle}
            languageLimits={languageLimits}
            fightingStyleLimits={fightingStyleLimits}
            warnings={languageWarnings}
            preSelectedLanguages={preSelectedLanguages}
            preSelectedFightingStyles={preSelectedFightingStyles}
            />
           );
      case 8:
        return (
             <WizardStepResistances
            formData={formData}
            onResistanceToggle={handleResistanceToggle}
            onImmunityToggle={handleImmunityToggle}
            warnings={resistanceWarnings}
            preSelectedResistances={preSelectedResistancesList.resistances}
            preSelectedImmunities={preSelectedResistancesList.immunities}
            />
           );
      case 9:
        return (
             <WizardStepSpells
            formData={formData}
            allSpells={allSpells || []}
            onArrayFieldChange={updateArrayField}
            />
           );
      case 10:
        return (
             <WizardStepMagicItems
            formData={formData}
            allMagicItems={magicItems}
            ruleset={ruleset}
            onArrayFieldChange={updateArrayField}
            />
           );
      case 11:
        return (
             <WizardStepInventory
            formData={formData}
            tempInventory={tempInventory}
            onInventoryChange={updateInventory}
            onTempInventoryChange={updateTempInventory}
            />
           );
      case 12:
        return (
             <WizardStepSpecial
            formData={formData}
            onArrayFieldChange={updateArrayField}
            />
           );
      default:
        return null;
      }
     }, [currentStep, ruleset, errors, formData, backgrounds, racesData, classSubtypes, feats, magicItems,
    preSelectedFeats, preSelectedSkills, preSelectedLanguages, preSelectedFightingStyles,
    preSelectedResistancesList, skillLimits, expertiseLimits, skillWarnings,
    languageLimits, fightingStyleLimits, languageWarnings, resistanceWarnings,
    tempInventory, allSpells,
    handleRulesetChange, updateField, updateArrayField, updateInventory, updateTempInventory,
    handleAbilityBaseScoreChange, handleAbilityImprovementChange, handleAbilityMiscBonusChange,
    handleSkillToggle, handleSkillExpertiseToggle, handleLanguageToggle, handleFightingStyleToggle,
    handleResistanceToggle, handleImmunityToggle]);

  return (
      <div className="character-creation-wizard-overlay">
        <div className="character-creation-wizard">
          <WizardHeader
          title={isEditing ? "Edit Character" : "Create New Character"}
          onClose={onCancel}
          />
          <WizardProgressBar
          currentStep={currentStep}
          totalSteps={12}
          isEditing={isEditing}
          />
          <div className="wizard-content">
            {renderStep()}
          </div>
          <WizardFooter
          currentStep={currentStep}
          isFirstStep={isEditing ? currentStep === 2 : currentStep === 1}
          isLastStep={currentStep === 12}
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