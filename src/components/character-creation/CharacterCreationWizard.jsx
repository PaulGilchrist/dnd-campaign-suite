import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import './CharacterCreationWizard.css';
import { validateStep, validateFinalFormData, validateAbilityTotals, validateSelectionCaps, hasDuplicateCharacterName, DUPLICATE_CHARACTER_NAME_ERROR, CHARACTER_NAME_REQUIRED_ERROR } from '../../config/utils.js';
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
import { generateQuickBuildDraft, deriveQuickBackground } from '../../services/character/quickBuildService.js';
import { buildRulesetSwitchPreview, applyRulesetSwitchToFormData } from '../../services/character/rulesetSwitchPreview.js';
import RulesetSwitchConfirmModal from './RulesetSwitchConfirmModal.jsx';

const WizardStepRenderer = React.memo(({
  currentStep,
  stepNumber,
  ruleset,
  isEditing,
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
  buildMode,
  onBuildModeChange,
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
    isEditing,
    errors,
    formData,
    campaignName,
    backgrounds,
    buildMode,
    onBuildModeChange,
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

  // Quick build: 'custom' keeps the blank 17-step wizard byte-identical.
  // 'quick' prefills the 2024-only Background pick, then applies the full
  // derived draft (abilities/skills/tools/languages/styles/spells/equip)
  // once the user lands on step 7 with a race + class chosen. Everything
  // downstream stays the existing steps in review mode — same validators.
  const [buildMode, setBuildMode] = useState('custom');
  const quickBuildAppliedRef = useRef(false);

  useEffect(() => {
    // Ruleset switches clear the rules-derived draft; allow a fresh apply.
    quickBuildAppliedRef.current = false;
  }, [ruleset]);

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

  // Quick build prefills (declared after navigation so currentStep exists):
  // 2024 gates step 5 on a background before the class is known, so the walk
  // prefills the class-less resolution of the service's ONE background
  // derivation; the draft lands on step 7 arrival and never overwrites it.
  useEffect(() => {
    if (isEditing || buildMode !== 'quick' || ruleset !== '2024') return;
    if (currentStep === 5 && !formData.background) {
      updateField('background', deriveQuickBackground({ ruleset, className: formData.class?.name }));
    }
  }, [isEditing, buildMode, ruleset, currentStep, formData.background, formData.class?.name, updateField]);

  useEffect(() => {
    if (isEditing || buildMode !== 'quick' || currentStep !== 7) return;
    if (quickBuildAppliedRef.current || !formData.race?.name || !formData.class?.name) return;
    quickBuildAppliedRef.current = true;
    generateQuickBuildDraft(formData)
      .then(draft => setFormData(draft))
      .catch(error => {
        quickBuildAppliedRef.current = false;
        console.error('Quick build draft failed:', error);
      });
  }, [isEditing, buildMode, currentStep, formData, setFormData]);

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

   // Cap gate for LOADED selections (FT-002 belt, mirroring the
   // abilitiesWithinCap audit above): a ruleset switch can leave 2024 feat/
   // skill rows that are legal row NAMES in the target ruleset but impossible
   // in the target build, and disk-loaded drafts can carry the same. While
   // the Feats or Skills step would honestly print "selected > allowed", the
   // sidebar Save stays disabled — the loaded-state twin of the interactive
   // checkbox refusals, computed from the same validators the steps gate on.
   const [selectionCapErrors, setSelectionCapErrors] = useState({});
   const selectionCapKey = useMemo(() => JSON.stringify({
     ruleset,
     level: formData.level,
     background: formData.background,
     className: formData.class?.name,
     feats: (formData.feats || []).map(f => (typeof f === 'string' ? f : f?.name)),
     skills: formData.skillProficiencies || [],
   }), [ruleset, formData.level, formData.background, formData.class?.name, formData.feats, formData.skillProficiencies]);
   useEffect(() => {
     let cancelled = false;
     validateSelectionCaps(formData, { allFeats: feats }).then(errs => {
       if (!cancelled) {
         setSelectionCapErrors(prev => (JSON.stringify(prev) === JSON.stringify(errs) ? prev : errs));
       }
     });
     return () => { cancelled = true; };
   }, [selectionCapKey]); // eslint-disable-line react-hooks/exhaustive-deps
   const selectionsWithinCap = Object.keys(selectionCapErrors).length === 0;

   // Handlers
  // Ruleset switch (roadmap Item 2): never wipes silently — in BOTH flows
  // (fresh builds AND the edit lane on saved-character data). Every current
  // spells/feats/background row is first classified against the TARGET
  // ruleset's real data; when anything is selected the confirm modal names
  // exactly what stays ticked vs what is removed (and why) before any state
  // mutates. Cancel is inert. A draft with no rules-derived selections still
  // switches immediately (nothing can be lost), and clicking the already
  // selected card no longer resets the flow at all. In edit mode the switch
  // only touches the local draft until ✓ Save rides the existing edit-save
  // PUT — the `rules` field flip and the ledger's removals land together.
  const [pendingRulesetSwitch, setPendingRulesetSwitch] = useState(null);

  const commitRulesetSwitch = useCallback((preview) => {
    setRuleset(preview.targetRuleset);
    setFormData(prev => applyRulesetSwitchToFormData(prev, preview));
    goToStep(2);
  }, [setFormData, goToStep]);

  const handleRulesetChange = useCallback(async (newRuleset) => {
    if (newRuleset === ruleset) return;
    const preview = await buildRulesetSwitchPreview(formData, newRuleset);
    if (!preview.hasSelections) {
      commitRulesetSwitch(preview);
      return;
    }
    setPendingRulesetSwitch(preview);
  }, [ruleset, formData, commitRulesetSwitch]);

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
    // Defense-in-depth: the Save button is already gated by selectionsWithinCap,
    // but re-check the feat/skill slot caps here too so no write lane can
    // persist an over-cap build (the exact state this bug shipped).
    const capErrors = await validateSelectionCaps(formData, { allFeats: feats });
    if (Object.keys(capErrors).length > 0) {
      setErrors(capErrors);
      return;
        }
    onComplete(formData);
      }, [currentStep, formData, racesData, classSubtypes, ruleset, feats, existingNames, onComplete, setErrors]);

  const totalSteps = WIZARD_STEPS.length;

  // Shared step index: drives both the sidebar indicator and the content
  // headings so their numbering can never drift apart. The Ruleset step is
  // part of both flows — editing a saved character switches rulesets through
  // the same ledger-guarded lane as a fresh build.
  const visibleSteps = useMemo(
    () => getVisibleSteps({ ruleset }),
    [ruleset]
  );
  const lastCanonicalStep = visibleSteps[visibleSteps.length - 1]?.step;
  const stepNumber = visibleSteps.findIndex((step) => step.step === currentStep) + 1;

  const renderStep = useCallback(() => {
    return (
      <WizardStepRenderer
        currentStep={currentStep}
        stepNumber={stepNumber}
        ruleset={ruleset}
        isEditing={isEditing}
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
        buildMode={buildMode}
        onBuildModeChange={setBuildMode}
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
    isEditing,
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
    buildMode,
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
          title={isEditing ? `Edit "${characterData?.name}"` : "Create New Character"}
          onClose={handleRequestClose}
          />
          <WizardProgressBar
          currentStep={currentStep}
          totalSteps={totalSteps}
          />
          <div className="wizard-body">
            <WizardSidebar
              currentStep={currentStep}
              ruleset={ruleset}
              getStepEnabled={getStepEnabled}
              goToStep={goToStep}
              isSaveEnabled={isSaveEnabled && abilitiesWithinCap && selectionsWithinCap}
              onSave={handleSubmit}
            />
            <div className="wizard-content">
              {renderStep()}
            </div>
          </div>
          <WizardFooter
          currentStep={currentStep}
          isFirstStep={currentStep === 1}
          isLastStep={currentStep === lastCanonicalStep}
          onCancel={handleRequestClose}
          onPrevious={navigatePrevious}
          onNext={handleNext}
          onSubmit={handleSubmit}
          isEditing={isEditing}
          isNextDisabled={isNextDisabled}
          />
        </div>
        {pendingRulesetSwitch && (
          <RulesetSwitchConfirmModal
            preview={pendingRulesetSwitch}
            onCancel={() => setPendingRulesetSwitch(null)}
            onConfirm={() => {
              const preview = pendingRulesetSwitch;
              setPendingRulesetSwitch(null);
              commitRulesetSwitch(preview);
            }}
          />
        )}
      </div>
     );
}

export default CharacterCreationWizard;