import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import './CharacterCreationWizard.css';
import { validateStep, validateFinalFormData, validateAbilityTotals, hasDuplicateCharacterName, DUPLICATE_CHARACTER_NAME_ERROR, CHARACTER_NAME_REQUIRED_ERROR } from '../../config/utils.js';
import WizardHeader from './WizardHeader.jsx';
import WizardProgressBar from './WizardProgressBar.jsx';
import WizardFooter from './WizardFooter.jsx';
import WizardSidebar from './WizardSidebar.jsx';
import { WIZARD_STEPS, getVisibleSteps } from '../../config/steps-config.js';
import useWizardForm from '../../hooks/wizard/useWizardForm.js';
import useWizardData from '../../hooks/wizard/useWizardData.js';
import useWizardNavigation from '../../hooks/wizard/useWizardNavigation.js';
import useWizardSkills from '../../hooks/wizard/useWizardSkills.js';
import useWizardTools from '../../hooks/wizard/useWizardTools.js';
import useWizardLanguages from '../../hooks/wizard/useWizardLanguages.js';
import useWizardResistances from '../../hooks/wizard/useWizardResistances.js';
import useWizardFeats from '../../hooks/wizard/useWizardFeats.js';
import useWizardFeatBuffs from '../../hooks/wizard/useWizardFeatBuffs.js';
import useWizardSpells from '../../hooks/wizard/useWizardSpells.js';
import useWizardBackgroundAbility from '../../hooks/wizard/useWizardBackgroundAbility.js';

import useWizardAbilities from '../../hooks/wizard/useWizardAbilities.js';
import useWizardArrayToggle from '../../hooks/wizard/useWizardArrayToggle.js';
import useWizardFeatAbilityChoices from '../../hooks/wizard/useWizardFeatAbilityChoices.js';

const WizardStepRenderer = React.memo(({
  currentStep,
  stepNumber,
  ruleset,
  errors,
  formData,
  campaignName,
  backgrounds,
  racesData,
  allRacesData,
  classSubtypes,
  allClassesData,
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
  backgroundAbilityNames,
  backgroundAbilityAssignments,
  backgroundValidationWarnings,
  skillLimits,
  expertiseLimits,
  skillWarnings,
  toolLimits,
  toolWarnings,
  preSelectedTools,
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
  onAbilityMiscIncreaseChange,
  onSkillToggle,
  onSkillExpertiseToggle,
  onToolToggle,
  onLanguageToggle,
  onFightingStyleToggle,
  onResistanceToggle,
  onImmunityToggle,
  warnings,
  allFeats,
  allMagicItems,
  updateBackgroundIncrease,
  featAbilityChoices,
  featAbilityAssignments,
  handleFeatAbilityChoice,
  onFeatAbilityModeChange,
  allClasses: _allClasses,
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
    campaignName,
    backgrounds,
    racesData,
    allRacesData,
    classSubtypes: classSubtypes,
    allClassesData,
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
    backgroundAbilityNames,
    backgroundAbilityAssignments,
    backgroundValidationWarnings,
    skillLimits,
    expertiseLimits,
    skillWarnings,
    toolLimits,
    toolWarnings,
    preSelectedTools,
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
    onAbilityMiscIncreaseChange,
    onSkillToggle,
    onSkillExpertiseToggle,
    onToolToggle,
    onLanguageToggle,
    onFightingStyleToggle,
    onResistanceToggle,
    onImmunityToggle,
    warnings,
    allFeats,
    allMagicItems,
    updateBackgroundIncrease,
    featAbilityChoices,
    featAbilityAssignments,
    handleFeatAbilityChoice,
    onFeatAbilityChoiceChange: handleFeatAbilityChoice,
    onFeatAbilityModeChange,
  });

  return <StepComponent stepNumber={stepNumber} {...props} />;
});
WizardStepRenderer.displayName = 'WizardStepRenderer';

function CharacterCreationWizard({ onComplete, onCancel, allClasses, characterData, isEditing = false, campaignName, existingCharacters = [] }) {
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

  // Unsaved-changes guard: deep-compare formData against the initial draft
  // snapshot on any close request (footer Cancel / header ×). A modified
  // draft asks for confirmation that names the character (house NAMED-confirm
  // pattern, mirrors the delete confirms); an unmodified draft closes
  // silently. Post-save the parent unmounts the wizard, so no double-prompt.
  const initialSnapshotRef = useRef(null);
  if (initialSnapshotRef.current === null) {
    initialSnapshotRef.current = cloneDeep(formData);
  }

  const handleRequestClose = useCallback(() => {
    if (!isEqual(formData, initialSnapshotRef.current)) {
      const trimmedName = (formData.name || '').trim();
      const message = isEditing
        ? `Discard changes to "${trimmedName || characterData?.name || 'this character'}"?`
        : trimmedName
          ? `Discard changes to "${trimmedName}"?`
          : 'Discard this new character draft?';
      if (!window.confirm(message)) {
        return;
      }
    }
    onCancel();
  }, [formData, isEditing, characterData, onCancel]);

  // Ruleset state (needed by data hook)
  const [ruleset, setRuleset] = useState(characterData?.rules ?? null);

  // Load spells based on character's ruleset
  const [allSpells, setAllSpells] = useState([]);
  useEffect(() => {
    const loadSpells = async () => {
      const spellRuleset = ruleset || '5e';
      const path = spellRuleset === '2024' ? '/data/2024/spells.json' : '/data/spells.json';
      try {
        const response = await fetch(path);
        const spells = await response.json();
        setAllSpells(spells);
      } catch (error) {
        console.error('Error loading spells:', error);
        setAllSpells([]);
      }
    };
    loadSpells();
  }, [ruleset]);

  // Load data based on ruleset
  const {
    backgrounds,
    racesData,
    allRacesData,
    classSubtypes,
    allClassesData,
    feats,
    magicItems,
   } = useWizardData(ruleset);

  // Duplicate-name guard (mirrors NPCs/Quests/Factions): existing character
  // names in this campaign, excluding the character being edited (self-exempt).
  const existingNames = useMemo(() => {
    const selfName = (characterData?.name || '').trim().toLowerCase();
    return (existingCharacters || [])
      .map(c => (typeof c === 'string' ? c : c?.name) || '')
      .filter(n => n.trim() && (!isEditing || n.trim().toLowerCase() !== selfName));
  }, [existingCharacters, characterData, isEditing]);

  // Live inline name error on Step 2: blank/whitespace → required hint,
  // collision → duplicate hint, valid → cleared. Mirrors NPCs/Quests/Factions
  // (updateField clears errors.name on each keystroke — this re-arms it while
  // the name is still invalid). Only writes when the message actually changes
  // so the happy path stays untouched. Rendered inline by WizardStepBasic's
  // existing `.error-message` span beneath the name input.
  useEffect(() => {
    const trimmedName = (formData.name || '').trim();
    let expectedNameError = null;
    if (!trimmedName) {
      expectedNameError = CHARACTER_NAME_REQUIRED_ERROR;
    } else if (hasDuplicateCharacterName(formData.name, existingNames)) {
      expectedNameError = DUPLICATE_CHARACTER_NAME_ERROR;
    }
    // Write only to raise/change a live name message, or to clear one this
    // guard owns — never churn errors owned by other validators.
    const isLiveNameError = errors.name === DUPLICATE_CHARACTER_NAME_ERROR || errors.name === CHARACTER_NAME_REQUIRED_ERROR;
    if (expectedNameError ? errors.name !== expectedNameError : isLiveNameError) {
      setErrors({ ...errors, name: expectedNameError });
    }
  }, [formData.name, existingNames, errors, setErrors]);

  // Navigation
  const {
    currentStep,
    isNextDisabled,
    navigateNext,
    navigatePrevious,
    goToStep,
    getStepEnabled,
    isSaveEnabled,
   } = useWizardNavigation(isEditing ? 2 : 1, formData, racesData, { classSubtypes, ruleset, allFeats: feats, existingNames });

  // Skills
  const {
    skillLimits,
    expertiseLimits,
    skillWarnings,
    preSelectedSkills,
   } = useWizardSkills(formData, setFormData, feats);

   // Tool Proficiencies
   const {
     toolLimits,
     toolWarnings,
     preSelectedTools,
    } = useWizardTools(formData, setFormData);

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
  const { backgroundAbilityNames, backgroundAbilityAssignments, updateBackgroundIncrease, backgroundValidationWarnings } = useWizardBackgroundAbility(formData, setFormData);

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
     onAbilityMiscIncreaseChange,
   } = useWizardAbilities(formData, currentStep, setErrors, updateAbility);

   // Feat ability score choices (ASI from feats)
    const {
      featAbilityChoices,
      handleFeatAbilityChoice,
      handleFeatAbilityModeChange,
    } = useWizardFeatAbilityChoices(formData, feats, setFormData);

    const featAbilityAssignments = useMemo(() => formData.featAbilityChoices || {}, [formData.featAbilityChoices]);

   // Cap gate: block Save/Next while any ability total exceeds the effective cap (FT-001)
   const [abilityCapErrors, setAbilityCapErrors] = useState({});
   const abilityCapKey = useMemo(() => JSON.stringify({
     abilities: (formData.abilities || []).map(a => [a.name, a.baseScore, a.featIncrease, a.backgroundIncrease, a.miscIncrease]),
     feats: (formData.feats || []).map(f => (typeof f === 'string' ? f : f?.name)),
     level: formData.level,
     ruleset,
   }), [formData.abilities, formData.feats, formData.level, ruleset]);
   useEffect(() => {
     let cancelled = false;
     validateAbilityTotals(formData, { allFeats: feats, racesData, ruleset }).then(errs => {
       if (!cancelled) {
         setAbilityCapErrors(prev => (JSON.stringify(prev) === JSON.stringify(errs) ? prev : errs));
       }
     });
     return () => { cancelled = true; };
   }, [abilityCapKey]); // eslint-disable-line react-hooks/exhaustive-deps
   const abilitiesWithinCap = Object.keys(abilityCapErrors).length === 0;

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

    // Tool Proficiencies - Pattern A: preSelectedItems from closure
    const { toggleItem: handleToolToggle } = useWizardArrayToggle(
      setFormData, setErrors, 'toolProficiencies', preSelectedTools
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
    const stepErrors = await validateStep(currentStep, formData, { racesData, classSubtypes, ruleset, allFeats: feats });
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
        }
    const finalErrors = validateFinalFormData(formData, existingNames);
    if (Object.keys(finalErrors).length > 0) {
      setErrors(finalErrors);
      return;
        }
    const abilityErrors = await validateAbilityTotals(formData, { allFeats: feats, racesData, ruleset });
    if (Object.keys(abilityErrors).length > 0) {
      setErrors(abilityErrors);
      return;
        }
    onComplete(formData);
      }, [currentStep, formData, racesData, classSubtypes, ruleset, feats, existingNames, onComplete, setErrors]);

  const totalSteps = WIZARD_STEPS.length;

  // Shared step index: drives both the sidebar indicator and the content
  // headings so their numbering can never drift apart.
  const visibleSteps = useMemo(
    () => getVisibleSteps({ isEditing, ruleset }),
    [isEditing, ruleset]
  );
  const lastCanonicalStep = visibleSteps[visibleSteps.length - 1]?.step;
  const stepNumber = visibleSteps.findIndex((step) => step.step === currentStep) + 1;

  const renderStep = useCallback(() => {
    return (
      <WizardStepRenderer
        currentStep={currentStep}
        stepNumber={stepNumber}
        ruleset={ruleset}
        errors={errors}
        formData={formData}
        campaignName={campaignName}
        backgrounds={backgrounds}
        racesData={racesData}
        allRacesData={allRacesData}
        classSubtypes={classSubtypes}
        allClassesData={allClassesData}
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
        backgroundAbilityNames={backgroundAbilityNames}
        backgroundAbilityAssignments={backgroundAbilityAssignments}
        backgroundValidationWarnings={backgroundValidationWarnings}
        skillLimits={skillLimits}
        expertiseLimits={expertiseLimits}
        skillWarnings={skillWarnings}
        toolLimits={toolLimits}
        toolWarnings={toolWarnings}
        preSelectedTools={preSelectedTools}
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
        onAbilityMiscIncreaseChange={onAbilityMiscIncreaseChange}
        onSkillToggle={handleSkillToggle}
        onSkillExpertiseToggle={handleSkillExpertiseToggle}
        onToolToggle={handleToolToggle}
        onLanguageToggle={handleLanguageToggle}
        onFightingStyleToggle={handleFightingStyleToggle}
        onResistanceToggle={handleResistanceToggle}
        onImmunityToggle={handleImmunityToggle}
        warnings={skillWarnings}
        allFeats={feats}
        allMagicItems={magicItems}
        updateBackgroundIncrease={updateBackgroundIncrease}
        featAbilityChoices={featAbilityChoices}
        featAbilityAssignments={featAbilityAssignments}
        handleFeatAbilityChoice={handleFeatAbilityChoice}
        onFeatAbilityModeChange={handleFeatAbilityModeChange}
      />
    );
  }, [
    currentStep,
    stepNumber,
    ruleset,
    errors,
    formData,
    campaignName,
    backgrounds,
    racesData,
    allRacesData,
    classSubtypes,
    allClassesData,
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
    backgroundAbilityNames,
    backgroundAbilityAssignments,
    backgroundValidationWarnings,
    skillLimits,
    expertiseLimits,
    skillWarnings,
    toolLimits,
    toolWarnings,
    preSelectedTools,
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
    onAbilityMiscIncreaseChange,
    handleSkillToggle,
    handleSkillExpertiseToggle,
    handleToolToggle,
    handleLanguageToggle,
    handleFightingStyleToggle,
    handleResistanceToggle,
    handleImmunityToggle,
    updateBackgroundIncrease,
    featAbilityChoices,
    featAbilityAssignments,
    handleFeatAbilityChoice,
    handleFeatAbilityModeChange,
  ]);

  return (
      <div className="character-creation-wizard-overlay">
        <div className="character-creation-wizard">
          <WizardHeader
          title={isEditing ? "Edit Character" : "Create New Character"}
          onClose={handleRequestClose}
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
              ruleset={ruleset}
              getStepEnabled={getStepEnabled}
              goToStep={goToStep}
              isSaveEnabled={isSaveEnabled && abilitiesWithinCap}
              onSave={handleSubmit}
            />
            <div className="wizard-content">
              {renderStep()}
            </div>
          </div>
          <WizardFooter
          currentStep={currentStep}
          isFirstStep={isEditing ? currentStep === 2 : currentStep === 1}
          isLastStep={currentStep === lastCanonicalStep}
          onCancel={handleRequestClose}
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